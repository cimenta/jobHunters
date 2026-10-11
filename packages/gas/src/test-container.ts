import { NO_LOCK, SHEETS, type SheetName } from '@jobhunters/core';
import { FakeGrid } from '@jobhunters/core/testing';
import { buildContainer } from './container';

export const NOW = '2026-10-10T08:00:00.000Z';

export function makeTestContainer() {
  const grids = new Map<SheetName, FakeGrid>();
  const grid = (sheet: SheetName): FakeGrid => {
    let found = grids.get(sheet);
    if (!found) {
      found = FakeGrid.withHeader(SHEETS[sheet]);
      grids.set(sheet, found);
    }
    return found;
  };
  let n = 0;
  const container = buildContainer({ grid, lock: NO_LOCK, newId: () => `id${++n}`, now: () => NOW, appVersion: '9.9.9' });
  return { container, grid };
}
