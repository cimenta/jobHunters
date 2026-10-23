import type { CalendarInterview, CalendarWaiting } from '@jobhunters/core';
import { plusDays, zone } from './format';
import { ui } from './i18n.svelte';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD of a date or a date-time; a date-time is read in the script's time zone. Anything else gives ''. */
export function dayKey(value: string): string {
  if (DATE_ONLY.test(value)) return value;
  const date = new Date(value);
  if (value === '' || Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: zone() }).formatToParts(date);
  const part = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Today in the script's time zone. */
export function todayKey(now: Date = new Date()): string {
  return dayKey(now.toISOString());
}

/** The time of a date-time (hours and minutes) in the script's time zone, in the current language. */
export function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(ui.locale, { hour: '2-digit', minute: '2-digit', timeZone: zone() });
}

/** The month as YYYY-MM. */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

export function shiftMonth(month: string, by: number): string {
  const [year, number] = month.split('-').map(Number);
  const index = year! * 12 + (number! - 1) + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export interface CalendarDay {
  date: string;
  /** The day of the month, 1-31. */
  number: number;
  inMonth: boolean;
  today: boolean;
  interviews: CalendarInterview[];
}

export interface CalendarBar {
  waiting: CalendarWaiting;
  /** Grid columns of the week, 1-based; `to` is exclusive (1-8). */
  from: number;
  to: number;
  lane: number;
  /** The waiting began before this week / goes on after it (the bar is drawn square on that side). */
  cutLeft: boolean;
  cutRight: boolean;
  /** The reminder date has passed. */
  late: boolean;
  /** True on the week that holds the reminder date, where the bar carries the bell. */
  dueHere: boolean;
}

export interface CalendarWeek {
  days: CalendarDay[];
  bars: CalendarBar[];
  /** How many lanes of bars the week needs (every week of the month uses the same lane of a waiting). */
  lanes: number;
}

interface Span {
  waiting: CalendarWaiting;
  start: string;
  end: string;
  late: boolean;
  lane: number;
}

/** The days a waiting covers: from its start to the day of its reminder, or to today when there is no reminder. */
function spanOf(waiting: CalendarWaiting, today: string): Omit<Span, 'lane'> {
  const due = dayKey(waiting.due_at);
  const start = dayKey(waiting.start) || due || today;
  const end = due || (today > start ? today : start);
  return { waiting, start, end: end < start ? start : end, late: due !== '' && due < today };
}

/** Weeks start on Monday and cover the whole month, with the days of the neighbouring months that fill the first and last week. */
export function buildMonth(month: string, interviews: readonly CalendarInterview[], waitings: readonly CalendarWaiting[], today: string): CalendarWeek[] {
  const first = `${month}-01`;
  const weekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const gridStart = plusDays(first, -weekday);
  const last = plusDays(`${shiftMonth(month, 1)}-01`, -1);
  const lastWeekday = (new Date(`${last}T00:00:00Z`).getUTCDay() + 6) % 7;
  const gridEnd = plusDays(last, 6 - lastWeekday);

  const byDay = new Map<string, CalendarInterview[]>();
  for (const interview of interviews) {
    const key = dayKey(interview.datetime);
    if (key === '') continue;
    byDay.set(key, [...(byDay.get(key) ?? []), interview]);
  }

  // One lane per waiting for the whole month, the first one that is free over all of its days.
  const spans: Span[] = waitings
    .map((waiting) => ({ ...spanOf(waiting, today), lane: 0 }))
    .filter((span) => span.end >= gridStart && span.start <= gridEnd)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.end < b.end ? -1 : a.end > b.end ? 1 : 0));
  const laneEnds: string[] = [];
  for (const span of spans) {
    let lane = laneEnds.findIndex((end) => end < span.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = span.end;
    span.lane = lane;
  }

  const weeks: CalendarWeek[] = [];
  for (let weekStart = gridStart; weekStart <= gridEnd; weekStart = plusDays(weekStart, 7)) {
    const weekEnd = plusDays(weekStart, 6);
    const days: CalendarDay[] = Array.from({ length: 7 }, (_, index) => {
      const date = plusDays(weekStart, index);
      return {
        date,
        number: Number(date.slice(8)),
        inMonth: monthOf(date) === month,
        today: date === today,
        interviews: [...(byDay.get(date) ?? [])].sort((a, b) => (a.datetime < b.datetime ? -1 : a.datetime > b.datetime ? 1 : 0)),
      };
    });
    const bars: CalendarBar[] = spans
      .filter((span) => span.end >= weekStart && span.start <= weekEnd)
      .map((span) => {
        const left = span.start < weekStart ? weekStart : span.start;
        const right = span.end > weekEnd ? weekEnd : span.end;
        const from = days.findIndex((day) => day.date === left) + 1;
        const to = days.findIndex((day) => day.date === right) + 2;
        return {
          waiting: span.waiting, from, to, lane: span.lane, cutLeft: span.start < weekStart, cutRight: span.end > weekEnd, late: span.late,
          dueHere: span.waiting.due_at !== '' && span.end <= weekEnd && span.end >= weekStart,
        };
      });
    weeks.push({ days, bars, lanes: bars.reduce((most, bar) => Math.max(most, bar.lane + 1), 0) });
  }
  return weeks;
}
