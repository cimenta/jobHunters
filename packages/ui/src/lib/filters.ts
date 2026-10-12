import { foldDiacritics, type ApplicationRow, type JobRow, type JobSort } from '@jobhunters/core';

const normalise = (text: string): string => foldDiacritics(text).toLowerCase();

export interface JobFilters {
  text: string;
  availability: '' | 'online' | 'offline' | 'unknown';
  gig: boolean;
  /** Code of a job status; empty = any. */
  status?: string;
  /** Drop jobs that have at least one application. */
  hideApplied?: boolean;
}

export function filterJobs(rows: readonly JobRow[], filters: JobFilters): JobRow[] {
  const needle = normalise(filters.text.trim());
  return rows.filter((row) => {
    if (filters.availability !== '' && row.availability !== filters.availability) return false;
    if (filters.gig && !row.is_gig) return false;
    if (filters.hideApplied === true && row.application_count > 0) return false;
    if (filters.status !== undefined && filters.status !== '' && (row.status === '' ? 'new' : row.status) !== filters.status) return false;
    return needle === '' || normalise(`${row.title} ${row.company_name} ${row.location}`).includes(needle);
  });
}

/** A match number, or undefined when the job has none (the value can also arrive missing). */
function matchOf(row: JobRow): number | undefined {
  const value: unknown = row.match_percent;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Newest first by found_at (empty = oldest). */
function byNewest(a: JobRow, b: JobRow): number {
  const x = a.found_at ?? '';
  const y = b.found_at ?? '';
  return x < y ? 1 : x > y ? -1 : 0;
}

/** A new array; stable; jobs without a match come last in both match orders, ties newest first. */
export function sortJobs(rows: readonly JobRow[], order: JobSort): JobRow[] {
  const out = [...rows];
  if (order === 'newest') return out.sort(byNewest);
  if (order === 'oldest') return out.sort((a, b) => -byNewest(a, b));
  const sign = order === 'match_desc' ? -1 : 1;
  return out.sort((a, b) => {
    const x = matchOf(a);
    const y = matchOf(b);
    if (x === undefined || y === undefined) return x === y ? byNewest(a, b) : x === undefined ? 1 : -1;
    return x === y ? byNewest(a, b) : sign * (x - y);
  });
}

export interface ApplicationFilters {
  text: string;
  /** One status; empty = any. */
  status?: string;
  /** Several statuses; empty or missing = any. */
  statuses?: readonly string[];
}

export function filterApplications(rows: readonly ApplicationRow[], filters: ApplicationFilters): ApplicationRow[] {
  const needle = normalise(filters.text.trim());
  return rows.filter((row) => {
    if (filters.status !== undefined && filters.status !== '' && row.status !== filters.status) return false;
    if (filters.statuses !== undefined && filters.statuses.length > 0 && !filters.statuses.includes(row.status)) return false;
    return needle === '' || normalise(`${row.label} ${row.job_title} ${row.company_name}`).includes(needle);
  });
}
