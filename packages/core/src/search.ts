import type { AiTaskRow } from './applications/ai-task-service';
import { firstAddressLabel } from './emails';
import { foldDiacritics } from './jobs/html';
import type { Application, Company, Email, Job } from './types';

export const SEARCH_TYPES = ['companies', 'jobs', 'applications', 'emails', 'tasks'] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

/** A search needs at least this many characters, so one letter does not list the whole database. */
export const MIN_SEARCH_LENGTH = 2;
export const DEFAULT_SEARCH_LIMIT = 5;
export const MAX_SEARCH_LIMIT = 50;

/** One thing that matched. The screen turns the codes (status, kind) into words and picks the screen to open by `type` and `id`. */
export interface SearchHit {
  type: SearchType;
  id: string;
  title: string;
  /** Short facts shown under the title, for example the company and the place. */
  parts: string[];
  /** The status code of a job, an application or a task; empty for the other types. */
  status: string;
  /** When it happened (an e-mail), else empty. */
  date: string;
  /** The direction of an e-mail or the type of a task; empty otherwise. */
  kind: string;
  /** For a company: how many jobs and applications it has. */
  counts?: { jobs: number; applications: number };
  /** A piece of the text around the match, when the match is not in the title. */
  snippet: string;
}

export interface SearchGroup {
  /** How many things matched, which can be more than the hits returned. */
  total: number;
  hits: SearchHit[];
}

export interface SearchResult {
  query: string;
  groups: Record<SearchType, SearchGroup>;
}

export interface SearchData {
  companies: readonly Company[];
  jobs: readonly Job[];
  applications: readonly Application[];
  /** Undefined when the sheet Emails does not exist: that group is then empty. */
  emails: readonly Email[] | undefined;
  tasks: readonly AiTaskRow[];
}

export interface SearchOptions {
  limit?: number;
  /** Only these groups are searched; the others come back empty. All when not given. */
  types?: readonly SearchType[];
}

/** The words of a query, folded so case and diacritics do not matter. */
export function searchWords(query: string): string[] {
  return foldDiacritics(query).toLowerCase().split(/\s+/).filter((word) => word !== '');
}

function fold(text: string): string {
  return foldDiacritics(text).toLowerCase();
}

/** The text folded character by character, with where each folded character came from, so a match can be shown in the original text. */
function foldWithMap(text: string): { folded: string; starts: number[]; ends: number[] } {
  let folded = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let index = 0;
  for (const char of text) {
    const piece = fold(char);
    for (let i = 0; i < piece.length; i++) {
      starts.push(index);
      ends.push(index + char.length);
    }
    folded += piece;
    index += char.length;
  }
  return { folded, starts, ends };
}

/** Where the words are in the text, as ranges of the original text, merged and in order. */
function ranges(text: string, words: readonly string[]): [number, number][] {
  const { folded, starts, ends } = foldWithMap(text);
  const found: [number, number][] = [];
  for (const word of words) {
    let from = folded.indexOf(word);
    while (from !== -1) {
      found.push([starts[from] ?? 0, ends[from + word.length - 1] ?? text.length]);
      from = folded.indexOf(word, from + word.length);
    }
  }
  found.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of found) {
    const last = merged[merged.length - 1];
    if (last !== undefined && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

/** The text cut into pieces, each marked as a match or not, to draw the matches in bold. */
export function markMatches(text: string, words: readonly string[]): { text: string; hit: boolean }[] {
  if (text === '' || words.length === 0) return [{ text, hit: false }];
  const pieces: { text: string; hit: boolean }[] = [];
  let at = 0;
  for (const [start, end] of ranges(text, words)) {
    if (start > at) pieces.push({ text: text.slice(at, start), hit: false });
    pieces.push({ text: text.slice(start, end), hit: true });
    at = end;
  }
  if (at < text.length) pieces.push({ text: text.slice(at), hit: false });
  return pieces.length === 0 ? [{ text, hit: false }] : pieces;
}

const SNIPPET_BEFORE = 30;
const SNIPPET_AFTER = 70;

/** About a line of the text around its first match, on one line, with … where it is cut. */
function excerpt(text: string, words: readonly string[]): string {
  const [first] = ranges(text, words);
  if (first === undefined) return '';
  const start = Math.max(0, first[0] - SNIPPET_BEFORE);
  const end = Math.min(text.length, first[1] + SNIPPET_AFTER);
  const piece = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${piece}${end < text.length ? '…' : ''}`;
}

interface Candidate {
  hit: Omit<SearchHit, 'snippet'>;
  /** The title is searched too, and a match there ranks higher. */
  title: string;
  /** Other texts searched; a match only here is shown as a snippet. */
  others: string[];
}

/** Every word must be in the title or in one of the other texts; the score is higher for words in the title. */
function score(candidate: Candidate, words: readonly string[]): number | undefined {
  const title = fold(candidate.title);
  const others = candidate.others.map(fold);
  let total = 0;
  for (const word of words) {
    if (title.includes(word)) total += title.startsWith(word) ? 5 : 3;
    else if (others.some((text) => text.includes(word))) total += 1;
    else return undefined;
  }
  return total;
}

function pick(candidates: readonly Candidate[], words: readonly string[], limit: number): SearchGroup {
  const scored: { candidate: Candidate; score: number; order: number }[] = [];
  candidates.forEach((candidate, order) => {
    const value = score(candidate, words);
    if (value !== undefined) scored.push({ candidate, score: value, order });
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return {
    total: scored.length,
    hits: scored.slice(0, limit).map(({ candidate }) => {
      const titleMatches = ranges(candidate.title, words).length > 0;
      const field = titleMatches ? undefined : candidate.others.find((text) => ranges(text, words).length > 0);
      return { ...candidate.hit, snippet: field === undefined ? '' : excerpt(field, words) };
    }),
  };
}

const EMPTY: SearchGroup = { total: 0, hits: [] };

/**
 * Finds the things whose texts contain every word of the query (case and diacritics do not matter), per type, best
 * first (a match in the title before one deeper in the text, then the order the lists came in). Each group returns at
 * most `limit` hits and says how many matched in all.
 */
export function searchAll(data: SearchData, query: string, options: SearchOptions = {}): SearchResult {
  const groups: Record<SearchType, SearchGroup> = { companies: EMPTY, jobs: EMPTY, applications: EMPTY, emails: EMPTY, tasks: EMPTY };
  const words = query.trim().length < MIN_SEARCH_LENGTH ? [] : searchWords(query);
  if (words.length === 0) return { query, groups };
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT));
  const wanted = (type: SearchType): boolean => options.types === undefined || options.types.includes(type);

  const companyName = new Map(data.companies.map((company) => [company.id, company.name]));
  const jobById = new Map(data.jobs.map((job) => [job.id, job]));
  const nameOfJob = (job: Job | undefined): string => (job ? (companyName.get(job.company_id) ?? '') : '');

  if (wanted('companies')) {
    const jobCount = new Map<string, number>();
    for (const job of data.jobs) jobCount.set(job.company_id, (jobCount.get(job.company_id) ?? 0) + 1);
    const applicationCount = new Map<string, number>();
    for (const application of data.applications) {
      const company = jobById.get(application.job_id)?.company_id ?? '';
      applicationCount.set(company, (applicationCount.get(company) ?? 0) + 1);
    }
    groups.companies = pick(
      data.companies.map((company) => ({
        hit: { type: 'companies', id: company.id, title: company.name, parts: [], status: '', date: '', kind: '', counts: { jobs: jobCount.get(company.id) ?? 0, applications: applicationCount.get(company.id) ?? 0 } },
        title: company.name,
        others: [company.website, company.notes],
      })),
      words,
      limit,
    );
  }
  if (wanted('jobs')) {
    groups.jobs = pick(
      data.jobs.map((job) => {
        const company = nameOfJob(job);
        return {
          hit: { type: 'jobs', id: job.id, title: job.title, parts: [company, job.location].filter((part) => part !== ''), status: job.status, date: '', kind: '' },
          title: job.title,
          others: [company, job.location, job.contact_person, job.no_reason, job.notes, job.match_note, job.description],
        };
      }),
      words,
      limit,
    );
  }
  if (wanted('applications')) {
    groups.applications = pick(
      data.applications.map((application) => {
        const job = jobById.get(application.job_id);
        const company = nameOfJob(job);
        return {
          hit: { type: 'applications', id: application.id, title: application.label, parts: [job?.title ?? '', company].filter((part) => part !== ''), status: application.status, date: '', kind: '' },
          title: application.label,
          others: [job?.title ?? '', company, application.notes, application.interview_prep],
        };
      }),
      words,
      limit,
    );
  }
  if (wanted('emails') && data.emails !== undefined) {
    const emails = [...data.emails].sort((a, b) => (Date.parse(b.received_at) || 0) - (Date.parse(a.received_at) || 0));
    groups.emails = pick(
      emails.map((email) => {
        const counterpart = email.direction === 'outgoing' ? firstAddressLabel(email.to) : email.from_name.trim() || email.from_email.trim();
        return {
          hit: { type: 'emails', id: email.id, title: email.subject, parts: [counterpart].filter((part) => part !== ''), status: '', date: email.received_at, kind: email.direction },
          title: email.subject,
          others: [email.from_name, email.from_email, email.to, email.cc, email.attachments, email.body],
        };
      }),
      words,
      limit,
    );
  }
  if (wanted('tasks')) {
    groups.tasks = pick(
      data.tasks.map((task) => ({
        hit: { type: 'tasks', id: task.id, title: task.job_title, parts: [task.company_name].filter((part) => part !== ''), status: task.status, date: task.created_at, kind: task.type },
        title: task.job_title,
        others: [task.company_name, task.type.replace(/_/g, ' '), task.ai_note],
      })),
      words,
      limit,
    );
  }
  return { query, groups };
}
