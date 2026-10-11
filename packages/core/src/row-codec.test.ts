import { describe, expect, it } from 'vitest';
import { AppError } from './errors';
import { cellToString, decodeSheet, encodeRow, isFormulaLike, type Cell } from './row-codec';
import { SHEETS } from './schema';
import type { Application, Company, Job } from './types';

const rowOf = (columns: readonly string[], values: Record<string, Cell>): Cell[] => columns.map((c) => values[c] ?? '');

describe('decodeSheet', () => {
  it('reads by header name, tolerating reordered and extra columns', () => {
    const grid: Cell[][] = [
      ['notes', 'extra', 'id', 'website', 'name'],
      ['n', 'x', 'c1', 'w', 'Acme'],
    ];
    const { rows } = decodeSheet<Company>('Companies', SHEETS.Companies, grid);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ item: { id: 'c1', name: 'Acme', website: 'w', notes: 'n' }, sheetRow: 2 });
  });

  it('throws a coded error when a required column is missing', () => {
    const grid: Cell[][] = [['id', 'name', 'notes']];
    try {
      decodeSheet<Company>('Companies', SHEETS.Companies, grid);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({ code: 'sheet_header_missing', params: { sheet: 'Companies', column: 'website' } });
    }
  });

  it('turns Date cells into ISO strings and numbers in text columns into text', () => {
    const grid: Cell[][] = [
      [...SHEETS.Companies],
      rowOf(SHEETS.Companies, { id: 'c1', name: 5, notes: new Date('2026-10-10T08:00:00.000Z') }),
    ];
    const item = decodeSheet<Company>('Companies', SHEETS.Companies, grid).rows[0]!.item;
    expect(item.name).toBe('5');
    expect(item.notes).toBe('2026-10-10T08:00:00.000Z');
  });

  it('decodes numbers and booleans, with fallbacks and warnings for garbage', () => {
    const grid: Cell[][] = [
      [...SHEETS.Jobs],
      rowOf(SHEETS.Jobs, { id: 'j1', salary_min: '', salary_max: 50000, offline_strikes: '', is_gig: 'TRUE' }),
      rowOf(SHEETS.Jobs, { id: 'j2', salary_min: 'abc', is_gig: 'maybe', offline_strikes: ' 2 ' }),
      rowOf(SHEETS.Jobs, { id: 'j3', is_gig: true }),
      rowOf(SHEETS.Jobs, { id: 'j4', is_gig: 'no' }),
    ];
    const { rows, warnings } = decodeSheet<Job>('Jobs', SHEETS.Jobs, grid);
    const byId = Object.fromEntries(rows.map((r) => [r.item.id, r.item]));
    expect(byId.j1).toMatchObject({ salary_min: null, salary_max: 50000, offline_strikes: 0, is_gig: true });
    expect(byId.j2).toMatchObject({ salary_min: null, is_gig: false, offline_strikes: 2 });
    expect(byId.j3!.is_gig).toBe(true);
    expect(byId.j4!.is_gig).toBe(false);
    expect(warnings).toEqual([
      { code: 'cell_not_a_boolean', params: { sheet: 'Jobs', row: 3, column: 'is_gig', value: 'maybe' } },
      { code: 'cell_not_a_number', params: { sheet: 'Jobs', row: 3, column: 'salary_min', value: 'abc' } },
    ]);
  });

  it('keeps an unexpected value in a restricted column and warns', () => {
    const grid: Cell[][] = [
      [...SHEETS.Applications],
      rowOf(SHEETS.Applications, { id: 'a1', status: 'weird' }),
      rowOf(SHEETS.Applications, { id: 'a2', status: '' }),
      rowOf(SHEETS.Applications, { id: 'a3', status: 'sent' }),
    ];
    const { rows, warnings } = decodeSheet<Application>('Applications', SHEETS.Applications, grid);
    expect(rows.map((r) => r.item.status)).toEqual(['weird', '', 'sent']);
    expect(warnings).toEqual([
      { code: 'cell_not_allowed', params: { sheet: 'Applications', row: 2, column: 'status', value: 'weird' } },
    ]);
  });

  it('skips blank rows silently, and rows without an id or with a repeated id with a warning', () => {
    const grid: Cell[][] = [
      [...SHEETS.Companies],
      ['', '', '', ''],
      ['c1', 'Acme', '', ''],
      ['', 'No id', '', ''],
      ['c1', 'Duplicate', '', ''],
    ];
    const { rows, warnings } = decodeSheet<Company>('Companies', SHEETS.Companies, grid);
    expect(rows.map((r) => r.item.name)).toEqual(['Acme']);
    expect(warnings).toEqual([
      { code: 'row_missing_id', params: { sheet: 'Companies', row: 4, value: '' } },
      { code: 'row_duplicate_id', params: { sheet: 'Companies', row: 5, value: 'c1' } },
    ]);
  });

  it('treats a row that only holds unchecked checkboxes (FALSE) as blank', () => {
    const grid: Cell[][] = [
      [...SHEETS.Jobs],
      rowOf(SHEETS.Jobs, { is_gig: false }),
      rowOf(SHEETS.Jobs, { id: 'j1', is_gig: false }),
    ];
    const { rows, warnings } = decodeSheet<Job>('Jobs', SHEETS.Jobs, grid);
    expect(rows.map((r) => r.item.id)).toEqual(['j1']);
    expect(warnings).toEqual([]);
  });

  it('does no id checks for sheets without a key column', () => {
    const grid: Cell[][] = [[...SHEETS.StatusHistory], ['a1', 'draft', 'sent', 't'], ['a1', 'sent', 'waiting', 't2']];
    const { rows, warnings } = decodeSheet('StatusHistory', SHEETS.StatusHistory, grid, null);
    expect(rows).toHaveLength(2);
    expect(warnings).toEqual([]);
  });
});

describe('encodeRow', () => {
  it('writes values in header order and keeps columns it does not know', () => {
    const header = ['name', 'extra', 'id', 'notes', 'website'];
    const existing: Cell[] = ['Old', 'keep me', 'c1', 'n', 'w'];
    const out = encodeRow(SHEETS.Companies, header, { id: 'c1', name: 'New', website: 'w', notes: 'n' }, existing);
    expect(out).toEqual(['New', 'keep me', 'c1', 'n', 'w']);
  });

  it('encodes null as empty, and keeps numbers and booleans typed', () => {
    const out = encodeRow(['id', 'salary_min', 'is_gig', 'attempt'], ['id', 'salary_min', 'is_gig', 'attempt'], {
      id: 'j1', salary_min: null, is_gig: true, attempt: 2,
    });
    expect(out).toEqual(['j1', '', true, 2]);
  });

  it('never alters text that looks like a formula', () => {
    expect(encodeRow(['id', 'notes'], ['id', 'notes'], { id: 'c1', notes: '=IMPORTXML("x")' })).toEqual(['c1', '=IMPORTXML("x")']);
  });
});

describe('isFormulaLike', () => {
  it('flags text a spreadsheet could evaluate as a formula', () => {
    for (const text of ['=1+1', '+1+1', '-1+1', '@SUM(1)', '=IMPORTXML("x")']) expect(isFormulaLike(text), text).toBe(true);
  });

  it('leaves ordinary cells alone', () => {
    for (const cell of ['', 'Acme', ' =1', 'a=b', 5, true, null, new Date()]) expect(isFormulaLike(cell), String(cell)).toBe(false);
  });
});

describe('cellToString', () => {
  it('handles empty, numbers, booleans and dates', () => {
    expect(cellToString(null)).toBe('');
    expect(cellToString(undefined)).toBe('');
    expect(cellToString(3)).toBe('3');
    expect(cellToString(false)).toBe('false');
    expect(cellToString(new Date('invalid'))).toBe('');
  });
});
