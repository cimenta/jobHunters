import { describe, expect, it } from 'vitest';
import { InMemoryKeyValueStore, SheetKeyValueStore } from './key-value';
import type { AppWarning, Cell } from './row-codec';
import { FakeGrid } from './testing/fake-grid';

describe('InMemoryKeyValueStore', () => {
  it('sets and reads values', () => {
    const store = new InMemoryKeyValueStore({ a: '1' });
    store.set('b', '2');
    store.set('a', '3');
    expect(store.getAll()).toEqual({ a: '3', b: '2' });
  });
});

describe('SheetKeyValueStore', () => {
  const header = ['key', 'value'];

  it('appends new keys and rewrites existing ones, keeping foreign columns', () => {
    const grid = new FakeGrid([['value', 'note', 'key'], ['old', 'mine', 'a']]);
    const store = new SheetKeyValueStore('Settings', grid);
    store.set('a', 'new');
    store.set('b', 'fresh');
    expect(grid.rows).toEqual([['value', 'note', 'key'], ['new', 'mine', 'a'], ['fresh', '', 'b']]);
    expect(store.getAll()).toEqual({ a: 'new', b: 'fresh' });
  });

  it('reads numbers typed into the sheet as text and reports rows without a key', () => {
    const rows: Cell[][] = [header, ['days', 7], ['', 'orphan']];
    const warnings: AppWarning[] = [];
    const store = new SheetKeyValueStore('Settings', new FakeGrid(rows), undefined, (w) => warnings.push(...w));
    expect(store.getAll()).toEqual({ days: '7' });
    expect(warnings.map((w) => w.code)).toEqual(['row_missing_id']);
  });

  it('is safe against a key called __proto__', () => {
    const store = new SheetKeyValueStore('Settings', new FakeGrid([header, ['__proto__', 'x']]));
    expect(Object.keys(store.getAll())).toEqual(['__proto__']);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
});
