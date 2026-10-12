import type { FetchResult } from '../jobs/fetcher';
import type { JobParser } from '../jobs/parsed-job';
import { jobUrlKey, normalizeJobUrl } from '../jobs/url';
import type { Job } from '../types';

export type Availability = Job['availability'];

export interface Verdict {
  availability: Availability;
  /** Code of the rule that decided. */
  rule: string;
  /** Detail shown after the code, e.g. the HTTP status. */
  reason: string;
}

export interface AvailabilityContext {
  job: Pick<Job, 'url' | 'valid_until'>;
  result: FetchResult;
  /** Phrases that mark an ad as offline. */
  offlineTexts: readonly string[];
  /** YYYY-MM-DD. */
  today: string;
  parser?: JobParser;
}

export interface AvailabilityRule {
  code: string;
  /** Undefined = this rule has no opinion, the next one decides. */
  evaluate(context: AvailabilityContext): Verdict | undefined;
}

const verdict = (availability: Availability, rule: string, reason: string): Verdict => ({ availability, rule, reason });

const UNKNOWN_STATUSES = new Set([0, 401, 403, 407, 429]);
const LOGIN_PATH = /(login|signin|sign-in|captcha|authwall|verify|checkpoint)/i;

function pathOf(url: string): string {
  const match = /^https?:\/\/[^\/?#]+([^?#]*)/i.exec(url);
  return match ? match[1]! : url;
}

function comparable(url: string): string {
  try {
    return jobUrlKey(normalizeJobUrl(url));
  } catch {
    return url.trim().toLowerCase();
  }
}

/** An answer that says nothing about the ad: blocked, failed, or a login or captcha page. */
const unknownResponse: AvailabilityRule = {
  code: 'unknown_response',
  evaluate({ result }) {
    if (UNKNOWN_STATUSES.has(result.status) || result.status >= 500) return verdict('unknown', 'unknown_response', String(result.status));
    if (LOGIN_PATH.test(pathOf(result.finalUrl))) return verdict('unknown', 'unknown_response', 'login');
    return undefined;
  },
};

/** The rule of one portal, when its parser has one. */
const portal: AvailabilityRule = {
  code: 'portal',
  evaluate({ job, result, parser }) {
    const found = parser?.detectAvailability?.(result, job.url);
    return found === undefined ? undefined : verdict(found.availability, 'portal', found.reason);
  },
};

const httpGone: AvailabilityRule = {
  code: 'http_gone',
  evaluate({ result }) {
    return result.status === 404 || result.status === 410 ? verdict('offline', 'http_gone', String(result.status)) : undefined;
  },
};

/** The download ended on another address than the ad: the portal sent the visitor elsewhere. */
const redirectElsewhere: AvailabilityRule = {
  code: 'redirect_elsewhere',
  evaluate({ job, result }) {
    return comparable(result.finalUrl) === comparable(job.url) ? undefined : verdict('offline', 'redirect_elsewhere', result.finalUrl);
  },
};

const validUntilPast: AvailabilityRule = {
  code: 'valid_until_past',
  evaluate({ job, today }) {
    const until = job.valid_until.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(until) && until < today ? verdict('offline', 'valid_until_past', until) : undefined;
  },
};

const offlineText: AvailabilityRule = {
  code: 'offline_text',
  evaluate({ result, offlineTexts }) {
    const page = result.html.toLowerCase();
    const found = offlineTexts.find((text) => text.trim() !== '' && page.includes(text.trim().toLowerCase()));
    return found === undefined ? undefined : verdict('offline', 'offline_text', found.trim());
  },
};

/** In the order they are tried; the first with an opinion decides. */
export const AVAILABILITY_RULES: readonly AvailabilityRule[] = [unknownResponse, portal, httpGone, redirectElsewhere, validUntilPast, offlineText];

export function evaluateAvailability(context: AvailabilityContext): Verdict {
  for (const rule of AVAILABILITY_RULES) {
    const found = rule.evaluate(context);
    if (found !== undefined) return found;
  }
  return context.result.status === 200 ? verdict('online', 'default', '') : verdict('unknown', 'default', String(context.result.status));
}
