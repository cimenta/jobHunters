import { ensureFolderPath, type DriveGateway, type FolderRef } from '../drive';
import type { Repository } from '../repository';
import type { AppWarning } from '../row-codec';
import { NotFoundError, ValidationError } from '../errors';
import type { Company, Job } from '../types';
import { foldDiacritics, truncateForCell } from './html';
import type { FetchResult, PageFetcher } from './fetcher';
import { emptyParsedJob, finishParsedJob, type ParsedJob } from './parsed-job';
import { parseJobPage, parseManualText } from './registry';
import { jobUrlKey, normalizeJobUrl, parseUrl, titleFromUrl } from './url';

export const EDITABLE_JOB_FIELDS = [
  'title', 'company', 'location', 'salary_min', 'salary_max', 'salary_currency', 'salary_period',
  'employment_type', 'is_gig', 'is_remote', 'is_hybrid', 'posted_at', 'valid_until', 'description', 'language', 'notes',
] as const;

/** Values the user confirmed or corrected in the form; they win over the parsed ones. */
export type JobOverrides = Partial<Omit<ParsedJob, 'missing'>> & { notes?: string };

export interface JobInput {
  url: string;
  /** Ad text pasted by the user when the page cannot be downloaded. */
  text?: string;
  /**
   * The page the preview already downloaded. Saving with it does not download the ad again: some servers (LinkedIn)
   * answer the second request in a row with HTTP 429.
   */
  html?: string;
  overrides?: JobOverrides;
}

export interface JobPreview {
  url: string;
  fetched: boolean;
  fetchStatus: number;
  parserId: string;
  parsed: ParsedJob;
  /** The downloaded page, to be sent back with `saveJob` so the ad is not downloaded twice; empty when nothing was downloaded. */
  html: string;
  /** Id of an existing job for the same ad, else empty. */
  duplicateOf: string;
}

export interface SaveResult {
  status: 'created' | 'duplicate';
  job: Job;
  company: Company | undefined;
  warnings: AppWarning[];
  missing: string[];
}

export interface RefreshResult {
  job: Job;
  /** Names of the Jobs columns whose value the refresh changed. */
  changed: string[];
}

export interface JobServiceDeps {
  jobs: Repository<Job>;
  companies: Repository<Company>;
  fetcher: PageFetcher;
  drive: DriveGateway;
  rootFolder: () => FolderRef;
  newId: () => string;
  /** ISO 8601 date-time. */
  now: () => string;
  /** Reports a swallowed failure (parser or snapshot) to the Log. */
  onError?: (where: string, error: unknown) => void;
}

const LEGAL_SUFFIXES = new Set(['s', 'r', 'o', 'sro', 'a', 'as', 'spol', 'inc', 'ltd', 'llc', 'gmbh', 'co', 'corp']);

/** Company names that differ only by case, diacritics, punctuation or legal form are the same company. */
export function companyKey(name: string): string {
  const tokens = foldDiacritics(name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((t) => t !== '');
  while (tokens.length > 1 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1]!)) tokens.pop();
  return tokens.join(' ');
}

interface Acquired {
  fetched: boolean;
  fetchStatus: number;
  content: { kind: 'html' | 'text'; body: string } | undefined;
  parserId: string;
  parsed: ParsedJob;
}

export class JobService {
  constructor(private readonly deps: JobServiceDeps) {}

  preview(input: JobInput): JobPreview {
    const url = normalizeJobUrl(input.url);
    const duplicate = this.findDuplicate(url);
    if (duplicate) {
      return { url, fetched: false, fetchStatus: 0, parserId: '', parsed: finishParsedJob(emptyParsedJob()), html: '', duplicateOf: duplicate.id };
    }
    const acquired = this.acquire(url, input);
    const html = acquired.fetched && acquired.content?.kind === 'html' ? acquired.content.body : '';
    return { url, fetched: acquired.fetched, fetchStatus: acquired.fetchStatus, parserId: acquired.parserId, parsed: acquired.parsed, html, duplicateOf: '' };
  }

  save(input: JobInput): SaveResult {
    const { jobs, companies, newId, now } = this.deps;
    const url = normalizeJobUrl(input.url);
    const duplicate = this.findDuplicate(url);
    if (duplicate) return { status: 'duplicate', job: duplicate, company: companies.get(duplicate.company_id), warnings: [], missing: [] };

    const acquired = this.acquire(url, input);
    return this.persist(url, acquired, input);
  }

  /** Like `save`, but downloads once and writes nothing unless the page gave a title and a description. */
  saveIfReadable(input: JobInput): SaveResult | { status: 'unreadable'; fetchStatus: number } {
    const { companies } = this.deps;
    const url = normalizeJobUrl(input.url);
    const duplicate = this.findDuplicate(url);
    if (duplicate) return { status: 'duplicate', job: duplicate, company: companies.get(duplicate.company_id), warnings: [], missing: [] };
    const acquired = this.acquire(url, input);
    const { missing } = acquired.parsed;
    if (!acquired.fetched || missing.includes('title') || missing.includes('description')) return { status: 'unreadable', fetchStatus: acquired.fetchStatus };
    return this.persist(url, acquired, input);
  }

  /**
   * Downloads the ad of a saved job again and overwrites the parsed fields. Notes, status, gig flag, match, ai_salary,
   * flags and the Drive snapshot are never touched; the company is set only while the job has none. An unreadable
   * page changes nothing.
   */
  refresh(jobId: string): RefreshResult {
    const { jobs, now } = this.deps;
    const job = jobs.get(jobId);
    if (!job) throw new NotFoundError('job_not_found', `Job ${jobId} not found`, { id: jobId });
    if (job.status === 'awaiting') throw new ValidationError('job_awaiting', `Job ${jobId} is waiting for the AI`, { id: jobId });
    if (job.url.trim() === '') throw new ValidationError('job_no_url', `Job ${jobId} has no link`, { id: jobId });

    const acquired = this.acquire(normalizeJobUrl(job.url), { url: job.url, text: undefined });
    const { missing } = acquired.parsed;
    if (!acquired.fetched || missing.includes('title') || missing.includes('description')) {
      throw new ValidationError('refresh_unreadable', `The ad of job ${jobId} could not be read (HTTP ${acquired.fetchStatus})`, { status: acquired.fetchStatus });
    }

    const parsed = acquired.parsed;
    const timestamp = now();
    const patch: Partial<Job> = {
      title: parsed.title.trim() || titleFromUrl(job.url), location: parsed.location, salary_min: parsed.salary_min, salary_max: parsed.salary_max,
      salary_currency: parsed.salary_currency, salary_period: parsed.salary_period, employment_type: parsed.employment_type,
      posted_at: parsed.posted_at, valid_until: parsed.valid_until, description: truncateForCell(parsed.description),
      language: parsed.language, parser_id: acquired.parserId,
    };
    const companyName = parsed.company.trim();
    if (job.company_id === '' && companyName !== '') patch.company_id = this.findOrCreateCompany(companyName).id;

    const changed: string[] = [];
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'parser_id') continue;
      if (job[key as keyof Job] !== value) changed.push(key === 'company_id' ? 'company' : key);
    }
    const updated = jobs.update(jobId, {
      ...patch, parsed_at: timestamp, availability: 'online', availability_reason: '', offline_strikes: 0, last_checked_at: timestamp,
    });
    return { job: updated, changed };
  }

  /** A job that only waits for the AI to read the ad: the title comes from the address. */
  createPlaceholder(rawUrl: string): Job {
    const url = normalizeJobUrl(rawUrl);
    return this.deps.jobs.insert({
      id: this.deps.newId(), company_id: '', title: titleFromUrl(url), url, source: parseUrl(url)?.host.replace(/^www\./, '') ?? '',
      parser_id: '', parsed_at: '', contact_id: '', found_at: this.deps.now(), is_gig: false, location: '', salary_min: null, salary_max: null,
      salary_currency: '', salary_period: '', employment_type: '', remote: '', is_remote: false, is_hybrid: false, posted_at: '', valid_until: '', description: '', language: '',
      availability: 'unknown', availability_reason: '', offline_strikes: 0, last_checked_at: '', flags: '', folder_url: '', notes: '',
      status: 'awaiting', match_percent: null, ai_salary: '', contact_person: '', no_reason: '',
    });
  }

  private persist(url: string, acquired: Acquired, input: JobInput): SaveResult {
    const { jobs, newId, now } = this.deps;
    const fields = { ...acquired.parsed, ...definedOnly(input.overrides) } as ParsedJob & { notes?: string };
    const warnings: AppWarning[] = [];
    if (!acquired.fetched && acquired.content === undefined) {
      warnings.push({ code: 'page_not_fetched', params: { status: acquired.fetchStatus } });
    }

    const companyName = fields.company.trim();
    const company = companyName === '' ? undefined : this.findOrCreateCompany(companyName);
    const title = fields.title.trim() || titleFromUrl(url);
    if (company) {
      const similar = jobs.list().find((job) => job.company_id === company.id && companyKey(job.title) === companyKey(title) && title !== '');
      if (similar) warnings.push({ code: 'similar_job', params: { id: similar.id, title: similar.title } });
    }

    const timestamp = now();
    const { folderUrl, snapshotSaved } = this.saveSnapshot(acquired, companyName, title, timestamp);
    const job: Job = {
      id: newId(),
      company_id: company?.id ?? '',
      title,
      url,
      source: parseUrl(url)?.host.replace(/^www\./, '') ?? '',
      parser_id: acquired.parserId,
      parsed_at: acquired.content === undefined ? '' : timestamp,
      contact_id: '',
      found_at: timestamp,
      is_gig: fields.is_gig,
      location: fields.location,
      salary_min: fields.salary_min,
      salary_max: fields.salary_max,
      salary_currency: fields.salary_currency,
      salary_period: fields.salary_period,
      employment_type: fields.employment_type,
      remote: '',
      is_remote: fields.is_remote,
      is_hybrid: fields.is_hybrid,
      posted_at: fields.posted_at,
      valid_until: fields.valid_until,
      description: truncateForCell(fields.description),
      language: fields.language,
      availability: acquired.fetched ? 'online' : 'unknown',
      availability_reason: '',
      offline_strikes: 0,
      last_checked_at: acquired.fetched ? timestamp : '',
      flags: snapshotSaved ? '' : 'snapshot_missing',
      folder_url: folderUrl,
      notes: fields.notes ?? '',
      status: 'new',
      match_percent: null,
      ai_salary: '',
      contact_person: '',
      no_reason: '',
    };
    jobs.insert(job);
    return { status: 'created', job, company, warnings, missing: acquired.parsed.missing };
  }

  /** The saved job for the same ad as the address, if any. */
  duplicateOf(rawUrl: string): Job | undefined {
    return this.findDuplicate(normalizeJobUrl(rawUrl));
  }

  private findDuplicate(url: string): Job | undefined {
    const key = jobUrlKey(url);
    return this.deps.jobs.list().find((job) => jobUrlKey(job.url) === key);
  }

  private findOrCreateCompany(name: string): Company {
    const { companies, newId } = this.deps;
    const key = companyKey(name);
    const existing = companies.list().find((company) => companyKey(company.name) === key);
    return existing ?? companies.insert({ id: newId(), name, website: '', notes: '' });
  }

  private acquire(url: string, input: JobInput): Acquired {
    const text = input.text?.trim();
    if (text) {
      const parsed = parseManualText(text, { title: input.overrides?.title, company: input.overrides?.company });
      return { fetched: false, fetchStatus: 0, content: { kind: 'text', body: text }, parserId: 'manual', parsed };
    }
    let page: FetchResult;
    if (input.html !== undefined && input.html.trim() !== '') {
      page = { status: 200, finalUrl: url, html: input.html };
    } else {
      try {
        page = this.deps.fetcher.fetch(url);
      } catch (error) {
        this.report('fetch', error);
        page = { status: 0, finalUrl: url, html: '' };
      }
    }
    if (page.status === 200 && page.html.trim() !== '') {
      const { parserId, job } = parseJobPage(page.html, url, { onError: (id, error) => this.report(`parser:${id}`, error) });
      return { fetched: true, fetchStatus: 200, content: { kind: 'html', body: page.html }, parserId, parsed: job };
    }
    const parsed = finishParsedJob({ ...emptyParsedJob(), title: titleFromUrl(url) });
    return { fetched: false, fetchStatus: page.status, content: undefined, parserId: 'none', parsed };
  }

  /** The job must be saved even if Drive fails, so every failure here becomes a flag. */
  private saveSnapshot(acquired: Acquired, companyName: string, title: string, timestamp: string): { folderUrl: string; snapshotSaved: boolean } {
    if (acquired.content === undefined) return { folderUrl: '', snapshotSaved: false };
    try {
      const { drive, rootFolder } = this.deps;
      const folder = ensureFolderPath(drive, rootFolder(), ['Companies', companyName || 'Unknown company', title]);
      const snapshotFolder = ensureFolderPath(drive, folder, [`Ad ${timestamp.slice(0, 10)}`]);
      const html = acquired.content.kind === 'html';
      drive.saveTextFile(snapshotFolder.id, html ? 'snapshot.html' : 'snapshot.txt', acquired.content.body, html ? 'text/html' : 'text/plain');
      return { folderUrl: folder.url, snapshotSaved: true };
    } catch (error) {
      this.report('snapshot', error);
      return { folderUrl: '', snapshotSaved: false };
    }
  }

  private report(where: string, error: unknown): void {
    try {
      this.deps.onError?.(where, error);
    } catch {
      // Reporting must never break the flow.
    }
  }
}

function definedOnly<T extends object>(value: T | undefined): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, entry] of Object.entries(value ?? {})) {
    if (entry !== undefined) (out as Record<string, unknown>)[key] = entry;
  }
  return out;
}
