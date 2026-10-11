import { ValidationError, type ErrorParams } from './errors';
import { ALLOWED_VALUES, columnType, isNullableNumber } from './schema';

/** What SpreadsheetApp hands back from getValues(). */
export type Cell = string | number | boolean | Date | null;

export const WARNING_CODES = [
  'row_missing_id',
  'row_duplicate_id',
  'cell_not_a_number',
  'cell_not_a_boolean',
  'cell_not_allowed',
  'setting_invalid',
  'similar_job',
  'page_not_fetched',
  'active_application_exists',
  'template_missing',
  'document_create_failed',
] as const;
export type WarningCode = (typeof WARNING_CODES)[number];

/** A problem in data that was edited outside the app. Shown translated; never stops the app. */
export interface AppWarning {
  code: WarningCode;
  params: ErrorParams;
}

export interface DecodedRow<T> {
  item: T;
  /** 1-based row number in the sheet. */
  sheetRow: number;
  raw: Cell[];
}

export interface DecodedSheet<T> {
  header: string[];
  rows: DecodedRow<T>[];
  warnings: AppWarning[];
}

export function cellToString(cell: Cell | undefined): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? '' : cell.toISOString();
  return String(cell);
}

function decodeCell(sheet: string, row: number, column: string, cell: Cell | undefined, warnings: AppWarning[]): unknown {
  const warn = (code: AppWarning['code'], value: string): void => {
    warnings.push({ code, params: { sheet, row, column, value } });
  };
  const type = columnType(column);

  if (type === 'number') {
    if (typeof cell === 'number' && Number.isFinite(cell)) return cell;
    const text = cellToString(cell).trim();
    const fallback = isNullableNumber(column) ? null : 0;
    if (text === '') return fallback;
    const parsed = Number(text);
    if (Number.isFinite(parsed)) return parsed;
    warn('cell_not_a_number', text);
    return fallback;
  }

  if (type === 'boolean') {
    if (typeof cell === 'boolean') return cell;
    const text = cellToString(cell).trim().toLowerCase();
    if (text === 'true' || text === '1' || text === 'yes') return true;
    if (text === '' || text === 'false' || text === '0' || text === 'no') return false;
    warn('cell_not_a_boolean', text);
    return false;
  }

  const text = cellToString(cell);
  const allowed = ALLOWED_VALUES[`${sheet}.${column}`];
  if (allowed !== undefined && text !== '' && !allowed.includes(text)) warn('cell_not_allowed', text);
  return text;
}

/**
 * Reads a sheet by header name. Row 1 is the header. Extra and reordered columns are fine; a missing required
 * column throws. Blank rows are skipped silently; rows without a key or with a repeated key are skipped with a warning.
 */
export function decodeSheet<T>(
  sheet: string,
  columns: readonly string[],
  grid: readonly (readonly Cell[])[],
  keyColumn: string | null = 'id',
): DecodedSheet<T> {
  const header = (grid[0] ?? []).map(cellToString);
  const positions = columns.map((column) => {
    const index = header.indexOf(column);
    if (index < 0) throw new ValidationError('sheet_header_missing', `Sheet ${sheet} has no column ${column}`, { sheet, column });
    return index;
  });

  const rows: DecodedRow<T>[] = [];
  const warnings: AppWarning[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < grid.length; i++) {
    const raw = [...(grid[i] ?? [])];
    // An unchecked checkbox reads as FALSE; a row holding nothing else is still blank.
    if (raw.every((cell) => cell === false || cellToString(cell).trim() === '')) continue;
    const sheetRow = i + 1;
    const item: Record<string, unknown> = {};
    columns.forEach((column, c) => {
      item[column] = decodeCell(sheet, sheetRow, column, raw[positions[c]!], warnings);
    });

    if (keyColumn !== null) {
      const key = String(item[keyColumn] ?? '');
      if (key.trim() === '') {
        warnings.push({ code: 'row_missing_id', params: { sheet, row: sheetRow, value: '' } });
        continue;
      }
      if (seen.has(key)) {
        warnings.push({ code: 'row_duplicate_id', params: { sheet, row: sheetRow, value: key } });
        continue;
      }
      seen.add(key);
    }
    rows.push({ item: item as T, sheetRow, raw });
  }
  return { header, rows, warnings };
}

/** Text that Sheets would evaluate as a formula when written with setValues, even in a plain-text column. */
export function isFormulaLike(cell: Cell | undefined): boolean {
  return typeof cell === 'string' && /^[=+\-@]/.test(cell);
}

export function encodeCell(value: unknown): Cell {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (value instanceof Date) return value;
  return String(value);
}

/** Builds a full sheet row. Columns the app does not know keep the value from `existing`. */
export function encodeRow(columns: readonly string[], header: readonly string[], item: object, existing: readonly Cell[] = []): Cell[] {
  const width = Math.max(header.length, existing.length);
  const values: Cell[] = Array.from({ length: width }, (_, i) => existing[i] ?? '');
  const record = item as Record<string, unknown>;
  for (const column of columns) {
    const index = header.indexOf(column);
    if (index >= 0) values[index] = encodeCell(record[column]);
  }
  return values;
}
