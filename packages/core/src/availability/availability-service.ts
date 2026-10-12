import { NotFoundError } from '../errors';
import type { PageFetcher } from '../jobs/fetcher';
import type { JobParser } from '../jobs/parsed-job';
import { PORTAL_PARSERS } from '../jobs/registry';
import type { Repository } from '../repository';
import { statusChecksAvailability, type StatusStyles } from '../status-style';
import type { Application, Job } from '../types';
import { evaluateAvailability, type Verdict } from './rules';

export interface AvailabilitySettings {
  offlineTexts: readonly string[];
  /** Offline rules that decide at once. */
  immediateRules: readonly string[];
  statusStyles: StatusStyles;
}

export interface AvailabilityServiceDeps {
  jobs: Repository<Job>;
  applications: Repository<Application>;
  fetcher: PageFetcher;
  settings: () => AvailabilitySettings;
  /** ISO 8601 date-time. */
  now: () => string;
  /** Milliseconds, for the time budget of a batch. */
  clock: () => number;
  log: (flow: string, entity: string, message: string) => void;
  parserFor?: (url: string) => JobParser | undefined;
}

export interface CheckResult {
  job: Job;
  verdict: Verdict;
  /** Whether availability changed. */
  changed: boolean;
}

export interface BatchResult {
  checked: number;
  changed: number;
  /** Eligible jobs left for the next run. */
  remaining: number;
}

/** Offline needs this many consecutive offline verdicts unless the rule marks a job offline at once. */
export const OFFLINE_CONFIRMATIONS = 2;

const reasonOf = (verdict: Verdict): string => (verdict.reason === '' ? verdict.rule : `${verdict.rule}: ${verdict.reason}`);

/** The fields of a job that one verdict changes. */
export function nextAvailability(job: Job, verdict: Verdict, immediateRules: readonly string[]): Pick<Job, 'availability' | 'availability_reason' | 'offline_strikes'> {
  if (verdict.availability === 'online') return { availability: 'online', availability_reason: '', offline_strikes: 0 };
  if (verdict.availability === 'unknown') {
    return { availability: job.availability, availability_reason: reasonOf(verdict), offline_strikes: job.offline_strikes };
  }
  if (immediateRules.includes(verdict.rule)) {
    return { availability: 'offline', availability_reason: reasonOf(verdict), offline_strikes: job.offline_strikes };
  }
  const strikes = job.offline_strikes + 1;
  return strikes >= OFFLINE_CONFIRMATIONS
    ? { availability: 'offline', availability_reason: reasonOf(verdict), offline_strikes: strikes }
    : { availability: job.availability, availability_reason: `suspected ${reasonOf(verdict)}`, offline_strikes: strikes };
}

export class AvailabilityService {
  constructor(private readonly deps: AvailabilityServiceDeps) {}

  /** Checks one job now, whatever its state. */
  check(jobId: string): CheckResult {
    const { jobs, fetcher, settings, now, log } = this.deps;
    const job = jobs.get(jobId);
    if (!job) throw new NotFoundError('job_not_found', `Job ${jobId} not found`, { id: jobId });
    const { offlineTexts, immediateRules } = settings();
    const parserFor = this.deps.parserFor ?? ((url: string) => PORTAL_PARSERS.find((p) => p.matches(url)));
    const checkedAt = now();
    const verdict = evaluateAvailability({
      job, result: fetcher.fetch(job.url), offlineTexts, today: checkedAt.slice(0, 10), parser: parserFor(job.url),
    });
    const patch = nextAvailability(job, verdict, immediateRules);
    const updated = jobs.update(jobId, { ...patch, last_checked_at: checkedAt });
    const changed = updated.availability !== job.availability;
    if (changed) log('availability', jobId, `${job.availability} -> ${updated.availability} (${updated.availability_reason})`);
    return { job: updated, verdict, changed };
  }

  /** Jobs the scheduled check looks at, the longest unchecked first. */
  eligibleJobs(): Job[] {
    const { jobs, applications, settings } = this.deps;
    const { statusStyles } = settings();
    const byJob = new Map<string, Application[]>();
    for (const application of applications.list()) byJob.set(application.job_id, [...(byJob.get(application.job_id) ?? []), application]);
    return jobs.list()
      .filter((job) => {
        if (job.availability === 'offline') return false;
        const own = byJob.get(job.id) ?? [];
        return own.length === 0 || own.some((application) => statusChecksAvailability(statusStyles, application.status));
      })
      .sort((a, b) => (a.last_checked_at < b.last_checked_at ? -1 : a.last_checked_at > b.last_checked_at ? 1 : 0));
  }

  /** The scheduled run: checks eligible jobs until the budget is spent. A failure of one job does not stop the rest. */
  checkDue(budgetMs: number): BatchResult {
    const { clock, log } = this.deps;
    const start = clock();
    const queue = this.eligibleJobs();
    let checked = 0;
    let changed = 0;
    for (const job of queue) {
      if (clock() - start >= budgetMs) break;
      try {
        if (this.check(job.id).changed) changed++;
      } catch (error) {
        log('availability', job.id, error instanceof Error ? error.message : String(error));
      }
      checked++;
    }
    log('availability', '', `checked ${checked}, changed ${changed}, left ${queue.length - checked}`);
    return { checked, changed, remaining: queue.length - checked };
  }
}
