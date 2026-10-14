import { afterEach, describe, expect, it, vi } from 'vitest';
import { GasDrive } from './gas-drive';

interface StubItem {
  id: string;
  name: string;
  trashed: boolean;
}

const iterator = <T>(items: T[]) => {
  let index = 0;
  return { hasNext: () => index < items.length, next: () => items[index++]! };
};

/** Google's DriveApp lists items that are in the trash as well; this stub does the same. */
function stubDrive(folders: StubItem[], files: StubItem[]) {
  const created: string[] = [];
  const asFolder = (item: StubItem) => ({ getId: () => item.id, getName: () => item.name, getUrl: () => `https://drive.example.invalid/folders/${item.id}`, isTrashed: () => item.trashed });
  const parent = {
    getFoldersByName: (name: string) => iterator(folders.filter((folder) => folder.name === name).map(asFolder)),
    getFolders: () => iterator(folders.map(asFolder)),
    getFiles: () => iterator(files.map((file) => ({ isTrashed: () => file.trashed }))),
    createFolder: (name: string) => {
      created.push(name);
      return asFolder({ id: `new-${name}`, name, trashed: false });
    },
  };
  vi.stubGlobal('DriveApp', { getFolderById: () => parent, getRootFolder: () => parent });
  return created;
}

afterEach(() => vi.unstubAllGlobals());

describe('GasDrive and the Drive trash', () => {
  it('ensureFolder reuses a folder that is not trashed and never one that is in the trash', () => {
    const created = stubDrive([{ id: 'old', name: 'Android Developer', trashed: true }, { id: 'live', name: 'Android Developer', trashed: false }], []);
    expect(new GasDrive().ensureFolder('p', 'Android Developer').id).toBe('live');
    expect(created).toEqual([]);

    const onlyTrashed = stubDrive([{ id: 'old', name: 'Android Developer', trashed: true }], []);
    expect(new GasDrive().ensureFolder('p', 'Android Developer').id).toBe('new-Android Developer');
    expect(onlyTrashed).toEqual(['Android Developer']);
  });

  it('listChildren ignores the folders and files that are in the trash', () => {
    stubDrive(
      [{ id: 'a', name: 'Ad 2026-10-01', trashed: false }, { id: 'b', name: 'Example – Android – #1', trashed: true }],
      [{ id: 'f1', name: 'x.txt', trashed: true }],
    );
    expect(new GasDrive().listChildren('p')).toEqual({ folders: ['Ad 2026-10-01'], files: 0 });
  });
});
