import { describe, expect, it } from 'vitest';
import { formatDate, formatSalary, plusDays } from './format';
import { setLocale } from './i18n.svelte';

describe('formatDate', () => {
  it('formats a plain date without shifting the day', () => {
    setLocale('en');
    expect(formatDate('2026-10-11')).toBe('Oct 11, 2026');
  });
  it('formats a date-time and tolerates empty or odd input', () => {
    setLocale('en');
    expect(formatDate('2026-10-11T08:30:00.000Z')).toContain('2026');
    expect(formatDate('')).toBe('');
    expect(formatDate('yesterday')).toBe('yesterday');
  });
  it('uses the current language', () => {
    setLocale('cs');
    expect(formatDate('2026-10-11')).toContain('2026');
    expect(formatDate('2026-10-11')).not.toBe('Oct 11, 2026');
    setLocale('en');
  });
});

describe('formatSalary', () => {
  const base = { salary_min: 60000, salary_max: 80000, salary_currency: 'CZK', salary_period: 'month' };
  it('formats a range, a single amount and nothing', () => {
    setLocale('en');
    expect(formatSalary(base)).toBe('60,000 – 80,000 CZK / month');
    expect(formatSalary({ ...base, salary_max: 60000 })).toBe('60,000 CZK / month');
    expect(formatSalary({ ...base, salary_min: null, salary_max: null })).toBe('');
    expect(formatSalary({ ...base, salary_period: '' })).toBe('60,000 – 80,000 CZK');
  });
});

describe('plusDays', () => {
  it('adds days across month and year borders', () => {
    expect(plusDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(plusDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(plusDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('formatVersion', () => {
  it('prefixes numeric versions with v and leaves other labels alone', async () => {
    const { formatVersion } = await import('./format');
    expect(formatVersion('0.5.0')).toBe('v0.5.0');
    expect(formatVersion('dev')).toBe('dev');
    expect(formatVersion('')).toBe('');
  });
});
