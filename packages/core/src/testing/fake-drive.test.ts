import { describe, expect, it } from 'vitest';
import { FakeDrive } from './fake-drive';

describe('FakeDrive.listChildren', () => {
  it('lists the names of the direct subfolders and counts the files directly in the folder', () => {
    const drive = new FakeDrive();
    const root = drive.ensureFolder(null, 'Root');
    const job = drive.ensureFolder(root.id, 'Job');
    const snapshot = drive.ensureFolder(job.id, 'Ad 2026-10-14');
    drive.ensureFolder(job.id, 'Application 1');
    drive.saveTextFile(snapshot.id, 'snapshot.html', '<p>x</p>', 'text/html');
    drive.saveTextFile(job.id, 'note.txt', 'x', 'text/plain');
    expect(drive.listChildren(job.id)).toEqual({ folders: ['Ad 2026-10-14', 'Application 1'], files: 1 });
    expect(drive.listChildren(snapshot.id)).toEqual({ folders: [], files: 1 });
    expect(drive.listChildren(root.id)).toEqual({ folders: ['Job'], files: 0 });
  });
  it('fails for a folder that does not exist', () => {
    expect(() => new FakeDrive().listChildren('nope')).toThrow();
  });
});
