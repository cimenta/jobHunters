import { app } from '../state/app.svelte';
import { tr, ui } from './i18n.svelte';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** The script's time zone, which every displayed time uses; undefined (the browser's) until it is known or when it is not a valid name. */
function zone(): string | undefined {
  if (app.timeZone === '') return undefined;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: app.timeZone });
    return app.timeZone;
  } catch {
    return undefined;
  }
}

/** A date (YYYY-MM-DD) or a date-time, in the current language. Anything else is returned unchanged. */
export function formatDate(value: string): string {
  if (value === '') return '';
  if (DATE_ONLY.test(value)) {
    return new Date(`${value}T00:00:00Z`).toLocaleDateString(ui.locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(ui.locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: zone() });
}

export function formatSalary(job: { salary_min: number | null; salary_max: number | null; salary_currency: string; salary_period: string }): string {
  const { salary_min: min, salary_max: max } = job;
  const low = min ?? max;
  if (low === null) return '';
  const high = max ?? min;
  const amount = (n: number): string => n.toLocaleString(ui.locale);
  const range = high === null || high === low ? amount(low) : `${amount(low)} – ${amount(high)}`;
  const currency = job.salary_currency === '' ? '' : ` ${job.salary_currency}`;
  const period = job.salary_period === '' ? '' : ` / ${tr(`ui.period.${job.salary_period}`)}`;
  return `${range}${currency}${period}`;
}

export function plusDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

/** Today in the browser's time zone as YYYY-MM-DD. */
export function todayLocal(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "0.5.0" -> "v0.5.0"; other labels (the development build says "dev") are shown as they are. */
export function formatVersion(version: string): string {
  return /^\d/.test(version) ? `v${version}` : version;
}

/** Cuts a user-written text to at most `max` characters (whitespace collapsed), ending with an ellipsis when it was longer. */
export function shorten(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
