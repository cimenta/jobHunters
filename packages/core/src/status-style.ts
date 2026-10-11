import { isLocale, t, type Locale } from './i18n';
import { isApplicationStatus, type ApplicationStatus } from './status';

export interface StatusStyle {
  /** Display name per language; the catalog text is used where none is given. */
  text?: Partial<Record<Locale, string>>;
  /** #rrggbb */
  color?: string;
}
export type StatusStyles = Partial<Record<ApplicationStatus, StatusStyle>>;

export const STATUS_TEXT_MAX = 30;
export const UNKNOWN_STATUS_COLOR = '#64748b';
export const DEFAULT_STATUS_COLORS: Readonly<Record<ApplicationStatus, string>> = {
  draft: '#64748b',
  sent: '#2563eb',
  waiting: '#b45309',
  interview: '#7c3aed',
  offer: '#15803d',
  rejected: '#b91c1c',
  ghosted: '#475569',
  withdrawn: '#6b7280',
};

const COLOR = /^#[0-9a-fA-F]{6}$/;

function plainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The whole value is rejected when any part is invalid, so a half-valid setting never produces odd labels. */
export function parseStatusStyles(raw: string): StatusStyles | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw.trim() === '' ? '{}' : raw);
  } catch {
    return undefined;
  }
  if (!plainObject(value)) return undefined;
  const out: StatusStyles = {};
  for (const [status, entry] of Object.entries(value)) {
    if (!isApplicationStatus(status) || !plainObject(entry)) return undefined;
    const style: StatusStyle = {};
    if (entry.color !== undefined) {
      if (typeof entry.color !== 'string' || !COLOR.test(entry.color)) return undefined;
      style.color = entry.color.toLowerCase();
    }
    if (entry.text !== undefined) {
      if (!plainObject(entry.text)) return undefined;
      const texts: Partial<Record<Locale, string>> = {};
      for (const [locale, label] of Object.entries(entry.text)) {
        if (!isLocale(locale) || typeof label !== 'string') return undefined;
        const trimmed = label.trim();
        if (trimmed === '' || trimmed.length > STATUS_TEXT_MAX) return undefined;
        texts[locale] = trimmed;
      }
      style.text = texts;
    }
    out[status] = style;
  }
  return out;
}

export function serializeStatusStyles(styles: StatusStyles): string {
  return JSON.stringify(styles);
}

function relativeLuminance(hex: string): number {
  const channel = (index: number): number => {
    const c = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** White or near-black, whichever has the higher WCAG contrast against the background. */
export function readableTextColor(hex: string): '#ffffff' | '#111111' {
  if (!COLOR.test(hex)) return '#ffffff';
  const l = relativeLuminance(hex);
  const againstWhite = 1.05 / (l + 0.05);
  const againstDark = (l + 0.05) / (relativeLuminance('#111111') + 0.05);
  return againstWhite >= againstDark ? '#ffffff' : '#111111';
}

export interface ResolvedStatusStyle {
  text: string;
  color: string;
  textColor: string;
}

export function resolveStatusStyle(styles: StatusStyles, status: string, locale: Locale): ResolvedStatusStyle {
  if (!isApplicationStatus(status)) {
    return { text: status === '' ? '?' : status.slice(0, STATUS_TEXT_MAX), color: UNKNOWN_STATUS_COLOR, textColor: readableTextColor(UNKNOWN_STATUS_COLOR) };
  }
  const custom = styles[status];
  const color = custom?.color ?? DEFAULT_STATUS_COLORS[status];
  return { text: custom?.text?.[locale] ?? t(`status.${status}`, {}, locale), color, textColor: readableTextColor(color) };
}
