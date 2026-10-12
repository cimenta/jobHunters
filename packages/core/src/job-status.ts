import { isLocale, t, type Locale } from './i18n';
import { readableTextColor, STATUS_TEXT_MAX, UNKNOWN_STATUS_COLOR } from './status-style';

export const BUILTIN_JOB_STATUSES = ['new', 'no', 'awaiting'] as const;

export interface JobStatusStyle {
  /** Display name per language; the catalog text is used for a built-in status where none is given. */
  text?: Partial<Record<Locale, string>>;
  /** #rrggbb */
  color: string;
  /** Whether ads in this status without an application get their availability checked. */
  check: boolean;
}
export type JobStatusStyles = Record<string, JobStatusStyle>;

export const DEFAULT_JOB_STATUS_STYLES: Readonly<JobStatusStyles> = {
  new: { color: '#2563eb', check: true },
  no: { color: '#6b7280', check: false },
  awaiting: { color: '#d97706', check: false },
};

const COLOR = /^#[0-9a-fA-F]{6}$/;
const CODE = /^[a-z0-9_]{1,40}$/;

export const isBuiltinJobStatus = (code: string): boolean => (BUILTIN_JOB_STATUSES as readonly string[]).includes(code);

function plainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseTexts(value: unknown): Partial<Record<Locale, string>> | undefined {
  if (!plainObject(value)) return undefined;
  const texts: Partial<Record<Locale, string>> = {};
  for (const [locale, label] of Object.entries(value)) {
    if (!isLocale(locale) || typeof label !== 'string') return undefined;
    const trimmed = label.trim();
    if (trimmed === '' || trimmed.length > STATUS_TEXT_MAX) return undefined;
    texts[locale] = trimmed;
  }
  return texts;
}

/**
 * The stored value holds the changes to the built-in statuses and every custom status. The result always
 * holds the built-in ones. The whole value is rejected when any part is invalid.
 */
export function parseJobStatusStyles(raw: string): JobStatusStyles | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw.trim() === '' ? '{}' : raw);
  } catch {
    return undefined;
  }
  if (!plainObject(value)) return undefined;
  const out: JobStatusStyles = {};
  for (const [code, style] of Object.entries(DEFAULT_JOB_STATUS_STYLES)) out[code] = { ...style };
  for (const [code, entry] of Object.entries(value)) {
    if (!CODE.test(code) || !plainObject(entry)) return undefined;
    const builtin = isBuiltinJobStatus(code);
    const base = out[code] ?? { color: '', check: true };
    const next: JobStatusStyle = { ...base };
    if (entry.color !== undefined) {
      if (typeof entry.color !== 'string' || !COLOR.test(entry.color)) return undefined;
      next.color = entry.color.toLowerCase();
    }
    if (entry.check !== undefined) {
      if (typeof entry.check !== 'boolean') return undefined;
      next.check = entry.check;
    }
    if (entry.text !== undefined) {
      const texts = parseTexts(entry.text);
      if (texts === undefined) return undefined;
      next.text = texts;
    }
    if (!builtin && (next.color === '' || next.text === undefined || Object.keys(next.text).length === 0)) return undefined;
    out[code] = next;
  }
  return out;
}

export function serializeJobStatusStyles(styles: JobStatusStyles): string {
  return JSON.stringify(styles);
}

/** The status an ad is in: an empty or unknown code means new. */
export function jobStatusOf(styles: JobStatusStyles, status: string): string {
  return Object.prototype.hasOwnProperty.call(styles, status) ? status : 'new';
}

export function jobStatusChecksAvailability(styles: JobStatusStyles, status: string): boolean {
  return styles[jobStatusOf(styles, status)]?.check ?? true;
}

/** Colour of the match percentage: 0-39 red, 40-69 orange, 70-100 green. */
export function matchColor(percent: number): string {
  return percent >= 70 ? '#15803d' : percent >= 40 ? '#b45309' : '#b91c1c';
}

export interface ResolvedJobStatus {
  code: string;
  text: string;
  color: string;
  textColor: string;
}

/** An ad in the status new that the AI has evaluated shows the match instead of the name of the status. */
export function resolveJobStatus(styles: JobStatusStyles, status: string, matchPercent: number | null | undefined, locale: Locale): ResolvedJobStatus {
  const code = jobStatusOf(styles, status);
  if (code === 'new' && typeof matchPercent === 'number' && Number.isFinite(matchPercent)) {
    const color = matchColor(matchPercent);
    return { code, text: t('jobStatus.match', { percent: String(matchPercent) }, locale), color, textColor: readableTextColor(color) };
  }
  const style = styles[code];
  const color = style?.color ?? UNKNOWN_STATUS_COLOR;
  const text = style?.text?.[locale] ?? (isBuiltinJobStatus(code) ? t(`jobStatus.${code}`, {}, locale) : code);
  return { code, text, color, textColor: readableTextColor(color) };
}
