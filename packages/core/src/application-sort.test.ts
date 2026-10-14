import { describe, expect, it } from 'vitest';
import { LIST_SORT_KEYS, monthlySalary, sortApplications, sortKeysFor, waitingDays, type SortableRow } from './application-sort';

const row = (id: string, over: Partial<SortableRow> = {}): SortableRow & { id: string } => ({
  id, match_percent: null, salary_min: null, salary_max: null, salary_period: 'month', created_at: '', applied_at: '', waiting_since: '', last_activity_at: '2026-10-01T00:00:00.000Z', ...over,
});
const ids = (rows: readonly { id: string }[]): string[] => rows.map((r) => r.id);

describe('sortKeysFor', () => {
  it('offers the options of each status', () => {
    expect(sortKeysFor('draft')).toEqual(['manual', 'match', 'created', 'salary']);
    expect(sortKeysFor('sent')).toEqual(['manual', 'match', 'created', 'salary', 'sent']);
    expect(sortKeysFor('interview')).toEqual(['manual', 'match', 'created', 'salary', 'sent']);
    expect(sortKeysFor('waiting')).toEqual(['manual', 'match', 'created', 'salary', 'sent', 'waiting']);
    expect(sortKeysFor('not-a-status')).toEqual(['manual', 'match', 'created', 'salary', 'sent']);
    expect(LIST_SORT_KEYS).toEqual(['default', 'match', 'created', 'salary', 'sent', 'waiting']);
  });
});

describe('monthlySalary', () => {
  it('uses the maximum, otherwise the minimum, as a monthly amount', () => {
    expect(monthlySalary(row('a', { salary_min: 60000, salary_max: 80000 }))).toBe(80000);
    expect(monthlySalary(row('a', { salary_min: 60000 }))).toBe(60000);
    expect(monthlySalary(row('a', { salary_max: 250, salary_period: 'hour' }))).toBe(40000);
    expect(monthlySalary(row('a', { salary_max: 2000, salary_period: 'day' }))).toBe(40000);
    expect(monthlySalary(row('a', { salary_max: 10000, salary_period: 'week' }))).toBe(40000);
    expect(monthlySalary(row('a', { salary_max: 1200000, salary_period: 'year' }))).toBe(100000);
    expect(monthlySalary(row('a', { salary_max: 50000, salary_period: '' }))).toBe(50000);
  });
  it('is missing for no number, null, undefined or NaN', () => {
    expect(monthlySalary(row('a'))).toBeUndefined();
    expect(monthlySalary({ ...row('a'), salary_min: undefined, salary_max: undefined } as unknown as SortableRow)).toBeUndefined();
    expect(monthlySalary(row('a', { salary_max: Number.NaN }))).toBeUndefined();
  });
});

describe('sortApplications', () => {
  const rows = [
    row('low', { match_percent: 40, salary_max: 50000, created_at: '2026-10-01T10:00:00.000Z', applied_at: '2026-10-02T10:00:00.000Z', waiting_since: '2026-10-10T10:00:00.000Z' }),
    row('high', { match_percent: 90, salary_max: 90000, created_at: '2026-10-05T10:00:00.000Z', applied_at: '2026-10-06T10:00:00.000Z', waiting_since: '2026-10-01T10:00:00.000Z' }),
    row('none'),
  ];
  it('puts the best, newest or longest first by default and reverses with up', () => {
    expect(ids(sortApplications(rows, 'match', false))).toEqual(['high', 'low', 'none']);
    expect(ids(sortApplications(rows, 'match', true))).toEqual(['low', 'high', 'none']);
    expect(ids(sortApplications(rows, 'salary', false))).toEqual(['high', 'low', 'none']);
    expect(ids(sortApplications(rows, 'created', false))).toEqual(['high', 'low', 'none']);
    expect(ids(sortApplications(rows, 'created', true))).toEqual(['low', 'high', 'none']);
    expect(ids(sortApplications(rows, 'sent', false))).toEqual(['high', 'low', 'none']);
    expect(ids(sortApplications(rows, 'waiting', false))).toEqual(['high', 'low', 'none']); // waiting since 10-01 = longest
    expect(ids(sortApplications(rows, 'waiting', true))).toEqual(['low', 'high', 'none']);
  });
  it('keeps rows without a value last in both directions and does not change the input', () => {
    const copy = [...rows];
    expect(ids(sortApplications(rows, 'match', true)).at(-1)).toBe('none');
    expect(rows).toEqual(copy);
  });
  it('treats undefined (the real transport drops null) like a missing value', () => {
    const odd = [{ ...row('u'), match_percent: undefined } as unknown as SortableRow & { id: string }, row('m', { match_percent: 10 })];
    expect(ids(sortApplications(odd, 'match', false))).toEqual(['m', 'u']);
  });
  it('breaks ties by the newest activity', () => {
    const tie = [row('old', { match_percent: 50, last_activity_at: '2026-10-01T00:00:00.000Z' }), row('new', { match_percent: 50, last_activity_at: '2026-10-09T00:00:00.000Z' })];
    expect(ids(sortApplications(tie, 'match', false))).toEqual(['new', 'old']);
    expect(ids(sortApplications(tie, 'match', true))).toEqual(['new', 'old']);
  });
});

describe('waitingDays', () => {
  const now = Date.parse('2026-10-14T12:00:00.000Z');
  it('counts whole days and is missing without a start', () => {
    expect(waitingDays('2026-10-09T12:00:00.000Z', now)).toBe(5);
    expect(waitingDays('2026-10-14T10:00:00.000Z', now)).toBe(0);
    expect(waitingDays('2026-10-20T12:00:00.000Z', now)).toBe(0);
    expect(waitingDays('', now)).toBeUndefined();
    expect(waitingDays(undefined, now)).toBeUndefined();
    expect(waitingDays('garbage', now)).toBeUndefined();
  });
});
