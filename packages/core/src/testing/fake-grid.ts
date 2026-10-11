import type { Cell } from '../row-codec';
import type { SheetGrid } from '../sheet-grid';

export class FakeGrid implements SheetGrid {
  constructor(public rows: Cell[][] = []) {}

  static withHeader(columns: readonly string[]): FakeGrid {
    return new FakeGrid([[...columns]]);
  }

  readAll(): Cell[][] {
    return this.rows.map((row) => [...row]);
  }

  writeRow(row: number, values: Cell[]): void {
    this.rows[row - 1] = [...values];
  }

  appendRow(values: Cell[]): void {
    this.rows.push([...values]);
  }

  deleteRows(startRow: number, count: number): void {
    this.rows.splice(startRow - 1, count);
  }
}
