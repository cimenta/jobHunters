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
