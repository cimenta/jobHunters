import { foldDiacritics, type ApplicationRow, type JobRow } from '@jobhunters/core';

const normalise = (text: string): string => foldDiacritics(text).toLowerCase();

export interface JobFilters {
  text: string;
  availability: '' | 'online' | 'offline' | 'unknown';
  gig: boolean;
  /** Code of a job status; empty = any. */
  status?: string;
}

export function filterJobs(rows: readonly JobRow[], filters: JobFilters): JobRow[] {
  const needle = normalise(filters.text.trim());
  return rows.filter((row) => {
    if (filters.availability !== '' && row.availability !== filters.availability) return false;
    if (filters.gig && !row.is_gig) return false;
    if (filters.status !== undefined && filters.status !== '' && (row.status === '' ? 'new' : row.status) !== filters.status) return false;
    return needle === '' || normalise(`${row.title} ${row.company_name} ${row.location}`).includes(needle);
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
