import { describe, expect, it } from 'vitest';
import { formatAiSalary, formatCount, formatDate, formatEmploymentType, formatSalary, formatWorkMode, plusDays, safeHttpUrl, shorten } from './format';
import { setLocale } from './i18n.svelte';
import { app } from '../state/app.svelte';

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

describe('formatDate in the time zone of the script', () => {
  it('shows a date-time in the zone the backend gave, and falls back to the browser zone for a bad name', () => {
    setLocale('en');
    app.timeZone = 'Asia/Tokyo';
    expect(formatDate('2026-10-12T18:00:00.000Z')).toMatch(/Oct 13, 2026.*03:00/);
    app.timeZone = 'Not/AZone';
    expect(formatDate('2026-10-12T18:00:00.000Z')).toMatch(/Oct 1[23], 2026/);
    app.timeZone = '';
  });
});

describe('shorten', () => {
  it('keeps short texts and collapses whitespace', () => {
    expect(shorten('  hello\n world ', 40)).toBe('hello world');
  });
  it('cuts long texts to the limit with an ellipsis', () => {
    const out = shorten('a'.repeat(60), 40);
    expect(out).toHaveLength(40);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('safeHttpUrl', () => {
  it('keeps http and https links and drops everything else', () => {
    expect(safeHttpUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(safeHttpUrl('http://example.com')).toBe('http://example.com');
    expect(safeHttpUrl('javascript:alert(1)')).toBe('');
    expect(safeHttpUrl('data:text/html,<b>x</b>')).toBe('');
    expect(safeHttpUrl('/relative/path')).toBe('');
    expect(safeHttpUrl('')).toBe('');
  });
});

describe('formatCount', () => {
  it('shows the number up to 99 and 99+ above', () => {
    expect(formatCount(1)).toBe('1');
    expect(formatCount(99)).toBe('99');
    expect(formatCount(100)).toBe('99+');
  });
});

describe('formatWorkMode', () => {
  it('names the work mode in the current language and returns nothing for an empty or unknown value', () => {
    setLocale('en');
    expect([formatWorkMode('no'), formatWorkMode('hybrid'), formatWorkMode('yes'), formatWorkMode(''), formatWorkMode('???')]).toEqual(['On-site', 'Hybrid', 'Remote', '', '']);
    setLocale('cs');
    expect([formatWorkMode('no'), formatWorkMode('hybrid'), formatWorkMode('yes')]).toEqual(['Na místě', 'Hybridně', 'Na dálku']);
    setLocale('en');
  });
});

describe('formatEmploymentType', () => {
  it('names the known types and shows an unknown code as it is', () => {
    setLocale('en');
    expect([formatEmploymentType('full_time'), formatEmploymentType('part_time'), formatEmploymentType('contractor'), formatEmploymentType('intern')]).toEqual(['Full-time', 'Part-time', 'Contractor', 'Intern']);
    expect(formatEmploymentType('full-time')).toBe('Full-time');
    expect(formatEmploymentType('seasonal')).toBe('seasonal');
    expect(formatEmploymentType('')).toBe('');
    setLocale('cs');
    expect(formatEmploymentType('full_time')).toBe('Plný úvazek');
    setLocale('en');
  });
});

describe('formatAiSalary', () => {
  it('makes the stored estimate readable and says it is an AI estimate', () => {
    setLocale('en');
    expect(formatAiSalary('95000 (80000-125000)', 'CZK')).toBe('95,000 (80,000–125,000) CZK/month, AI estimate');
    expect(formatAiSalary('95000 (80000-125000)', '')).toBe('95,000 (80,000–125,000) CZK/month, AI estimate');
    expect(formatAiSalary('3000 (2500-4000)', 'EUR')).toBe('3,000 (2,500–4,000) EUR/month, AI estimate');
    setLocale('cs');
    expect(formatAiSalary('95000 (80000-125000)', 'CZK')).toBe('95 000 (80 000–125 000) Kč/měsíc, odhad AI');
    expect(formatAiSalary('3000 (2500-4000)', 'EUR')).toBe('3 000 (2 500–4 000) EUR/měsíc, odhad AI');
    setLocale('en');
  });
  it('returns an empty or malformed text unchanged', () => {
    setLocale('en');
    expect(formatAiSalary('', 'CZK')).toBe('');
    expect(formatAiSalary('around 90k', 'CZK')).toBe('around 90k');
    expect(formatAiSalary('95000', 'CZK')).toBe('95000');
    expect(formatAiSalary('95000 (80000)', 'CZK')).toBe('95000 (80000)');
  });
});

describe('missing values (the transport can drop null properties)', () => {
  it('formatSalary gives an empty text when the salary fields are missing, not an error', () => {
    const job = { salary_currency: '', salary_period: '' } as unknown as Parameters<typeof formatSalary>[0];
    expect(formatSalary(job)).toBe('');
    expect(formatSalary({ ...job, salary_min: 50000 } as unknown as Parameters<typeof formatSalary>[0])).toContain('50');
  });

  it('formatEmploymentType, formatWorkMode and formatAiSalary survive undefined', () => {
    expect(formatEmploymentType(undefined as unknown as string)).toBe('');
    expect(formatWorkMode(undefined as unknown as string)).toBe('');
    expect(formatAiSalary(undefined as unknown as string, undefined as unknown as string)).toBe('');
  });
});
