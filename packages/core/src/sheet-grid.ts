import type { Cell } from './row-codec';

/** One sheet as a grid of cells. The Apps Script implementation wraps a Sheet; tests use FakeGrid. */
export interface SheetGrid {
  /** The whole used range including the header row (row 1). */
  readAll(): Cell[][];
  /** Overwrites the 1-based row. */
  writeRow(row: number, values: Cell[]): void;
  appendRow(values: Cell[]): void;
  deleteRows(startRow: number, count: number): void;
}
