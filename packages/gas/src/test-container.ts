import { AppError, NO_LOCK, SHEETS, type SheetName } from '@jobhunters/core';
import { FakeDrive, FakeGrid, FakePageFetcher, type FakePage } from '@jobhunters/core/testing';
import { buildContainer } from './container';

export const NOW = '2026-10-10T08:00:00.000Z';

export function makeTestContainer(pages: Record<string, FakePage> = {}, options: { missingSheets?: SheetName[] } = {}) {
  const grids = new Map<SheetName, FakeGrid>();
  const grid = (sheet: SheetName): FakeGrid => {
    if (options.missingSheets?.includes(sheet)) throw new AppError('sheet_missing', `Sheet ${sheet} is missing`, { sheet });
    let found = grids.get(sheet);
    if (!found) {
      found = FakeGrid.withHeader(SHEETS[sheet]);
      grids.set(sheet, found);
    }
    return found;
  };
  const drive = new FakeDrive();
  const root = drive.ensureFolder(null, 'JobHunters');
  const fetcher = new FakePageFetcher(pages);
  let n = 0;
  const container = buildContainer({
    grid,
    lock: NO_LOCK,
    newId: () => `id${++n}`,
    now: () => NOW,
    appVersion: '9.9.9',
    fetcher,
    drive,
    rootFolder: () => root,
  });
  return { container, grid, drive, fetcher };
}
