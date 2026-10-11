import { describe, expect, it } from 'vitest';
import { fileIdFromUrl } from '../drive';
import { InMemoryAppendLog, InMemoryRepository } from '../repository';
import { SETTINGS_DEFAULTS, parseSettings } from '../settings';
import { FakeDrive } from '../testing/fake-drive';
import { errorOf } from '../testing/errors';
import { makeApplication, makeCompany, makeJob, makeTemplate, sequentialIds } from '../testing/fixtures';
import type { Application, ApplicationDocument, Company, Job, StatusHistoryEntry, Template } from '../types';
import { ApplicationFactory, type ApplicationFactoryDeps } from './application-factory';

const NOW = '2026-10-11T08:00:00.000Z';
const TEMPLATE_TEXT = 'Dear {{company}}, I am {{name}} applying for {{position}} on {{date}}. {{body}}';

class CopyFailsDrive extends FakeDrive {
  override copyDocument(): never {
    throw new Error('Drive is down');
  }
}

class BlankFailsDrive extends FakeDrive {
  override createDocument(): never {
    throw new Error('Drive is down');
  }
}

function setup(options: { drive?: FakeDrive; templates?: boolean; settings?: Record<string, string>; onError?: (where: string) => void } = {}) {
  const drive = options.drive ?? new FakeDrive();
  const root = drive.ensureFolder(null, 'JobHunters');
  const templates = new InMemoryRepository<Template>();
  if (options.templates !== false) {
    for (const [id, type] of [['t-resume', 'resume'], ['t-letter', 'cover_letter']] as const) {
      const docId = drive.addTemplate(TEMPLATE_TEXT);
      templates.insert(makeTemplate({ id, type, language: 'en', doc_url: `https://docs.example.invalid/document/d/${docId}/edit` }));
    }
  }
  const deps: ApplicationFactoryDeps = {
    jobs: new InMemoryRepository<Job>([makeJob({ id: 'j1', company_id: 'c1', title: 'Android Developer' })]),
    companies: new InMemoryRepository<Company>([makeCompany({ id: 'c1', name: 'Example s.r.o.' })]),
    applications: new InMemoryRepository<Application>(),
    documents: new InMemoryRepository<ApplicationDocument>(),
    templates,
    history: new InMemoryAppendLog<StatusHistoryEntry>(),
    drive,
    rootFolder: () => root,
    profile: () => ({ name: 'Eva Example', email: 'eva@example.com' }),
    settings: () => parseSettings({ ...SETTINGS_DEFAULTS, ...options.settings }).settings,
    newId: sequentialIds('x'),
    now: () => NOW,
    onError: options.onError,
  };
  return { factory: new ApplicationFactory(deps), deps, drive };
}

const contentOf = (drive: FakeDrive, doc: ApplicationDocument) => drive.documents.get(fileIdFromUrl(doc.doc_url))!.content;

describe('create', () => {
  it('creates a draft with label, folder, history entry and filled documents', () => {
    const { factory, drive, deps } = setup();
    const { application, documents, warnings } = factory.create({ jobId: 'j1' });
    expect(warnings).toEqual([]);
    expect(application).toMatchObject({
      job_id: 'j1', attempt: 1, label: 'Example s.r.o. – Android Developer – #1 (2026-10)', language: 'en', status: 'draft',
      applied_at: '', last_activity_at: NOW, snapshot_used: '',
    });
    expect([...drive.folders.values()].map((f) => f.name)).toEqual([
      'JobHunters', 'Companies', 'Example s.r.o.', 'Android Developer', 'Example s.r.o. – Android Developer – #1 (2026-10)',
    ]);
    expect(fileIdFromUrl(application.folder_url)).not.toBe('');
    expect(deps.history.list()).toEqual([{ application_id: application.id, from: '', to: 'draft', at: NOW }]);
    expect(documents.map((d) => d.type)).toEqual(['resume', 'cover_letter']);
    expect(contentOf(drive, documents[0]!)).toBe('Dear Example s.r.o., I am Eva Example applying for Android Developer on 2026-10-11. {{body}}');
    expect(documents[0]).toMatchObject({ template_id: 't-resume', created_at: NOW, pdf_url: '', pdf_exported_at: '' });
    const names = [...drive.documents.values()].filter((d) => d.folderId !== null).map((d) => d.name);
    expect(names).toEqual(['Resume – Example s.r.o. – Android Developer – #1 (2026-10)', 'Cover letter – Example s.r.o. – Android Developer – #1 (2026-10)']);
  });

  it('uses the default document language; without a template for it the documents are empty', () => {
    const { factory, drive } = setup({ settings: { default_document_language: 'cs' } });
    const { application, documents, warnings } = factory.create({ jobId: 'j1' });
    expect(application.language).toBe('cs');
    expect(warnings.map((w) => w.code)).toEqual(['template_missing', 'template_missing']);
    expect(documents.map((d) => [d.type, d.template_id])).toEqual([['resume', ''], ['cover_letter', '']]);
    const created = [...drive.documents.values()].filter((d) => d.folderId !== null);
    expect(created.map((d) => d.name)).toEqual(['Životopis – Example s.r.o. – Android Developer – #1 (2026-10)', 'Motivační dopis – Example s.r.o. – Android Developer – #1 (2026-10)']);
    expect(created.map((d) => d.content)).toEqual(['', '']);
  });

  it('numbers attempts per job and warns, but does not block, when an application is still active', () => {
    const { factory, deps } = setup();
    const first = factory.create({ jobId: 'j1' }).application;
    const second = factory.create({ jobId: 'j1' });
    expect(second.application.attempt).toBe(2);
    expect(second.application.label).toContain('#2');
    expect(second.warnings).toEqual([{ code: 'active_application_exists', params: { id: first.id } }]);
    deps.applications.update(first.id, { status: 'rejected' });
    deps.applications.update(second.application.id, { status: 'withdrawn' });
    const third = factory.create({ jobId: 'j1' });
    expect(third.application.attempt).toBe(3);
    expect(third.warnings).toEqual([]);
  });

  it('uses a language-neutral template when none exists for the language', () => {
    const { factory, deps, drive } = setup({ templates: false });
    const docId = drive.addTemplate(TEMPLATE_TEXT);
    deps.templates.insert(makeTemplate({ id: 'any', type: 'resume', language: '', doc_url: `https://docs.example.invalid/document/d/${docId}/edit` }));
    const { documents, warnings } = factory.create({ jobId: 'j1' });
    expect(documents.map((d) => [d.type, d.template_id])).toEqual([['resume', 'any'], ['cover_letter', '']]);
    expect(warnings).toEqual([{ code: 'template_missing', params: { type: 'cover_letter', language: 'en' } }]);
  });

  it('creates empty documents in the application folder when no template exists at all', () => {
    const { factory, deps, drive } = setup({ templates: false });
    const result = factory.create({ jobId: 'j1' });
    expect(deps.applications.list()).toHaveLength(1);
    expect(deps.documents.list().map((d) => [d.type, d.template_id, d.pdf_url])).toEqual([['resume', '', ''], ['cover_letter', '', '']]);
    expect(result.warnings.map((w) => w.code)).toEqual(['template_missing', 'template_missing']);
    const folderId = fileIdFromUrl(result.application.folder_url);
    const blanks = [...drive.documents.values()].filter((d) => d.folderId === folderId);
    expect(blanks.map((d) => d.content)).toEqual(['', '']);
    expect(blanks.map((d) => d.name)).toEqual(['Resume – Example s.r.o. – Android Developer – #1 (2026-10)', 'Cover letter – Example s.r.o. – Android Developer – #1 (2026-10)']);
  });

  it('keeps the application when Drive fails while creating empty documents', () => {
    const errors: string[] = [];
    const { factory, deps } = setup({ templates: false, drive: new BlankFailsDrive(), onError: (where) => errors.push(where) });
    const result = factory.create({ jobId: 'j1' });
    expect(deps.applications.list()).toHaveLength(1);
    expect(result.documents).toEqual([]);
    expect(result.warnings.map((w) => w.code)).toEqual(['template_missing', 'document_create_failed', 'template_missing', 'document_create_failed']);
    expect(errors).toEqual(['document', 'document']);
  });

  it('keeps the application when Drive fails while copying documents', () => {
    const errors: string[] = [];
    const { factory, deps } = setup({ drive: new CopyFailsDrive(), onError: (where) => errors.push(where) });
    const result = factory.create({ jobId: 'j1' });
    expect(deps.applications.list()).toHaveLength(1);
    expect(result.documents).toEqual([]);
    expect(result.warnings).toEqual([
      { code: 'document_create_failed', params: { type: 'resume' } },
      { code: 'document_create_failed', params: { type: 'cover_letter' } },
    ]);
    expect(errors).toEqual(['document', 'document']);
  });

  it('copies the documents of an earlier application unchanged ("apply again")', () => {
    const { factory, drive, deps } = setup();
    const first = factory.create({ jobId: 'j1' });
    const edited = first.documents[0]!;
    drive.documents.get(fileIdFromUrl(edited.doc_url))!.content = 'My hand-edited resume';
    const again = factory.create({ jobId: 'j1', fromApplicationId: first.application.id });
    expect(again.documents.map((d) => d.type)).toEqual(['resume', 'cover_letter']);
    expect(contentOf(drive, again.documents[0]!)).toBe('My hand-edited resume');
    expect(again.documents[0]!.doc_url).not.toBe(edited.doc_url);
    expect(deps.documents.list()).toHaveLength(4);
  });

  it('rejects an unknown job, an unsupported language and a foreign source application', () => {
    const { factory, deps } = setup();
    expect(errorOf(() => factory.create({ jobId: 'nope' }))).toMatchObject({ code: 'job_not_found', params: { id: 'nope' } });
    expect(errorOf(() => factory.create({ jobId: 'j1', language: 'de' }))).toMatchObject({ code: 'language_invalid' });
    deps.applications.insert(makeApplication({ id: 'other', job_id: 'j2' }));
    expect(errorOf(() => factory.create({ jobId: 'j1', fromApplicationId: 'other' }))).toMatchObject({ code: 'application_job_mismatch' });
    expect(errorOf(() => factory.create({ jobId: 'j1', fromApplicationId: 'ghost' }))).toMatchObject({ code: 'application_not_found' });
    expect(deps.applications.list()).toHaveLength(1);
  });

  it('uses a placeholder company name when the job has no company', () => {
    const { factory, deps } = setup();
    deps.jobs.update('j1', { company_id: '' });
    expect(factory.create({ jobId: 'j1' }).application.label).toContain('Unknown company');
  });
});

describe('addDocument', () => {
  it('adds a document from a template to an existing application and touches last_activity_at', () => {
    const { factory, deps, drive } = setup({ templates: false });
    const docId = drive.addTemplate(TEMPLATE_TEXT);
    deps.templates.insert(makeTemplate({ id: 'extra', type: 'other', language: '', doc_url: `https://docs.example.invalid/document/d/${docId}/edit` }));
    const { application } = factory.create({ jobId: 'j1' });
    const doc = factory.addDocument(application.id, 'extra');
    expect(doc).toMatchObject({ type: 'other', application_id: application.id, template_id: 'extra' });
    expect(contentOf(drive, doc)).toContain('Eva Example');
    expect(deps.applications.get(application.id)!.last_activity_at).toBe(NOW);
  });

  it('rejects unknown applications and templates and an application without a folder', () => {
    const { factory, deps } = setup();
    expect(errorOf(() => factory.addDocument('ghost', 't-resume'))).toMatchObject({ code: 'application_not_found' });
    const { application } = factory.create({ jobId: 'j1' });
    expect(errorOf(() => factory.addDocument(application.id, 'ghost'))).toMatchObject({ code: 'template_not_found' });
    deps.applications.update(application.id, { folder_url: '' });
    expect(errorOf(() => factory.addDocument(application.id, 't-resume'))).toMatchObject({ code: 'application_folder_missing' });
  });
});
