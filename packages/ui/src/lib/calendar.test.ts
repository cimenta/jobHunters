import type { CalendarInterview, CalendarWaiting } from '@jobhunters/core';
import { describe, expect, it } from 'vitest';
import { buildMonth, dayKey, monthOf, shiftMonth } from './calendar';

const interview = (id: string, datetime: string): CalendarInterview => ({ id, datetime, channel: 'video', summary: '', application_id: 'a', job_id: 'j', company_name: 'X', job_title: 'Y' });
const waiting = (id: string, start: string, due_at: string): CalendarWaiting => ({ application_id: id, job_id: 'j', start, due_at, company_name: 'X', job_title: 'Y' });

describe('dayKey', () => {
  it('keeps a date and reads a date-time in the zone', () => {
    expect(dayKey('2026-10-20')).toBe('2026-10-20');
    expect(dayKey('2026-10-20T12:00:00.000Z')).toBe('2026-10-20');
    expect(dayKey('')).toBe('');
    expect(dayKey('nonsense')).toBe('');
  });
});

describe('months', () => {
  it('moves across years', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(monthOf('2026-10-23')).toBe('2026-10');
  });
});

describe('buildMonth', () => {
  it('makes whole Monday-first weeks around the month', () => {
    const weeks = buildMonth('2026-10', [], [], '2026-10-23');
    expect(weeks).toHaveLength(5);
    expect(weeks[0]!.days[0]!.date).toBe('2026-09-28');
    expect(weeks[0]!.days[0]!.inMonth).toBe(false);
    expect(weeks[0]!.days[3]!).toMatchObject({ date: '2026-10-01', number: 1, inMonth: true });
    expect(weeks[4]!.days[6]!.date).toBe('2026-11-01');
    expect(weeks.flatMap((w) => w.days).filter((d) => d.today).map((d) => d.date)).toEqual(['2026-10-23']);
  });
  it('puts the interviews on their day, in time order', () => {
    const weeks = buildMonth('2026-10', [interview('b', '2026-10-27T16:00:00.000Z'), interview('a', '2026-10-27T13:00:00.000Z'), interview('z', '2026-12-01T10:00:00.000Z')], [], '2026-10-23');
    const day = weeks[4]!.days[1]!;
    expect(day.date).toBe('2026-10-27');
    expect(day.interviews.map((i) => i.id)).toEqual(['a', 'b']);
    expect(weeks.flatMap((w) => w.days).flatMap((d) => d.interviews)).toHaveLength(2);
  });
  it('draws a waiting across weeks, cut at the week edges, red once the reminder has passed', () => {
    const weeks = buildMonth('2026-10', [], [waiting('a', '2026-10-06T08:00:00.000Z', '2026-10-20')], '2026-10-23');
    const bars = weeks.map((w) => w.bars[0]);
    expect(bars[0]).toBeUndefined();
    expect(bars[1]).toMatchObject({ from: 2, to: 8, cutLeft: false, cutRight: true, late: true, dueHere: false });
    expect(bars[2]).toMatchObject({ from: 1, to: 8, cutLeft: true, cutRight: true });
    expect(bars[3]).toMatchObject({ from: 1, to: 3, cutLeft: true, cutRight: false, dueHere: true });
    expect(bars[4]).toBeUndefined();
  });
  it('keeps the same lane for a waiting in every week and gives overlapping ones different lanes', () => {
    const weeks = buildMonth('2026-10', [], [waiting('a', '2026-10-14', '2026-10-28'), waiting('b', '2026-10-21', '2026-11-04')], '2026-10-23');
    const lane = (week: number, id: string): number | undefined => weeks[week]!.bars.find((b) => b.waiting.application_id === id)?.lane;
    expect(lane(2, 'a')).toBe(0);
    expect(lane(3, 'a')).toBe(0);
    expect(lane(4, 'a')).toBe(0);
    expect(lane(3, 'b')).toBe(1);
    expect(lane(4, 'b')).toBe(1);
    expect(weeks[3]!.lanes).toBe(2);
    expect(weeks[0]!.lanes).toBe(0);
  });
  it('lets a waiting without a reminder run to today and a later one reuse a free lane', () => {
    const weeks = buildMonth('2026-10', [], [waiting('a', '2026-10-06', ''), waiting('b', '2026-10-24', '2026-10-25')], '2026-10-10');
    expect(weeks[1]!.bars[0]).toMatchObject({ from: 2, to: 7, late: false });
    expect(weeks[3]!.bars[0]).toMatchObject({ lane: 0 });
  });
});
