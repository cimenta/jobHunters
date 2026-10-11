import { isFormulaLike, type Cell, type SheetGrid } from '@jobhunters/core';

/**
 * One spreadsheet tab. setValues() evaluates text such as "=IMPORTXML(...)" as a formula even in a
 * plain-text column, so formula-like cells are written afterwards as rich text, which is always literal.
 */
export class GasSheetGrid implements SheetGrid {
  constructor(private readonly sheet: GoogleAppsScript.Spreadsheet.Sheet) {}

  readAll(): Cell[][] {
    const rows = this.sheet.getLastRow();
    const columns = this.sheet.getLastColumn();
    if (rows === 0 || columns === 0) return [];
    return this.sheet.getRange(1, 1, rows, columns).getValues() as Cell[][];
  }

  private write(row: number, values: Cell[]): void {
    this.sheet.getRange(row, 1, 1, values.length).setValues([values.map((cell) => (isFormulaLike(cell) ? '' : cell))]);
    values.forEach((cell, index) => {
      if (isFormulaLike(cell)) {
        const literal = SpreadsheetApp.newRichTextValue().setText(cell as string).build();
        this.sheet.getRange(row, index + 1).setRichTextValue(literal);
      }
    });
  }

  writeRow(row: number, values: Cell[]): void {
    this.write(row, values);
  }

  appendRow(values: Cell[]): void {
    this.write(Math.max(this.sheet.getLastRow(), 1) + 1, values);
  }

  deleteRows(startRow: number, count: number): void {
    this.sheet.deleteRows(startRow, count);
  }
}
