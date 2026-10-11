import { describe, expect, it } from 'vitest';
import type { Lock } from './lock';
import { NO_LOCK } from './lock';
import type { AppWarning, Cell } from './row-codec';
import { SHEETS } from './schema';
import { SheetAppendLog, SheetRepository } from './sheet-repository';
import { FakeGrid } from './testing/fake-grid';
import type { Company, LogEntry } from './types';

const columns = SHEETS.Companies;

function repoWith(rows: Cell[][], header: readonly string[] = columns, lock: Lock = NO_LOCK) {
  const grid = new FakeGrid([[...header], ...rows]);
  const warnings: AppWarning[] = [];
  const repo = new SheetRepository<Company>('Companies', columns, grid, lock, (w) => warnings.push(...w));
  return { grid, warnings, repo };
}

describe('SheetRepository', () => {
  it('reads rows another writer added, with reordered and extra columns', () => {
    const { repo } = repoWith([['Acme', 'x', 'c1', 'n', 'w']], ['name', 'extra', 'id', 'notes', 'website']);
    expect(repo.get('c1')).toEqual({ id: 'c1', name: 'Acme', website: 'w', notes: 'n' });
  });

  it('keeps the data of unknown columns when it updates a row', () => {
    const { repo, grid } = repoWith([['Acme', 'keep me', 'c1', 'n', 'w']], ['name', 'extra', 'id', 'notes', 'website']);
    repo.update('c1', { name: 'New' });
    expect(grid.rows[1]).toEqual(['New', 'keep me', 'c1', 'n', 'w']);
  });

  it('appends below existing rows in header order', () => {
    const { repo, grid } = repoWith([['c1', 'Acme', '', '']]);
    repo.insert({ id: 'c2', name: 'Beta', website: '', notes: '' });
    expect(grid.rows[2]).toEqual(['c2', 'Beta', '', '']);
  });

  it('skips bad rows, reports them and keeps working', () => {
    const { repo, warnings } = repoWith([
      ['c1', 'Acme', '', ''],
      ['', 'No id', '', ''],
      ['c1', 'Dup', '', ''],
    ]);
    expect(repo.list().map((r) => r.name)).toEqual(['Acme']);
    expect(warnings.map((w) => w.code)).toEqual(['row_missing_id', 'row_duplicate_id']);
    repo.insert({ id: 'c3', name: 'Gamma', website: '', notes: '' });
    expect(repo.list()).toHaveLength(2);
  });

  it('stores formula-looking text verbatim', () => {
    const { repo, grid } = repoWith([]);
    repo.insert({ id: 'c1', name: 'Acme', website: '', notes: '=1+1' });
    expect(grid.rows[1]).toEqual(['c1', 'Acme', '', '=1+1']);
  });

  it('runs every write inside the lock and releases it when the write fails', () => {
    let held = 0;
    let maxHeld = 0;
    const lock: Lock = {
      run<T>(fn: () => T): T {
        held++;
        maxHeld = Math.max(maxHeld, held);
        try {
          return fn();
        } finally {
          held--;
        }
      },
    };
    const { repo } = repoWith([], columns, lock);
    repo.insert({ id: 'c1', name: 'Acme', website: '', notes: '' });
    expect(() => repo.insert({ id: 'c1', name: 'Dup', website: '', notes: '' })).toThrow();
    expect(() => repo.update('zz', {})).toThrow();
    expect(maxHeld).toBe(1);
    expect(held).toBe(0);
  });
});

describe('SheetAppendLog', () => {
  const logColumns = SHEETS.Log;
  const entry = (message: string): LogEntry => ({ time: 't', flow: 'f', entity: 'e', message });

  it('appends and lists entries', () => {
    const log = new SheetAppendLog<LogEntry>('Log', logColumns, FakeGrid.withHeader(logColumns));
    log.append(entry('one'));
    log.append(entry('two'));
    expect(log.list().map((e) => e.message)).toEqual(['one', 'two']);
  });

  it('keeps only the newest maxRows entries', () => {
    const grid = FakeGrid.withHeader(logColumns);
    const log = new SheetAppendLog<LogEntry>('Log', logColumns, grid, NO_LOCK, 3);
    for (const n of [1, 2, 3, 4, 5]) log.append(entry(String(n)));
    expect(log.list().map((e) => e.message)).toEqual(['3', '4', '5']);
    expect(grid.rows).toHaveLength(4);
  });
});
