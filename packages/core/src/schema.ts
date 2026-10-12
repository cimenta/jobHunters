import { APPLICATION_STATUSES } from './status';
import type { Application, ApplicationDocument, Communication, Company, Job, LogEntry, Question, Reminder, StatusHistoryEntry, Template } from './types';

/** Resolves to `true` when every key of T appears in the column list C, otherwise to `never`. */
type Complete<T, C extends readonly string[]> = Exclude<keyof T, C[number]> extends never ? true : never;

const COMPANY_COLUMNS = ['id', 'name', 'website', 'notes'] as const satisfies readonly (keyof Company)[];

const JOB_COLUMNS = [
  'id', 'company_id', 'title', 'url', 'source', 'parser_id', 'parsed_at', 'contact_id', 'found_at',
  'is_gig', 'location', 'salary_min', 'salary_max', 'salary_currency', 'salary_period',
  'employment_type', 'remote', 'posted_at', 'valid_until', 'description', 'language', 'availability',
  'availability_reason', 'offline_strikes', 'last_checked_at', 'flags', 'folder_url', 'notes', 'status', 'match_percent',
] as const satisfies readonly (keyof Job)[];

const APPLICATION_COLUMNS = [
  'id', 'job_id', 'attempt', 'label', 'language', 'status', 'applied_at', 'last_activity_at',
  'snapshot_used', 'folder_url', 'notes',
] as const satisfies readonly (keyof Application)[];

const REMINDER_COLUMNS = [
  'id', 'application_id', 'job_id', 'due_at', 'text', 'status', 'source', 'created_at', 'done_at',
  'reminded_at',
] as const satisfies readonly (keyof Reminder)[];

const STATUS_HISTORY_COLUMNS = ['application_id', 'from', 'to', 'at'] as const satisfies readonly (keyof StatusHistoryEntry)[];
const DOCUMENT_COLUMNS = [
  'id', 'application_id', 'type', 'doc_url', 'pdf_url', 'template_id', 'created_at', 'pdf_exported_at',
] as const satisfies readonly (keyof ApplicationDocument)[];
const QUESTION_COLUMNS = [
  'id', 'application_id', 'position', 'question', 'answer', 'max_sentences', 'status', 'created_at', 'updated_at',
] as const satisfies readonly (keyof Question)[];
const COMMUNICATION_COLUMNS = [
  'id', 'application_id', 'datetime', 'direction', 'channel', 'contact_id', 'summary', 'details', 'attachment_url',
] as const satisfies readonly (keyof Communication)[];
const TEMPLATE_COLUMNS = ['id', 'type', 'language', 'name', 'doc_url'] as const satisfies readonly (keyof Template)[];
const LOG_COLUMNS = ['time', 'flow', 'entity', 'message'] as const satisfies readonly (keyof LogEntry)[];

// Compile-time guards: fail `npm run typecheck` when an entity gains a field that is not a sheet column.
export const _companyComplete: Complete<Company, typeof COMPANY_COLUMNS> = true;
export const _jobComplete: Complete<Job, typeof JOB_COLUMNS> = true;
export const _applicationComplete: Complete<Application, typeof APPLICATION_COLUMNS> = true;
export const _reminderComplete: Complete<Reminder, typeof REMINDER_COLUMNS> = true;
export const _statusHistoryComplete: Complete<StatusHistoryEntry, typeof STATUS_HISTORY_COLUMNS> = true;
export const _documentComplete: Complete<ApplicationDocument, typeof DOCUMENT_COLUMNS> = true;
export const _questionComplete: Complete<Question, typeof QUESTION_COLUMNS> = true;
export const _communicationComplete: Complete<Communication, typeof COMMUNICATION_COLUMNS> = true;
export const _templateComplete: Complete<Template, typeof TEMPLATE_COLUMNS> = true;
export const _logComplete: Complete<LogEntry, typeof LOG_COLUMNS> = true;

// Sheets whose entity interfaces arrive with the plan that first uses them are listed by columns only.
export const SHEETS = {
  Companies: COMPANY_COLUMNS,
  Jobs: JOB_COLUMNS,
  Applications: APPLICATION_COLUMNS,
  Documents: DOCUMENT_COLUMNS,
  Questions: QUESTION_COLUMNS,
  Communications: COMMUNICATION_COLUMNS,
  Reminders: REMINDER_COLUMNS,
  Contacts: ['id', 'company_id', 'job_id', 'name', 'email', 'phone', 'role'],
  StatusHistory: STATUS_HISTORY_COLUMNS,
  Tasks: ['id', 'created_at', 'application_id', 'job_id', 'type', 'target_type', 'target_id', 'instructions', 'status', 'ai_note', 'completed_at'],
  Templates: TEMPLATE_COLUMNS,
  Profile: ['key', 'value'],
  Settings: ['key', 'value'],
  INSTRUCTIONS: ['text'],
  Log: LOG_COLUMNS,
} as const satisfies Record<string, readonly string[]>;

export type SheetName = keyof typeof SHEETS;

export type ColumnType = 'string' | 'number' | 'boolean';

const NUMBER_COLUMNS = new Set(['attempt', 'salary_min', 'salary_max', 'offline_strikes', 'position', 'max_sentences', 'match_percent']);
const NULLABLE_NUMBER_COLUMNS = new Set(['salary_min', 'salary_max', 'max_sentences', 'match_percent']);
const BOOLEAN_COLUMNS = new Set(['is_gig']);

export function columnType(column: string): ColumnType {
  if (NUMBER_COLUMNS.has(column)) return 'number';
  if (BOOLEAN_COLUMNS.has(column)) return 'boolean';
  return 'string';
}

export function isNullableNumber(column: string): boolean {
  return NULLABLE_NUMBER_COLUMNS.has(column);
}

/** `Sheet.column` -> codes that may appear. Empty cells are always accepted. */
export const ALLOWED_VALUES: Readonly<Record<string, readonly string[]>> = {
  'Jobs.availability': ['online', 'offline', 'unknown'],
  'Jobs.remote': ['', 'yes', 'no', 'hybrid'],
  'Applications.status': APPLICATION_STATUSES,
  'Documents.type': ['resume', 'cover_letter', 'other'],
  'Questions.status': ['open', 'answered'],
  'Communications.direction': ['incoming', 'outgoing', 'note'],
  'Communications.channel': ['email', 'phone', 'linkedin', 'in_person', 'portal', 'other'],
  'Reminders.status': ['open', 'done', 'dismissed'],
  'Reminders.source': ['manual', 'waiting'],
  'Tasks.type': ['cover_letter', 'resume_tailor', 'answer_question', 'rewrite', 'summarize_job', 'extract_job', 'match_job', 'other'],
  'Tasks.target_type': ['document', 'question', 'job'],
  'Tasks.status': ['pending', 'in_progress', 'done', 'needs_input', 'failed'],
  'Templates.type': ['resume', 'cover_letter', 'other'],
};
