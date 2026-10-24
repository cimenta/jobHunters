import { ValidationError } from './errors';
import { isHistoryKey, type SettingsHistory } from './history';
import { isLocale, type Locale } from './i18n';
import type { KeyValueStore } from './key-value';
import { NO_LOCK, type Lock } from './lock';
import type { AppWarning } from './row-codec';
import { DEFAULT_PROMPTS, type PromptType } from './seed';
import type { HistorySource } from './types';
import { parseJobStatusStyles, type JobStatusStyles } from './job-status';
import { DEFAULT_MENU_NUMBERS, parseMenuNumbers, stringifyMenuNumbers, type MenuNumbers } from './menu-metrics';
import { parseStatusTransitions, type StatusTransitions } from './status';
import { parseUiState, type UiState } from './ui-state';
import { parseStatusStyles, type StatusStyles } from './status-style';
import { hasOwn } from './util';

export const SETTING_KEYS = [
  'ui_language',
  'ui_theme',
  'result_notices',
  'candidate_experience',
  'default_document_language',
  'reminder_time',
  'reminder_email',
  'availability_check_enabled',
  'availability_check_hours',
  'availability_immediate_rules',
  'menu_refresh_seconds',
  'menu_refresh_busy_seconds',
  'menu_numbers',
  'job_status_migration',
  'sheet_formats_repaired',
  'communication_kinds_listed',
  'status_homework_listed',
  'offline_texts',
  'pdf_service_order',
  'default_document_set',
  'status_styles',
  'job_status_styles',
  'status_transitions',
  'ui_state',
  'history_max_versions',
  'ai_prompt_resume_tailor',
  'ai_prompt_cover_letter',
  'ai_prompt_other',
  'ai_prompt_answer_question',
  'ai_prompt_match_job',
  'ai_prompt_import_job',
  'ai_prompt_import_match_job',
  'ai_prompts_version',
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

export type UiTheme = 'system' | 'light' | 'dark';

export interface Settings {
  ui_language: Locale;
  ui_theme: UiTheme;
  /** Whether the interface shows a notice when an operation finishes (success or error). */
  result_notices: boolean;
  default_document_language: Locale;
  /** Free text: the candidate's experience, read by the AI when it evaluates a job match. */
  candidate_experience: string;
  /** HH:MM, local time of the script time zone. */
  reminder_time: string;
  reminder_email: string;
  /** Whether the scheduled availability check runs. */
  availability_check_enabled: boolean;
  /** Hours of the day (0-23, script time zone) at which the check runs. Stored comma-separated. */
  availability_check_hours: number[];
  /** Offline rules that mark a job offline at once; the others need two confirmations. Stored comma-separated. */
  availability_immediate_rules: string[];
  /** Seconds between refreshes of the menu numbers; 0 turns the timed refresh off. */
  menu_refresh_seconds: number;
  /** The same while AI tasks are waiting. */
  menu_refresh_busy_seconds: number;
  /** Which numbers the main menu shows next to Jobs, Applications and AI tasks (none, one, or two each). */
  menu_numbers: MenuNumbers;
  /** 1 once the one-time move of the statuses of ads that already have an application ran (see job-lifecycle.ts). */
  job_status_migration: string;
  /** 1 once Setup applied the formats of the sheet columns by their names (see setup-plan.ts). */
  sheet_formats_repaired: string;
  /** 1 once Setup put the list of communication types (with "after_meeting") into the dropdown of the sheet Communications. */
  communication_kinds_listed: string;
  /** 1 once Setup put the status Homework (and the reminder source homework) into the dropdowns of the sheets Applications and Reminders. */
  status_homework_listed: string;
  /** Phrases that mark an ad as offline. Stored one per line. */
  offline_texts: string[];
  /** PDF service ids in priority order. Stored comma-separated. */
  pdf_service_order: string[];
  /** Document types created with a new application. Stored comma-separated. */
  default_document_set: string[];
  /** Custom status labels as JSON, see status-style.ts. */
  status_styles: StatusStyles;
  /** Statuses of ads as JSON, see job-status.ts. */
  job_status_styles: JobStatusStyles;
  /** Which status an application may move to, see status.ts. */
  status_transitions: StatusTransitions;
  /** What the interface remembers: Kanban on or off and the selected statuses. */
  ui_state: UiState;
  /** Most unpinned versions kept per tracked text; at the limit saves are refused. */
  history_max_versions: number;
  /** The whole text of an AI task of that kind, with {{placeholders}} (see prompt.ts). */
  ai_prompt_resume_tailor: string;
  ai_prompt_cover_letter: string;
  ai_prompt_other: string;
  ai_prompt_answer_question: string;
  ai_prompt_match_job: string;
  ai_prompt_import_job: string;
  ai_prompt_import_match_job: string;
  /** The version of the default prompts the user accepted (reset to them or chose to keep their own); empty = never. */
  ai_prompts_version: string;
}

const defaultPrompt = (type: PromptType): string => DEFAULT_PROMPTS.find((p) => p.type === type)?.instruction ?? '';

/** Raw sheet values; setup writes these into the Settings sheet. */
export const SETTINGS_DEFAULTS: Readonly<Record<SettingKey, string>> = {
  ui_language: 'en',
  ui_theme: 'system',
  result_notices: 'true',
  candidate_experience: '',
  default_document_language: 'en',
  reminder_time: '08:00',
  reminder_email: '',
  availability_check_enabled: 'false',
  availability_check_hours: '18',
  availability_immediate_rules: 'offline_text',
  menu_refresh_seconds: '60',
  menu_refresh_busy_seconds: '15',
  menu_numbers: stringifyMenuNumbers(DEFAULT_MENU_NUMBERS),
  job_status_migration: '',
  sheet_formats_repaired: '',
  communication_kinds_listed: '',
  status_homework_listed: '',
  offline_texts: ['no longer available', 'position has been filled', 'už není aktuální', 'nabídka byla ukončena'].join('\n'),
  pdf_service_order: '',
  default_document_set: 'resume,cover_letter',
  status_styles: '{}',
  job_status_styles: '{}',
  status_transitions: '{}',
  ui_state: '{}',
  history_max_versions: '50',
  ai_prompt_resume_tailor: defaultPrompt('resume_tailor'),
  ai_prompt_cover_letter: defaultPrompt('cover_letter'),
  ai_prompt_other: defaultPrompt('other'),
  ai_prompt_answer_question: defaultPrompt('answer_question'),
  ai_prompt_match_job: defaultPrompt('match_job'),
  ai_prompt_import_job: defaultPrompt('import_job'),
  ai_prompt_import_match_job: defaultPrompt('import_match_job'),
  ai_prompts_version: '',
};

/** Codes of the availability rules that can decide a job is offline. */
export const OFFLINE_RULES = ['http_gone', 'redirect_elsewhere', 'valid_until_past', 'offline_text'] as const;

const DOCUMENT_TYPES = ['resume', 'cover_letter', 'other'];

const items = (raw: string, separator: RegExp): string[] =>
  raw.split(separator).map((part) => part.trim()).filter((part) => part !== '');

/** Refresh interval in seconds: a whole number, 0 (off) or 5..3600; undefined when invalid. */
export const parseRefreshSeconds = (raw: string): number | undefined => {
  const text = raw.trim();
  if (!/^\d{1,4}$/.test(text)) return undefined;
  const seconds = Number(text);
  return seconds === 0 || (seconds >= 5 && seconds <= 3600) ? seconds : undefined;
};

/** Longest AI prompt and longest candidate experience text, in characters. */
export const PROMPT_MAX = 15000;
export const EXPERIENCE_MAX = 40000;

const parsePrompt = (raw: string): string | undefined => (raw.trim() !== '' && raw.length <= PROMPT_MAX ? raw : undefined);

/** Each parser returns undefined for an invalid value. */
const PARSERS: { [K in SettingKey]: (raw: string) => Settings[K] | undefined } = {
  ui_language: (raw) => (isLocale(raw.trim()) ? (raw.trim() as Locale) : undefined),
  ui_theme: (raw) => (['system', 'light', 'dark'].includes(raw.trim()) ? (raw.trim() as UiTheme) : undefined),
  candidate_experience: (raw) => (raw.length <= EXPERIENCE_MAX ? raw : undefined),
  default_document_language: (raw) => (isLocale(raw.trim()) ? (raw.trim() as Locale) : undefined),
  reminder_time: (raw) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(raw.trim()) ? raw.trim() : undefined),
  reminder_email: (raw) => (raw.trim() === '' || /^[^@\s]+@[^@\s]+$/.test(raw.trim()) ? raw.trim() : undefined),
  result_notices: (raw) => (['true', 'false'].includes(raw.trim().toLowerCase()) ? raw.trim().toLowerCase() === 'true' : undefined),
  availability_check_enabled: (raw) => (['true', 'false'].includes(raw.trim().toLowerCase()) ? raw.trim().toLowerCase() === 'true' : undefined),
  availability_check_hours: (raw) => {
    const hours = items(raw, /,/).map((part) => (/^\d{1,2}$/.test(part) ? Number(part) : NaN));
    const valid = hours.length > 0 && hours.every((h) => h >= 0 && h <= 23) && new Set(hours).size === hours.length;
    return valid ? [...hours].sort((a, b) => a - b) : undefined;
  },
  availability_immediate_rules: (raw) => {
    const parts = items(raw, /,/);
    return parts.every((part) => (OFFLINE_RULES as readonly string[]).includes(part)) ? parts : undefined;
  },
  menu_refresh_seconds: parseRefreshSeconds,
  menu_refresh_busy_seconds: parseRefreshSeconds,
  menu_numbers: parseMenuNumbers,
  sheet_formats_repaired: (raw) => (raw.trim() === '' || raw.trim() === '1' ? raw.trim() : undefined),
  communication_kinds_listed: (raw) => (raw.trim() === '' || raw.trim() === '1' ? raw.trim() : undefined),
  status_homework_listed: (raw) => (raw.trim() === '' || raw.trim() === '1' ? raw.trim() : undefined),
  job_status_migration: (raw) => (raw.trim() === '' || raw.trim() === '1' ? raw.trim() : undefined),
  offline_texts: (raw) => items(raw, /\r?\n/),
  pdf_service_order: (raw) => items(raw, /,/),
  default_document_set: (raw) => {
    const parts = items(raw, /,/);
    return parts.every((part) => DOCUMENT_TYPES.includes(part)) ? parts : undefined;
  },
  status_styles: (raw) => parseStatusStyles(raw),
  job_status_styles: (raw) => parseJobStatusStyles(raw),
  status_transitions: (raw) => parseStatusTransitions(raw),
  ui_state: (raw) => parseUiState(raw),
  history_max_versions: (raw) => {
    const text = raw.trim();
    if (!/^\d{1,4}$/.test(text)) return undefined;
    const count = Number(text);
    return count >= 1 && count <= 1000 ? count : undefined;
  },
  ai_prompt_resume_tailor: parsePrompt,
  ai_prompt_cover_letter: parsePrompt,
  ai_prompt_other: parsePrompt,
  ai_prompt_answer_question: parsePrompt,
  ai_prompt_match_job: parsePrompt,
  ai_prompt_import_job: parsePrompt,
  ai_prompt_import_match_job: parsePrompt,
  ai_prompts_version: (raw) => (/^\d{0,6}$/.test(raw.trim()) ? raw.trim() : undefined),
};

function isSettingKey(key: string): key is SettingKey {
  return (SETTING_KEYS as readonly string[]).includes(key);
}

export function parseSettings(stored: Readonly<Record<string, string>>): { settings: Settings; warnings: AppWarning[] } {
  const warnings: AppWarning[] = [];
  const resolve = <K extends SettingKey>(key: K): Settings[K] => {
    const parser = PARSERS[key] as (raw: string) => Settings[K] | undefined;
    const raw = hasOwn(stored, key) ? stored[key]! : SETTINGS_DEFAULTS[key];
    const parsed = parser(raw);
    if (parsed !== undefined) return parsed;
    warnings.push({ code: 'setting_invalid', params: { key, value: raw } });
    return parser(SETTINGS_DEFAULTS[key]) as Settings[K];
  };
  const settings = {} as Record<SettingKey, unknown>;
  for (const key of SETTING_KEYS) settings[key] = resolve(key);
  return { settings: settings as unknown as Settings, warnings };
}

export interface SettingsUpdateOptions {
  /** What the history says caused the change; saved by default. */
  source?: HistorySource;
  /** The version number a restore came from. */
  restoredFrom?: string;
}

export class SettingsService {
  constructor(
    private readonly store: KeyValueStore,
    private readonly lock: Lock = NO_LOCK,
    private readonly history?: SettingsHistory,
  ) {}

  get(): { settings: Settings; warnings: AppWarning[] } {
    return parseSettings(this.store.getAll());
  }

  /** The text of a setting exactly as it is stored in the sheet (the default when nothing is stored). */
  raw(key: string): string {
    const stored = this.store.getAll();
    return hasOwn(stored, key) ? stored[key]! : SETTINGS_DEFAULTS[key as SettingKey];
  }

  /** Validates every entry first; writes nothing when one is invalid or when the history of a changed text is full. */
  update(patch: Readonly<Record<string, string>>, options: SettingsUpdateOptions = {}): Settings {
    for (const [key, value] of Object.entries(patch)) {
      if (!isSettingKey(key)) throw new ValidationError('settings_unknown_key', `Unknown setting ${key}`, { key });
      if (PARSERS[key](value) === undefined) {
        throw new ValidationError('settings_invalid', `Invalid value for ${key}`, { key, value });
      }
    }
    this.lock.run(() => {
      const history = this.history;
      const stored = history ? this.store.getAll() : {};
      const before = (key: string): string => (hasOwn(stored, key) ? stored[key]! : SETTINGS_DEFAULTS[key as SettingKey]);
      const changed = history ? Object.entries(patch).filter(([key, value]) => isHistoryKey(key) && value !== before(key)) : [];
      for (const [key] of changed) history!.assertRoom(key);
      for (const [key, value] of Object.entries(patch)) {
        if (history && changed.some(([changedKey]) => changedKey === key)) history.record(key, before(key), value, options.source ?? 'saved', options.restoredFrom);
        this.store.set(key, value);
      }
    });
    return this.get().settings;
  }
}
