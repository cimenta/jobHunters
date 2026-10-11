import { NO_LOCK, type Lock } from './lock';
import { decodeSheet, encodeRow, type AppWarning } from './row-codec';
import { SHEETS } from './schema';
import type { SheetGrid } from './sheet-grid';

export interface KeyValueStore {
  getAll(): Record<string, string>;
  set(key: string, value: string): void;
}

export class InMemoryKeyValueStore implements KeyValueStore {
  private readonly values = new Map<string, string>();

  constructor(initial: Readonly<Record<string, string>> = {}) {
    for (const [key, value] of Object.entries(initial)) this.values.set(key, value);
  }

  getAll(): Record<string, string> {
    return Object.fromEntries(this.values);
  }

  set(key: string, value: string): void {
    this.values.set(key, value);
  }
}

interface KeyValueRow {
  key: string;
  value: string;
}

/** Settings and Profile sheets: one row per key. */
export class SheetKeyValueStore implements KeyValueStore {
  constructor(
    private readonly sheet: string,
    private readonly grid: SheetGrid,
    private readonly lock: Lock = NO_LOCK,
    private readonly onWarnings: (warnings: AppWarning[]) => void = () => {},
  ) {}

  private load() {
    const decoded = decodeSheet<KeyValueRow>(this.sheet, SHEETS.Settings, this.grid.readAll(), 'key');
    if (decoded.warnings.length > 0) this.onWarnings(decoded.warnings);
    return decoded;
  }

  getAll(): Record<string, string> {
    return Object.fromEntries(this.load().rows.map((row) => [row.item.key, row.item.value]));
  }

  set(key: string, value: string): void {
    this.lock.run(() => {
      const decoded = this.load();
      const found = decoded.rows.find((row) => row.item.key === key);
      if (found) {
        this.grid.writeRow(found.sheetRow, encodeRow(SHEETS.Settings, decoded.header, { key, value }, found.raw));
      } else {
        this.grid.appendRow(encodeRow(SHEETS.Settings, decoded.header, { key, value }));
      }
    });
  }
}
