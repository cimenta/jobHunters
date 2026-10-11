import { PROFILE_KEYS } from './applications/placeholders';
import { INSTRUCTIONS_LINES } from './seed';
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

function seedRowsFor(name: string): string[][] {
  if (name === 'Settings') return SETTING_KEYS.map((key) => [key, SETTINGS_DEFAULTS[key]]);
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
