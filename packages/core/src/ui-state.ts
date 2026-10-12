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
  /** Order of the Jobs screen. */
  jobs_sort: JobSort;
}

export const DEFAULT_UI_STATE: Readonly<UiState> = { applications_kanban: false, applications_hide_empty: false, applications_status_list: [], applications_status_board: [], jobs_hide_applied: false, jobs_sort: 'newest' };

function statuses(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) return undefined;
  return [...new Set((value as string[]).filter(isApplicationStatus))];
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
  const out: UiState = { ...DEFAULT_UI_STATE, applications_status_list: [], applications_status_board: [] };
  for (const key of ['applications_kanban', 'applications_hide_empty', 'jobs_hide_applied'] as const) {
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
  if (entry.jobs_sort !== undefined) {
    if (typeof entry.jobs_sort !== 'string' || !(JOB_SORTS as readonly string[]).includes(entry.jobs_sort)) return undefined;
    out.jobs_sort = entry.jobs_sort as JobSort;
  }
  return out;
}

export function serializeUiState(state: UiState): string {
  return JSON.stringify(state);
}
