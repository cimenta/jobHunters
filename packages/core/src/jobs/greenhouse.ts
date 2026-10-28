import { decodeEntities, elementsInnerHtml, htmlToText, metaContent, titleTag } from './html';
import { emptyParsedJob, finishParsedJob, type JobParser, type ParsedJob } from './parsed-job';
import { hostIs, parseUrl } from './url';

type Json = Record<string, unknown>;

/** An ad of a Greenhouse job board: `/<company>/jobs/<id>`. */
const AD_PATH = /^\/[^\/]+\/jobs\/\d+\/?$/;

const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** The object that starts at `start` (a "{"), cut out with its braces balanced; braces inside strings do not count. */
function balancedObject(source: string, start: number): string | undefined {
  let depth = 0;
  let inString = false;
  for (let i = start; i < source.length; i++) {
    const char = source[i]!;
    if (inString) {
      if (char === '\\') i++;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth++;
    } else if (char === '}' && --depth === 0) {
      return source.slice(start, i + 1);
    }
  }
  return undefined;
}

/** The ad the page hands to its own scripts (`"jobPost":{...}` inside window.__remixContext), or undefined when it is not there. */
function embeddedPost(html: string): Json | undefined {
  const at = html.indexOf('"jobPost":{');
  if (at < 0) return undefined;
  const raw = balancedObject(html, at + '"jobPost":'.length);
  if (raw === undefined) return undefined;
  try {
    const post: unknown = JSON.parse(raw);
    return isRecord(post) ? post : undefined;
  } catch {
    return undefined;
  }
}

/** Some boards hand the text over as escaped markup ("&lt;p&gt;"); that is unescaped first. */
function markupToText(markup: string): string {
  return htmlToText(/</.test(markup) || !/&lt;/i.test(markup) ? markup : decodeEntities(markup));
}

function dateOnly(value: string): string {
  return /^\d{4}-\d{2}-\d{2}/.exec(value)?.[0] ?? '';
}

/** Greenhouse pay ranges are amounts in cents of one currency; the first range with an amount is taken, as a yearly pay. */
function readPay(job: ParsedJob, ranges: unknown): void {
  if (!Array.isArray(ranges)) return;
  for (const range of ranges) {
    if (!isRecord(range)) continue;
    const cents = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) / 100 : null);
    const min = cents(range.min_cents);
    const max = cents(range.max_cents);
    const currency = text(range.currency_type).toUpperCase();
    if ((min === null && max === null) || currency === '') continue;
    job.salary_min = min ?? max;
    job.salary_max = max ?? min;
    job.salary_currency = currency;
    job.salary_period = 'year';
    return;
  }
}

/** "Remote, Germany; Remote, Poland" is a remote ad; a place that says hybrid is a hybrid one. */
function workMode(location: string): '' | 'yes' | 'hybrid' {
  if (/\bhybrid\b/i.test(location)) return 'hybrid';
  return /\bremote\b/i.test(location) ? 'yes' : '';
}

function fromPost(post: Json): ParsedJob {
  const job = emptyParsedJob();
  job.title = text(post.title);
  job.company = text(post.company_name);
  job.location = text(post.job_post_location);
  job.remote = workMode(job.location);
  job.posted_at = dateOnly(text(post.published_at));
  job.valid_until = dateOnly(text(post.application_deadline));
  job.description = [post.introduction, post.content, post.conclusion].map((part) => markupToText(text(part))).filter((part) => part !== '').join('\n\n');
  readPay(job, post.pay_ranges);
  return job;
}

/** For a page whose script data is missing or changed: the headline, the place and the text of the visible page. */
function fromMarkup(html: string): ParsedJob {
  const job = emptyParsedJob();
  const heading = elementsInnerHtml(html, /^<h1\b/i)[0];
  job.title = heading === undefined ? metaContent(html, 'og:title') : htmlToText(heading);
  // The tab title reads "Job Application for <title> at <company>".
  job.company = /^Job Application for .+ at (.+)$/.exec(titleTag(html))?.[1]?.trim() ?? '';
  const place = elementsInnerHtml(html, /class="[^"]*\bjob__location\b[^"]*"/)[0];
  job.location = place === undefined ? metaContent(html, 'og:description') : htmlToText(place);
  job.remote = workMode(job.location);
  const body = elementsInnerHtml(html, /class="[^"]*\bjob__description\b[^"]*"/)[0];
  job.description = body === undefined ? '' : htmlToText(body);
  return job;
}

/**
 * Greenhouse job boards (job-boards.greenhouse.io, job-boards.eu.greenhouse.io and the older boards.greenhouse.io) put the
 * whole ad into the page as data for their own scripts: title, company, place, the three parts of the text, the date it
 * was published, the deadline and the pay ranges (checked 2026-10-30). There is no structured data for the generic reader,
 * so this one reads that data, and falls back to the visible headline, place and text when the data is missing.
 * The type of contract is not given. The address key is the number of the ad, whichever company or tracking
 * parameter the link carries.
 */
export const GREENHOUSE_PARSER: JobParser = {
  id: 'greenhouse',
  matches: (url) => hostIs(url, 'greenhouse.io') && AD_PATH.test(parseUrl(url)?.path ?? ''),
  parse(html) {
    const post = embeddedPost(html);
    const job = post === undefined ? fromMarkup(html) : fromPost(post);
    if (post !== undefined && job.title === '') job.title = fromMarkup(html).title;
    return finishParsedJob(job);
  },
};
