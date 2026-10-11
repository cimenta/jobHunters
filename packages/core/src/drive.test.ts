import { describe, expect, it } from 'vitest';
import { ensureFolderPath, fillPlaceholders, sanitizeFolderName } from './drive';
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
