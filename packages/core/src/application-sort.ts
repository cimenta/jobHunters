import type { ApplicationRow } from './catalog';

export const APPLICATION_SORT_KEYS = ['manual', 'match', 'created', 'salary', 'sent', 'waiting'] as const;
export type ApplicationSortKey = (typeof APPLICATION_SORT_KEYS)[number];
export type FieldSortKey = Exclude<ApplicationSortKey, 'manual'>;
export type ListSortKey = 'default' | FieldSortKey;
export const LIST_SORT_KEYS: readonly ListSortKey[] = ['default', 'match', 'created', 'salary', 'sent', 'waiting'];

/** `up` reverses the natural direction of the key (best, newest, longest first). */
export interface SortChoice<K extends string = ApplicationSortKey> {
  by: K;
  up: boolean;
}

/** What a sort reads from an application row; match and salary come from its job. */
export type SortableRow = Pick<ApplicationRow, 'match_percent' | 'salary_min' | 'salary_max' | 'salary_period' | 'created_at' | 'applied_at' | 'waiting_since' | 'last_activity_at'>;

/** The sort options of a Kanban column: waiting has days waiting, every status but draft has the date sent. */
export function sortKeysFor(status: string): readonly ApplicationSortKey[] {
  if (status === 'draft') return ['manual', 'match', 'created', 'salary'];
  if (status === 'waiting') return ['manual', 'match', 'created', 'salary', 'sent', 'waiting'];
  return ['manual', 'match', 'created', 'salary', 'sent'];
}

const MONTHLY_FACTOR: Record<string, number> = { hour: 160, day: 20, week: 4, month: 1, year: 1 / 12 };

/** A number, or undefined when it is missing (null, undefined and NaN all count as missing). */
function numberOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** The maximum of the ad's salary (otherwise the minimum) as a monthly amount; the currency is ignored. */
export function monthlySalary(row: Pick<SortableRow, 'salary_min' | 'salary_max' | 'salary_period'>): number | undefined {
  const amount = numberOf(row.salary_max) ?? numberOf(row.salary_min);
  if (amount === undefined) return undefined;
  return Math.round(amount * (MONTHLY_FACTOR[row.salary_period ?? ''] ?? 1));
}

/** Whole days since the application went to waiting; undefined when that is not known. */
export function waitingDays(waitingSince: string | undefined, nowMs: number): number | undefined {
  if (!waitingSince) return undefined;
  const since = Date.parse(waitingSince);
  if (Number.isNaN(since)) return undefined;
  return Math.max(0, Math.floor((nowMs - since) / 86_400_000));
}

type Comparable = number | string | undefined;

function valueOf(row: SortableRow, by: FieldSortKey): Comparable {
  switch (by) {
    case 'match':
      return numberOf(row.match_percent);
    case 'salary':
      return monthlySalary(row);
    case 'created':
      return row.created_at || undefined;
    case 'sent':
      return row.applied_at || undefined;
    case 'waiting':
      return row.waiting_since || undefined;
  }
}

/** Highest, newest or (waiting) longest first. For waiting that is the earliest start, so its natural order is ascending. */
const DESCENDING: Record<FieldSortKey, boolean> = { match: true, salary: true, created: true, sent: true, waiting: false };

/** A new array; stable. Rows without a value come last in both directions; ties go to the newest activity. */
export function sortApplications<T extends SortableRow>(rows: readonly T[], by: FieldSortKey, up: boolean): T[] {
  const sign = DESCENDING[by] !== up ? -1 : 1;
  const newest = (a: T, b: T): number => (a.last_activity_at < b.last_activity_at ? 1 : a.last_activity_at > b.last_activity_at ? -1 : 0);
  return [...rows].sort((a, b) => {
    const x = valueOf(a, by);
    const y = valueOf(b, by);
    if (x === undefined || y === undefined) return x === y ? newest(a, b) : x === undefined ? 1 : -1;
    return x === y ? newest(a, b) : x < y ? -sign : sign;
  });
}
