import { ValidationError } from './errors';
import { isLocale, type Locale } from './i18n';
import type { KeyValueStore } from './key-value';
import { NO_LOCK, type Lock } from './lock';
import type { AppWarning } from './row-codec';
import { hasOwn } from './util';

export const SETTING_KEYS = [
  'ui_language',
  'default_document_language',
  'reminder_time',
  'reminder_email',
  'availability_check_days',
  'offline_texts',
  'pdf_service_order',
  'default_document_set',
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

export interface Settings {
  ui_language: Locale;
  default_document_language: Locale;
  /** HH:MM, local time of the script time zone. */
  reminder_time: string;
  reminder_email: string;
  availability_check_days: number;
  /** Phrases that mark an ad as offline. Stored one per line. */
  offline_texts: string[];
  /** PDF service ids in priority order. Stored comma-separated. */
  pdf_service_order: string[];
  /** Document types created with a new application. Stored comma-separated. */
  default_document_set: string[];
}

/** Raw sheet values; setup writes these into the Settings sheet. */
export const SETTINGS_DEFAULTS: Readonly<Record<SettingKey, string>> = {
  ui_language: 'en',
  default_document_language: 'en',
  reminder_time: '08:00',
  reminder_email: '',
  availability_check_days: '1',
  offline_texts: ['no longer available', 'position has been filled', 'už není aktuální', 'nabídka byla ukončena'].join('\n'),
  pdf_service_order: '',
  default_document_set: 'resume,cover_letter',
};

const DOCUMENT_TYPES = ['resume', 'cover_letter', 'other'];

const items = (raw: string, separator: RegExp): string[] =>
  raw.split(separator).map((part) => part.trim()).filter((part) => part !== '');

/** Each parser returns undefined for an invalid value. */
const PARSERS: { [K in SettingKey]: (raw: string) => Settings[K] | undefined } = {
  ui_language: (raw) => (isLocale(raw.trim()) ? (raw.trim() as Locale) : undefined),
  default_document_language: (raw) => (isLocale(raw.trim()) ? (raw.trim() as Locale) : undefined),
  reminder_time: (raw) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(raw.trim()) ? raw.trim() : undefined),
  reminder_email: (raw) => (raw.trim() === '' || /^[^@\s]+@[^@\s]+$/.test(raw.trim()) ? raw.trim() : undefined),
  availability_check_days: (raw) => {
    const n = Number(raw.trim());
    return Number.isInteger(n) && n >= 1 && n <= 30 ? n : undefined;
  },
  offline_texts: (raw) => items(raw, /\r?\n/),
  pdf_service_order: (raw) => items(raw, /,/),
  default_document_set: (raw) => {
    const parts = items(raw, /,/);
    return parts.every((part) => DOCUMENT_TYPES.includes(part)) ? parts : undefined;
  },
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
