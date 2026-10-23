import { LIST_SORT_KEYS, sortKeysFor, type ListSortKey, type SortChoice } from './application-sort';
import { isApplicationStatus } from './status';

export type JobSort = 'newest' | 'oldest' | 'match_desc' | 'match_asc';
export const JOB_SORTS: readonly JobSort[] = ['newest', 'oldest', 'match_desc', 'match_asc'];

/** What the interface remembers for the user; stored in the setting ui_state. */
export interface UiState {
  /** Whether the list of applications is shown as a Kanban board. */
  applications_kanban: boolean;
  /** Whether the Kanban board hides columns without applications. */
  applications_hide_empty: boolean;
  /** Statuses selected in the list; empty = all. */
  applications_status_list: string[];
  /** Statuses selected (= columns shown) in the Kanban board; empty = all. */
  applications_status_board: string[];
  /** Whether the Jobs screen hides jobs that have an application. */
  jobs_hide_applied: boolean;
  /** Whether the Jobs screen hides jobs whose status is No. */
  jobs_hide_no: boolean;
  /** The gig switch of the Jobs screen: '' = all jobs, 'only' = only gigs, 'except' = everything but gigs. */
  jobs_gig: JobGigFilter;
  /** Order of the Jobs screen. */
  jobs_sort: JobSort;
  /** Order of the cards of each Kanban column; a status without an entry is ordered by hand. */
  applications_board_sort: Record<string, SortChoice>;
  /** Order of the list of applications. */
  applications_list_sort: SortChoice<ListSortKey>;
  /** Background colors of the entries in the Calendar, as #rrggbb; an empty text = the color of the theme. */
  calendar_colors: CalendarColors;
}

export const CALENDAR_COLOR_KEYS = ['interview', 'waiting', 'late'] as const;
export type CalendarColorKey = (typeof CALENDAR_COLOR_KEYS)[number];
export type CalendarColors = Record<CalendarColorKey, string>;
export const NO_CALENDAR_COLORS: Readonly<CalendarColors> = { interview: '', waiting: '', late: '' };
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export type JobGigFilter = '' | 'only' | 'except';
const JOB_GIG_FILTERS: readonly string[] = ['', 'only', 'except'];

export const DEFAULT_UI_STATE: Readonly<UiState> = { applications_kanban: false, applications_hide_empty: false, applications_status_list: [], applications_status_board: [], jobs_hide_applied: false, jobs_hide_no: false, jobs_gig: '', jobs_sort: 'newest', applications_board_sort: {}, applications_list_sort: { by: 'default', up: false }, calendar_colors: NO_CALENDAR_COLORS };

function statuses(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) return undefined;
  return [...new Set((value as string[]).filter(isApplicationStatus))];
}

function choiceOf(value: unknown): SortChoice<string> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const { by, up } = value as Record<string, unknown>;
  return typeof by === 'string' && typeof up === 'boolean' ? { by, up } : undefined;
}

/** A wrongly shaped value is invalid; an unknown status or a key the column does not offer is dropped. */
function boardSorts(value: unknown): Record<string, SortChoice> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const out: Record<string, SortChoice> = {};
  for (const [status, raw] of Object.entries(value)) {
    const choice = choiceOf(raw);
    if (choice === undefined) return undefined;
    if (isApplicationStatus(status) && (sortKeysFor(status) as readonly string[]).includes(choice.by)) out[status] = choice as SortChoice;
  }
  return out;
}

/** Missing fields keep their default; a field of the wrong type makes the whole value invalid. Unknown statuses are dropped. */
export function parseUiState(raw: string): UiState | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw.trim() === '' ? '{}' : raw);
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const entry = value as Record<string, unknown>;
  const out: UiState = { ...DEFAULT_UI_STATE, applications_status_list: [], applications_status_board: [], applications_board_sort: {}, applications_list_sort: { by: 'default', up: false }, calendar_colors: { ...NO_CALENDAR_COLORS } };
  for (const key of ['applications_kanban', 'applications_hide_empty', 'jobs_hide_applied', 'jobs_hide_no'] as const) {
    if (entry[key] === undefined) continue;
    if (typeof entry[key] !== 'boolean') return undefined;
    out[key] = entry[key];
  }
  for (const key of ['applications_status_list', 'applications_status_board'] as const) {
    if (entry[key] === undefined) continue;
    const parsed = statuses(entry[key]);
    if (parsed === undefined) return undefined;
    out[key] = parsed;
  }
  if (entry.jobs_gig !== undefined) {
    if (typeof entry.jobs_gig !== 'string' || !JOB_GIG_FILTERS.includes(entry.jobs_gig)) return undefined;
    out.jobs_gig = entry.jobs_gig as JobGigFilter;
  }
  if (entry.jobs_sort !== undefined) {
    if (typeof entry.jobs_sort !== 'string' || !(JOB_SORTS as readonly string[]).includes(entry.jobs_sort)) return undefined;
    out.jobs_sort = entry.jobs_sort as JobSort;
  }
  if (entry.applications_board_sort !== undefined) {
    const sorts = boardSorts(entry.applications_board_sort);
    if (sorts === undefined) return undefined;
    out.applications_board_sort = sorts;
  }
  if (entry.applications_list_sort !== undefined) {
    const choice = choiceOf(entry.applications_list_sort);
    if (choice === undefined || !(LIST_SORT_KEYS as readonly string[]).includes(choice.by)) return undefined;
    out.applications_list_sort = choice as SortChoice<ListSortKey>;
  }
  if (entry.calendar_colors !== undefined) {
    const colors = entry.calendar_colors;
    if (typeof colors !== 'object' || colors === null || Array.isArray(colors)) return undefined;
    for (const key of CALENDAR_COLOR_KEYS) {
      const color = (colors as Record<string, unknown>)[key];
      if (color === undefined) continue;
      if (typeof color !== 'string' || (color !== '' && !HEX_COLOR.test(color))) return undefined;
      out.calendar_colors[key] = color.toLowerCase();
    }
  }
  return out;
}

export function serializeUiState(state: UiState): string {
  return JSON.stringify(state);
}
