import { DuplicateIdError, NotFoundError, ValidationError } from './errors';
import { NO_LOCK, type Lock } from './lock';
import type { AppendLog, Repository } from './repository';
import { decodeSheet, encodeRow, type AppWarning, type DecodedSheet } from './row-codec';
import type { SheetGrid } from './sheet-grid';

export class SheetRepository<T extends { id: string }> implements Repository<T> {
  constructor(
    private readonly sheet: string,
    private readonly columns: readonly string[],
    private readonly grid: SheetGrid,
    private readonly lock: Lock = NO_LOCK,
    private readonly onWarnings: (warnings: AppWarning[]) => void = () => {},
  ) {}

  private load(): DecodedSheet<T> {
    const decoded = decodeSheet<T>(this.sheet, this.columns, this.grid.readAll());
    if (decoded.warnings.length > 0) this.onWarnings(decoded.warnings);
    return decoded;
  }

  list(): T[] {
    return this.load().rows.map((row) => row.item);
  }

  get(id: string): T | undefined {
    return this.load().rows.find((row) => row.item.id === id)?.item;
  }

  insert(item: T): T {
    return this.lock.run(() => {
      if (!item.id) throw new ValidationError('row_id_required', 'A row needs a non-empty id');
      const decoded = this.load();
      if (decoded.rows.some((row) => row.item.id === item.id)) {
        throw new DuplicateIdError('duplicate_id', `Row ${item.id} already exists`, { id: item.id });
      }
      this.grid.appendRow(encodeRow(this.columns, decoded.header, item));
      return { ...item };
    });
  }

  update(id: string, patch: Partial<Omit<T, 'id'>>): T {
    return this.lock.run(() => {
      const decoded = this.load();
      const found = decoded.rows.find((row) => row.item.id === id);
      if (!found) throw new NotFoundError('row_not_found', `Row ${id} not found`, { id });
      const next = { ...found.item, ...patch, id } as T;
      this.grid.writeRow(found.sheetRow, encodeRow(this.columns, decoded.header, next, found.raw));
      return { ...next };
    });
  }

  remove(id: string): void {
    this.lock.run(() => {
      const found = this.load().rows.find((row) => row.item.id === id);
      if (!found) throw new NotFoundError('row_not_found', `Row ${id} not found`, { id });
      this.grid.deleteRows(found.sheetRow, 1);
    });
  }
}

/** Append-only sheet (StatusHistory, Log). With `maxRows` the oldest rows are dropped. */
export class SheetAppendLog<T extends object> implements AppendLog<T> {
  constructor(
    private readonly sheet: string,
    private readonly columns: readonly string[],
    private readonly grid: SheetGrid,
    private readonly lock: Lock = NO_LOCK,
    private readonly maxRows?: number,
  ) {}

  append(entry: T): void {
    this.lock.run(() => {
      const all = this.grid.readAll();
      const decoded = decodeSheet(this.sheet, this.columns, all, null);
      this.grid.appendRow(encodeRow(this.columns, decoded.header, entry));
      const total = Math.max(all.length - 1, 0) + 1;
      if (this.maxRows !== undefined && total > this.maxRows) this.grid.deleteRows(2, total - this.maxRows);
    });
  }

  list(): T[] {
    return decodeSheet<T>(this.sheet, this.columns, this.grid.readAll(), null).rows.map((row) => row.item);
  }
}
