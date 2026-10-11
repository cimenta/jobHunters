import type { Application, Company, Job, Reminder, StatusHistoryEntry } from './types';

/** Resolves to `true` when every key of T appears in the column list C, otherwise to `never`. */
type Complete<T, C extends readonly string[]> = Exclude<keyof T, C[number]> extends never ? true : never;

const COMPANY_COLUMNS = ['id', 'name', 'website', 'notes'] as const satisfies readonly (keyof Company)[];

const JOB_COLUMNS = [
  'id', 'company_id', 'title', 'url', 'source', 'parser_id', 'parsed_at', 'contact_id', 'found_at',
  'is_gig', 'location', 'salary_min', 'salary_max', 'salary_currency', 'salary_period',
  'employment_type', 'remote', 'posted_at', 'valid_until', 'description', 'availability',
  'availability_reason', 'offline_strikes', 'last_checked_at', 'flags', 'folder_url', 'notes',
] as const satisfies readonly (keyof Job)[];

const APPLICATION_COLUMNS = [
  'id', 'job_id', 'attempt', 'label', 'status', 'applied_at', 'last_activity_at', 'snapshot_used',
  'folder_url', 'notes',
] as const satisfies readonly (keyof Application)[];

const REMINDER_COLUMNS = [
  'id', 'application_id', 'job_id', 'due_at', 'text', 'status', 'source', 'created_at', 'done_at',
  'reminded_at',
] as const satisfies readonly (keyof Reminder)[];

const STATUS_HISTORY_COLUMNS = ['application_id', 'from', 'to', 'at'] as const satisfies readonly (keyof StatusHistoryEntry)[];

// Compile-time guards: fail `npm run typecheck` when an entity gains a field that is not a sheet column.
export const _companyComplete: Complete<Company, typeof COMPANY_COLUMNS> = true;
export const _jobComplete: Complete<Job, typeof JOB_COLUMNS> = true;
export const _applicationComplete: Complete<Application, typeof APPLICATION_COLUMNS> = true;
export const _reminderComplete: Complete<Reminder, typeof REMINDER_COLUMNS> = true;
export const _statusHistoryComplete: Complete<StatusHistoryEntry, typeof STATUS_HISTORY_COLUMNS> = true;

export const SHEETS = {
  Companies: COMPANY_COLUMNS,
  Jobs: JOB_COLUMNS,
  Applications: APPLICATION_COLUMNS,
  Reminders: REMINDER_COLUMNS,
  StatusHistory: STATUS_HISTORY_COLUMNS,
} as const;
