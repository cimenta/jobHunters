import type { ApplicationRow } from './catalog';
import { isRelayAddress } from './email-rules';
import { foldDiacritics } from './jobs/html';
import { INACTIVE_APPLICATION_STATUSES } from './status';
import type { Company, Email, Job } from './types';

export type MatchMethod = 'thread' | 'contact' | 'url' | 'domain' | 'company' | 'title';

/** The application a mail belongs to, or only the job when it has no application (then `applicationId` is empty). */
export interface MatchCandidate {
  applicationId: string;
  jobId: string;
  method: MatchMethod;
  score: number;
}

export interface MatchResult {
  /** Strongest first; at most MAX_CANDIDATES. */
  candidates: MatchCandidate[];
  best: MatchCandidate | undefined;
  /** The best candidate clearly beats the second one and is strong enough to be saved without asking. */
  unique: boolean;
}

export interface MatchInput {
  email: Pick<Email, 'id' | 'thread_id' | 'from_email' | 'from_name' | 'to' | 'direction' | 'body' | 'subject'>;
  titleHints: readonly string[];
  companyHints: readonly string[];
  applications: readonly ApplicationRow[];
  jobs: readonly Job[];
  companies: readonly Company[];
  /** The other mails of the sheet; the ones already tied to an application or a job give the thread and the contact. */
  others: readonly Email[];
  relayDomains: readonly string[];
}

const SCORE = { thread: 100, url: 90, title_company: 85, contact: 80, domain: 70, company: 60, title: 50 } as const;
const MAX_CANDIDATES = 5;
const UNIQUE_MIN = 60;
const UNIQUE_GAP = 15;

const LEGAL_FORMS = /\b(s\.?\s?r\.?\s?o\.?|sro|a\.?\s?s\.?|k\.?\s?s\.?|v\.?\s?o\.?\s?s\.?|spol\.?|gmbh|inc\.?|ltd\.?|llc|corp\.?|ag|bv)(?=\s|$|,)/g;

/** A name compared without case, diacritics, company forms (s.r.o., a.s., GmbH) and punctuation. */
export function normalizeName(text: string): string {
  return foldDiacritics(text)
    .toLowerCase()
    .replace(LEGAL_FORMS, ' ')
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Equal, or the longer one starts with the shorter one as whole words ("Acme Holding" starts with "Acme"); short names must be equal. */
function sameName(a: string, b: string, minLength: number): boolean {
  if (a === '' || b === '') return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= minLength && long.startsWith(`${short} `);
}

const bareUrl = (url: string): string => url.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
const hostOf = (website: string): string => bareUrl(website).split('/')[0] ?? '';
const addressOf = (header: string): string => (/<([^>]+)>/.exec(header)?.[1] ?? header.split(',')[0] ?? '').trim().toLowerCase();
const domainOf = (address: string): string => address.split('@')[1] ?? '';
const secondLevel = (domain: string): string => domain.split('.').slice(-2, -1)[0] ?? '';

/** The name of an applicant system's sender without the words that are not the company: "Acme Hiring Team" -> "Acme". */
function relayCompanyName(name: string): string {
  // "HERE @ icims" -> "HERE", "Amethyst from Accenture" -> "Accenture"
  const stripped = name.replace(/\s*@\s*\S+\s*$/, '').replace(/^.*\bfrom\s+/i, '');
  return stripped.replace(/\b(hiring|recruiting|recruitment|careers|talent|team|hr|notifications?|no-?reply)\b/gi, ' ').replace(/\s+/g, ' ').trim();
}

/** Where the counterpart of the mail writes from: the sender of an incoming mail, the first recipient of an outgoing one. */
function counterpartAddress(email: MatchInput['email']): string {
  return email.direction === 'outgoing' ? addressOf(email.to) : email.from_email.trim().toLowerCase();
}

function time(value: string | undefined): number {
  const parsed = Date.parse(value ?? '');
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** The application to use for a job: the latest open one, else the latest of any status; empty when the job has none. */
function applicationOfJob(jobId: string, applications: readonly ApplicationRow[]): ApplicationRow | undefined {
  const own = applications.filter((application) => application.job_id === jobId);
  const latest = (list: ApplicationRow[]): ApplicationRow | undefined =>
    [...list].sort((a, b) => time(b.last_activity_at || b.created_at) - time(a.last_activity_at || a.created_at) || b.attempt - a.attempt)[0];
  return latest(own.filter((application) => !INACTIVE_APPLICATION_STATUSES.includes(application.status))) ?? latest(own);
}

export function matchEmail(input: MatchInput): MatchResult {
  const { email, applications, jobs, companies, others, relayDomains } = input;
  const found = new Map<string, MatchCandidate>();
  const applicationById = new Map(applications.map((application) => [application.id, application]));
  const jobById = new Map(jobs.map((job) => [job.id, job]));

  /** Adds a candidate; a target found twice keeps the stronger method. */
  const add = (jobId: string, applicationId: string, method: MatchMethod, score: number): void => {
    const job = jobById.get(jobId);
    if (!job) return;
    const application = applicationId !== '' ? applicationById.get(applicationId) : applicationOfJob(jobId, applications);
    const key = application ? `a:${application.id}` : `j:${jobId}`;
    const known = found.get(key);
    if (!known || known.score < score) found.set(key, { applicationId: application?.id ?? '', jobId, method, score });
  };
  const addJob = (jobId: string, method: MatchMethod, score: number): void => add(jobId, '', method, score);
  const addTarget = (applicationId: string, jobId: string, method: MatchMethod, score: number): void => {
    const application = applicationById.get(applicationId);
    if (application) add(application.job_id, application.id, method, score);
    else if (jobId !== '') addJob(jobId, method, score);
  };

  const counterpart = counterpartAddress(email);
  const relay = isRelayAddress(counterpart, relayDomains);

  // Same thread, or the same sender, as a mail that is already tied to an application or a job.
  const tied = others.filter((other) => other.id !== email.id && (other.application_id !== '' || other.job_id !== ''));
  for (const other of tied) {
    if (email.thread_id !== '' && other.thread_id === email.thread_id) addTarget(other.application_id, other.job_id, 'thread', SCORE.thread);
    else if (!relay && counterpart !== '' && counterpartAddress(other) === counterpart) addTarget(other.application_id, other.job_id, 'contact', SCORE.contact);
  }

  // The link of a job in the text.
  const haystack = `${email.subject}\n${email.body}`.toLowerCase();
  for (const job of jobs) {
    const url = bareUrl(job.url ?? '');
    if (url.length >= 12 && haystack.includes(url)) addJob(job.id, 'url', SCORE.url);
  }

  // The company: by the website or the name in the sender's domain, never for a portal or a free mail service.
  const companyJobs = (companyId: string): Job[] => jobs.filter((job) => job.company_id === companyId);
  if (!relay && domainOf(counterpart) !== '') {
    const domain = domainOf(counterpart);
    const label = secondLevel(domain);
    for (const company of companies) {
      const host = hostOf(company.website ?? '');
      const byWebsite = host !== '' && (domain === host || domain.endsWith(`.${host}`) || host.endsWith(`.${domain}`));
      const byName = label.length >= 4 && normalizeName(company.name).replace(/ /g, '') === label;
      if (byWebsite || byName) for (const job of companyJobs(company.id)) addJob(job.id, 'domain', SCORE.domain);
    }
  }

  // The company and the job named in the text (and the name of an applicant system's sender, which is often the company).
  const companyHints = [...input.companyHints];
  if (relay && email.from_name.trim() !== '') companyHints.push(relayCompanyName(email.from_name));
  const matchedCompanies = new Set(
    companies.filter((company) => companyHints.some((hint) => sameName(normalizeName(hint), normalizeName(company.name), 3))).map((company) => company.id),
  );
  const titleMatches = (job: Job): boolean => input.titleHints.some((hint) => sameName(normalizeName(hint), normalizeName(job.title), 6));
  for (const job of jobs) {
    const company = matchedCompanies.has(job.company_id);
    const title = titleMatches(job);
    if (company && title) addJob(job.id, 'title', SCORE.title_company);
    else if (company) addJob(job.id, 'company', SCORE.company);
  }
  const titleOnly = jobs.filter((job) => titleMatches(job) && !matchedCompanies.has(job.company_id));
  if (titleOnly.length === 1) addJob(titleOnly[0]!.id, 'title', SCORE.title);

  // Equally strong targets: an open application before a rejected, withdrawn or ghosted one (or a job without one), then the more recent.
  const rank = (candidate: MatchCandidate): number => {
    const application = applicationById.get(candidate.applicationId);
    return application !== undefined && !INACTIVE_APPLICATION_STATUSES.includes(application.status) ? 1 : 0;
  };
  const activity = (candidate: MatchCandidate): number => {
    const application = applicationById.get(candidate.applicationId);
    return application === undefined ? 0 : time(application.last_activity_at || application.created_at);
  };
  const candidates = [...found.values()].sort((a, b) => b.score - a.score || rank(b) - rank(a) || activity(b) - activity(a)).slice(0, MAX_CANDIDATES);
  const best = candidates[0];
  const second = candidates[1];
  const unique = best !== undefined && best.score >= UNIQUE_MIN && (second === undefined || second.score <= best.score - UNIQUE_GAP);
  return { candidates, best, unique };
}
