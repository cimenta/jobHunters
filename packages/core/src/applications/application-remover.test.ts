import { describe, expect, it } from 'vitest';
import { fileIdFromUrl } from '../drive';
import { InMemoryRepository } from '../repository';
import { FakeDrive } from '../testing/fake-drive';
import { errorOf } from '../testing/errors';
import { makeApplication, makeDocument, makeReminder } from '../testing/fixtures';
import type { Application, ApplicationDocument, Communication, Question, Reminder } from '../types';
import { ApplicationRemover } from './application-remover';

class TrashFailsDrive extends FakeDrive {
  override trashFolder(): never {
    throw new Error('Drive is down');
  }
}

function setup(drive: FakeDrive = new FakeDrive()) {
  const root = drive.ensureFolder(null, 'JobHunters');
  const folder = drive.ensureFolder(root.id, 'Application 1');
  const otherFolder = drive.ensureFolder(root.id, 'Application 2');
  const doc = drive.copyDocument(drive.addTemplate('Hello'), 'Resume', folder.id);
  const otherDoc = drive.copyDocument(drive.addTemplate('Other'), 'Resume', otherFolder.id);
  const repos = {
    applications: new InMemoryRepository<Application>([
      makeApplication({ id: 'a1', folder_url: folder.url }),
      makeApplication({ id: 'a2', folder_url: otherFolder.url }),
      makeApplication({ id: 'a3', folder_url: '' }),
    ]),
    documents: new InMemoryRepository<ApplicationDocument>([
      makeDocument({ id: 'd1', application_id: 'a1', doc_url: doc.url }),
      makeDocument({ id: 'd2', application_id: 'a1' }),
      makeDocument({ id: 'd3', application_id: 'a2', doc_url: otherDoc.url }),
    ]),
    questions: new InMemoryRepository<Question>([
      { id: 'q1', application_id: 'a1', position: 1, question: 'Why?', answer: '', max_sentences: null, status: 'open', created_at: '', updated_at: '' },
      { id: 'q2', application_id: 'a2', position: 1, question: 'How?', answer: '', max_sentences: null, status: 'open', created_at: '', updated_at: '' },
    ]),
    communications: new InMemoryRepository<Communication>([
      { id: 'm1', application_id: 'a1', datetime: '2026-10-01T10:00:00.000Z', direction: 'note', channel: 'other', contact_id: '', summary: 'x', details: '', attachment_url: '', kind: 'message' },
    ]),
    reminders: new InMemoryRepository<Reminder>([
      makeReminder({ id: 'r1', application_id: 'a1' }),
      makeReminder({ id: 'r2', application_id: 'a1', status: 'done' }),
      makeReminder({ id: 'r3', application_id: 'a2' }),
    ]),
  };
  const errors: string[] = [];
  const remover = new ApplicationRemover({ ...repos, drive, onError: (where) => errors.push(where) });
  return { remover, repos, drive, folder, otherFolder, errors };
}

describe('ApplicationRemover', () => {
  it('removes the application and everything that belongs to it, and nothing else', () => {
    const { remover, repos } = setup();
    const result = remover.remove('a1', { trashFolder: false });
    expect(result.removed).toEqual({ documents: 2, questions: 1, communications: 1, reminders: 2 });
    expect(repos.applications.list().map((a) => a.id)).toEqual(['a2', 'a3']);
    expect(repos.documents.list().map((d) => d.id)).toEqual(['d3']);
    expect(repos.questions.list().map((q) => q.id)).toEqual(['q2']);
    expect(repos.communications.list()).toEqual([]);
    expect(repos.reminders.list().map((r) => r.id)).toEqual(['r3']);
    expect(result.warnings).toEqual([]);
  });

  it('moves the Drive folder to the trash on request and leaves other folders alone', () => {
    const { remover, drive, folder, otherFolder } = setup();
    const result = remover.remove('a1', { trashFolder: true });
    expect(result.folderTrashed).toBe(true);
    expect(drive.folders.has(fileIdFromUrl(folder.url))).toBe(false);
    expect([...drive.documents.values()].some((d) => d.folderId === fileIdFromUrl(folder.url))).toBe(false);
    expect(drive.folders.has(fileIdFromUrl(otherFolder.url))).toBe(true);
  });

  it('keeps the Drive folder when not asked to trash it', () => {
    const { remover, drive, folder } = setup();
    expect(remover.remove('a1', { trashFolder: false }).folderTrashed).toBe(false);
    expect(drive.folders.has(fileIdFromUrl(folder.url))).toBe(true);
  });

  it('does not try to trash a folder the application never had', () => {
    const { remover } = setup();
    expect(remover.remove('a3', { trashFolder: true })).toMatchObject({ folderTrashed: false, warnings: [] });
  });

  it('still removes the rows and warns when Drive cannot trash the folder', () => {
    const { remover, repos, errors } = setup(new TrashFailsDrive());
    const result = remover.remove('a1', { trashFolder: true });
    expect(repos.applications.get('a1')).toBeUndefined();
    expect(result.folderTrashed).toBe(false);
    expect(result.warnings).toEqual([{ code: 'folder_trash_failed', params: {} }]);
    expect(errors).toEqual(['trash-folder']);
  });

  it('rejects an unknown application and removes nothing', () => {
    const { remover, repos } = setup();
    expect(errorOf(() => remover.remove('ghost', { trashFolder: true }))).toMatchObject({ code: 'application_not_found', params: { id: 'ghost' } });
    expect(repos.applications.list()).toHaveLength(3);
  });
});
