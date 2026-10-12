import { ValidationError } from './errors';
import { isLocale, type Locale } from './i18n';
import type { KeyValueStore } from './key-value';
import { NO_LOCK, type Lock } from './lock';
import type { AppWarning } from './row-codec';
import { DEFAULT_PROMPTS, type PromptType } from './seed';
import { parseJobStatusStyles, type JobStatusStyles } from './job-status';
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
  'offline_texts',
  'pdf_service_order',
  'default_document_set',
  'status_styles',
  'job_status_styles',
  'status_transitions',
  'ui_state',
  'ai_prompt_resume_tailor',
  'ai_prompt_cover_letter',
  'ai_prompt_other',
  'ai_prompt_answer_question',
  'ai_prompt_match_job',
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
  /** The whole text of an AI task of that kind, with {{placeholders}} (see prompt.ts). */
  ai_prompt_resume_tailor: string;
  ai_prompt_cover_letter: string;
  ai_prompt_other: string;
  ai_prompt_answer_question: string;
  ai_prompt_match_job: string;
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
  offline_texts: ['no longer available', 'position has been filled', 'už není aktuální', 'nabídka byla ukončena'].join('\n'),
  pdf_service_order: '',
  default_document_set: 'resume,cover_letter',
  status_styles: '{}',
  job_status_styles: '{}',
  status_transitions: '{}',
  ui_state: '{}',
  ai_prompt_resume_tailor: defaultPrompt('resume_tailor'),
  ai_prompt_cover_letter: defaultPrompt('cover_letter'),
  ai_prompt_other: defaultPrompt('other'),
  ai_prompt_answer_question: defaultPrompt('answer_question'),
  ai_prompt_match_job: defaultPrompt('match_job'),
};

/** Codes of the availability rules that can decide a job is offline. */
export const OFFLINE_RULES = ['http_gone', 'redirect_elsewhere', 'valid_until_past', 'offline_text'] as const;

const DOCUMENT_TYPES = ['resume', 'cover_letter', 'other'];

const items = (raw: string, separator: RegExp): string[] =>
  raw.split(separator).map((part) => part.trim()).filter((part) => part !== '');

const parsePrompt = (raw: string): string | undefined => (raw.trim() !== '' && raw.length <= 10000 ? raw : undefined);

/** Each parser returns undefined for an invalid value. */
const PARSERS: { [K in SettingKey]: (raw: string) => Settings[K] | undefined } = {
  ui_language: (raw) => (isLocale(raw.trim()) ? (raw.trim() as Locale) : undefined),
  ui_theme: (raw) => (['system', 'light', 'dark'].includes(raw.trim()) ? (raw.trim() as UiTheme) : undefined),
  candidate_experience: (raw) => (raw.length <= 40000 ? raw : undefined),
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
  ai_prompt_resume_tailor: parsePrompt,
  ai_prompt_cover_letter: parsePrompt,
  ai_prompt_other: parsePrompt,
  ai_prompt_answer_question: parsePrompt,
  ai_prompt_match_job: parsePrompt,
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

export class SettingsService {
  constructor(
    private readonly store: KeyValueStore,
    private readonly lock: Lock = NO_LOCK,
  ) {}

  get(): { settings: Settings; warnings: AppWarning[] } {
    return parseSettings(this.store.getAll());
  }

  /** Validates every entry first; writes nothing when one is invalid. */
  update(patch: Readonly<Record<string, string>>): Settings {
    for (const [key, value] of Object.entries(patch)) {
      if (!isSettingKey(key)) throw new ValidationError('settings_unknown_key', `Unknown setting ${key}`, { key });
      if (PARSERS[key](value) === undefined) {
        throw new ValidationError('settings_invalid', `Invalid value for ${key}`, { key, value });
      }
    }
    this.lock.run(() => {
      for (const [key, value] of Object.entries(patch)) this.store.set(key, value);
    });
    return this.get().settings;
  }
}
