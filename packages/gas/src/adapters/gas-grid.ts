import { needsLiteralWrite, type Cell, type SheetGrid } from '@jobhunters/core';

/**
 * One spreadsheet tab. setValues() evaluates text such as "=IMPORTXML(...)" as a formula even in a
 * plain-text column, so cells that start with "=" are written afterwards as rich text, which keeps them literal there.
 * Text that starts with + (a phone number), - or @ goes through setValues: rich text would turn "+420 ..." into "=+420 ...".
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
    this.sheet.getRange(row, 1, 1, values.length).setValues([values.map((cell) => (needsLiteralWrite(cell) ? '' : cell))]);
    values.forEach((cell, index) => {
      if (needsLiteralWrite(cell)) {
        const literal = SpreadsheetApp.newRichTextValue().setText(cell as string).build();
        this.sheet.getRange(row, index + 1).setRichTextValue(literal);
      }
    });
  }

  writeRow(row: number, values: Cell[]): void {
    this.write(row, values);
  }

  /**
   * Last row whose first column is filled. getLastRow() is not enough: a checkbox column can hold FALSE
   * in hundreds of otherwise empty rows, and new rows would then land far below the visible data.
   */
  private lastDataRow(): number {
    const last = this.sheet.getLastRow();
    if (last < 2) return 1;
    const first = this.sheet.getRange(1, 1, last, 1).getValues();
    for (let index = first.length - 1; index >= 1; index--) {
      if (first[index]![0] !== '') return index + 1;
    }
    return 1;
  }

  appendRow(values: Cell[]): void {
    this.write(this.lastDataRow() + 1, values);
  }

  deleteRows(startRow: number, count: number): void {
    this.sheet.deleteRows(startRow, count);
  }
}
