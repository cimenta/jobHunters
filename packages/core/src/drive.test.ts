import { describe, expect, it } from 'vitest';
import { driveDownloadUrl, ensureFolderPath, fileIdFromUrl, fillPlaceholders, sanitizeFolderName } from './drive';
import { FakeDrive } from './testing/fake-drive';

describe('sanitizeFolderName', () => {
  it('removes characters Drive paths dislike, collapses spaces and trims', () => {
    expect(sanitizeFolderName('  Acme / Dev: "senior"?  ')).toBe('Acme Dev senior');
  });
  it('limits the length', () => {
    expect(sanitizeFolderName('x'.repeat(300))).toHaveLength(100);
  });
  it('never returns an empty name', () => {
    expect(sanitizeFolderName(' /:* ')).toBe('Untitled');
  });
  it('keeps unicode', () => {
    expect(sanitizeFolderName('Škoda Auto – Vývojář')).toBe('Škoda Auto – Vývojář');
  });
});

describe('fillPlaceholders', () => {
  it('replaces every occurrence and leaves unknown placeholders alone', () => {
    expect(fillPlaceholders('Dear {{name}}, {{name}} at {{company}} {{missing}}', { name: 'Eva', company: 'Acme' })).toBe(
      'Dear Eva, Eva at Acme {{missing}}',
    );
  });
  it('inserts values literally', () => {
    expect(fillPlaceholders('Hi {{name}}', { name: '$& $1 {{company}}' })).toBe('Hi $& $1 {{company}}');
  });
  it('ignores inherited property names', () => {
    expect(fillPlaceholders('{{__proto__}} {{constructor}}', {})).toBe('{{__proto__}} {{constructor}}');
  });
});

describe('ensureFolderPath', () => {
  it('creates nested folders once and is idempotent', () => {
    const drive = new FakeDrive();
    const root = drive.ensureFolder(null, 'JobHunters');
    const first = ensureFolderPath(drive, root, ['Companies', 'Acme / EU', 'Developer']);
    const second = ensureFolderPath(drive, root, ['Companies', 'Acme / EU', 'Developer']);
    expect(second.id).toBe(first.id);
    expect(drive.folders.size).toBe(4);
    expect([...drive.folders.values()].map((f) => f.name)).toEqual(['JobHunters', 'Companies', 'Acme EU', 'Developer']);
  });

  it('returns the root for an empty path', () => {
    const drive = new FakeDrive();
    const root = drive.ensureFolder(null, 'JobHunters');
    expect(ensureFolderPath(drive, root, []).id).toBe(root.id);
  });
});

describe('FakeDrive', () => {
  it('copies a template, fills it and exports it', () => {
    const drive = new FakeDrive();
    const root = drive.ensureFolder(null, 'JobHunters');
    const template = drive.addTemplate('Dear {{company}}');
    const copy = drive.copyDocument(template, 'Cover letter', root.id);
    drive.replaceInDocument(copy.id, { company: 'Acme' });
    expect(drive.exportHtml(copy.id)).toContain('Dear Acme');
    expect(drive.exportPdf(copy.id, root.id, 'Cover letter').id).not.toBe(copy.id);
    expect(drive.documents.get(template)?.content).toBe('Dear {{company}}');
  });
});

describe('driveDownloadUrl', () => {
  it('turns a Drive file address into a direct download address, and gives nothing for an address without an id', () => {
    expect(driveDownloadUrl('https://drive.google.com/file/d/1AbC_d-9/view?usp=drivesdk')).toBe('https://drive.google.com/uc?export=download&id=1AbC_d-9');
    expect(driveDownloadUrl('')).toBe('');
    expect(driveDownloadUrl('https://example.com/')).toBe('');
  });
});

describe('fileIdFromUrl', () => {
  it('reads the id from Docs, Drive file and folder addresses', () => {
    expect(fileIdFromUrl('https://docs.google.com/document/d/1AbC_d-E/edit')).toBe('1AbC_d-E');
    expect(fileIdFromUrl('https://drive.google.com/file/d/1AbC_d-E/view?usp=sharing')).toBe('1AbC_d-E');
    expect(fileIdFromUrl('https://drive.google.com/drive/folders/1AbC_d-E?usp=sharing')).toBe('1AbC_d-E');
    expect(fileIdFromUrl('https://drive.google.com/open?id=1AbC_d-E')).toBe('1AbC_d-E');
  });
  it('returns an empty string when there is no id', () => {
    expect(fileIdFromUrl('')).toBe('');
    expect(fileIdFromUrl('https://example.com/page')).toBe('');
  });
  it('works with the addresses the fake drive hands out', () => {
    const drive = new FakeDrive();
    const folder = drive.ensureFolder(null, 'JobHunters');
    expect(fileIdFromUrl(folder.url)).toBe(folder.id);
    const template = drive.addTemplate('x');
    const copy = drive.copyDocument(template, 'copy', folder.id);
    expect(fileIdFromUrl(copy.url)).toBe(copy.id);
    expect(fileIdFromUrl(drive.saveTextFile(folder.id, 'a.txt', 'a', 'text/plain').url)).not.toBe('');
  });
});
