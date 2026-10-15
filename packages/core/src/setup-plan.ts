import { PROFILE_KEYS } from './applications/placeholders';
import { INSTRUCTIONS_LINES, PROMPTS_VERSION } from './seed';
import { ALLOWED_VALUES, columnType, SHEETS } from './schema';
import { SETTING_KEYS, SETTINGS_DEFAULTS } from './settings';

export interface DropdownSpec {
  /** 1-based column number. */
  column: number;
  values: string[];
}

/** What setup() must create for one sheet. Column numbers are 1-based. */
export interface SheetSetup {
  name: string;
  headers: readonly string[];
  /** Formatted as plain text so a cell like "=IMPORTXML(...)" is stored as text, never evaluated. */
  textColumns: number[];
  checkboxColumns: number[];
  dropdowns: DropdownSpec[];
  seedRows: string[][];
}

/**
 * The 1-based columns of the sheet whose first row is `header` that hold the plan columns `numbers` (1-based numbers in
 * the plan). The columns are found by NAME: an older sheet got newer columns at its end, so the number of a column in
 * the plan is not its number in the sheet. A plan column the sheet lacks is left out.
 */
export function actualColumns(plan: SheetSetup, header: readonly string[], numbers: readonly number[]): number[] {
  const found: number[] = [];
  for (const number of numbers) {
    const name = plan.headers[number - 1];
    const at = name === undefined ? -1 : header.indexOf(name);
    if (at >= 0) found.push(at + 1);
  }
  return found;
}

/** Runs of neighbouring columns as [first, count], so a format can be applied in one call per run. */
export function columnSpans(columns: readonly number[]): Array<[number, number]> {
  const sorted = [...new Set(columns)].sort((a, b) => a - b);
  const spans: Array<[number, number]> = [];
  for (const column of sorted) {
    const last = spans[spans.length - 1];
    if (last !== undefined && last[0] + last[1] === column) last[1] += 1;
    else spans.push([column, 1]);
  }
  return spans;
}

function seedRowsFor(name: string): string[][] {
  // A new installation starts with the current prompts, so it is not asked to reset them.
  if (name === 'Settings') return SETTING_KEYS.map((key) => [key, key === 'ai_prompts_version' ? String(PROMPTS_VERSION) : SETTINGS_DEFAULTS[key]]);
  if (name === 'Profile') return PROFILE_KEYS.map((key) => [key, '']);
  if (name === 'INSTRUCTIONS') return INSTRUCTIONS_LINES.map((line) => [line]);
  return [];
}

export function buildSetupPlan(): SheetSetup[] {
  return Object.entries(SHEETS).map(([name, columns]) => {
    const headers = columns as readonly string[];
    const textColumns: number[] = [];
    const checkboxColumns: number[] = [];
    const dropdowns: DropdownSpec[] = [];
    headers.forEach((column, index) => {
      const number = index + 1;
      const type = columnType(column);
      if (type === 'string') textColumns.push(number);
      if (type === 'boolean') checkboxColumns.push(number);
      const allowed = ALLOWED_VALUES[`${name}.${column}`];
      if (allowed !== undefined) dropdowns.push({ column: number, values: allowed.filter((value) => value !== '') });
    });
    return { name, headers, textColumns, checkboxColumns, dropdowns, seedRows: seedRowsFor(name) };
  });
}
