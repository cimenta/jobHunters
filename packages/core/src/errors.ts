export const ERROR_CODES = [
  'row_id_required',
  'duplicate_id',
  'row_not_found',
  'application_not_found',
  'status_unknown',
  'application_status_unknown',
  'transition_not_allowed',
  'reminder_date_required',
  'reminder_date_invalid',
  'reminder_date_in_past',
  'label_company_required',
  'label_title_required',
  'label_attempt_invalid',
  'label_date_invalid',
  'sheet_header_missing',
  'settings_invalid',
  'settings_unknown_key',
  'invalid_arguments',
  'unknown_method',
  'internal_error',
  'sheet_missing',
  'setup_required',
  'export_failed',
  'url_invalid',
  'job_not_found',
  'job_status_invalid',
  'job_status_in_use',
  'language_invalid',
  'application_job_mismatch',
  'template_not_found',
  'template_invalid',
  'application_folder_missing',
  'document_not_found',
  'question_not_found',
  'question_required',
  'max_sentences_invalid',
  'answer_too_long',
  'communication_not_found',
  'communication_invalid',
  'reminder_not_found',
  'reminder_text_required',
  'company_not_found',
  'company_name_required',
  'company_website_invalid',
  'match_experience_required',
  'task_not_found',
  'task_not_cancellable',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
export type ErrorParams = Record<string, string | number>;

/** Base class: `code` + `params` are translated by the UI; `message` is English, for developers. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly params: ErrorParams = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {}
export class NotFoundError extends AppError {}
export class DuplicateIdError extends AppError {}
