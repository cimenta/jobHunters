import { describe, expect, it } from 'vitest';
import { fileIdFromUrl } from '../drive';
import { InMemoryRepository } from '../repository';
import { FakeDrive } from '../testing/fake-drive';
import { errorOf } from '../testing/errors';
import { makeApplication, makeDocument } from '../testing/fixtures';
import { makeCompany, makeJob } from '../testing/fixtures';
import type { Application, ApplicationDocument, Company, Job } from '../types';
import { DocumentService, pdfFileName, sanitizeDocHtml } from './document-service';

function setup(now = '2026-10-11T09:00:00.000Z') {
  const drive = new FakeDrive();
  const root = drive.ensureFolder(null, 'JobHunters');
  const folder = drive.ensureFolder(root.id, 'Application');
  const template = drive.addTemplate('Hello {{name}}');
  const copy = drive.copyDocument(template, 'Resume', folder.id);
  const applications = new InMemoryRepository<Application>([makeApplication({ id: 'a1', label: 'Acme – Dev – #1 (2026-10)', language: 'en', folder_url: folder.url })]);
  const documents = new InMemoryRepository<ApplicationDocument>([makeDocument({ id: 'd1', application_id: 'a1', type: 'resume', doc_url: copy.url })]);
  let clock = now;
  const jobs = new InMemoryRepository<Job>([makeJob({ id: 'j1', company_id: 'c1', title: 'Android Developer' })]);
  const companies = new InMemoryRepository<Company>([makeCompany({ id: 'c1', name: 'Example s.r.o.' })]);
  const service = new DocumentService({ documents, applications, drive, jobs, companies, profileName: () => 'Eva Example', now: () => clock });
  return { service, drive, documents, applications, jobs, copy, setNow: (value: string) => { clock = value; } };
}

describe('exportPdf', () => {
  it('exports into the application folder, stores the link and the time', () => {
    const { service, drive, documents, copy } = setup();
    const view = service.exportPdf('d1');
    expect(view.pdf_url).toMatch(/^https:/);
    expect(view.pdf_exported_at).toBe('2026-10-11T09:00:00.000Z');
    expect(view.pdf_stale).toBe(false);
    expect(documents.get('d1')!.pdf_url).toBe(view.pdf_url);
    const pdf = [...drive.documents.values()].find((d) => d.name.endsWith('.pdf'))!;
    expect(pdf.name).toBe('Eva Example – Resume – Example s.r.o. – Android Developer.pdf');
    expect(pdf.content).toBe(drive.documents.get(fileIdFromUrl(copy.url))!.content);
    expect(pdf.folderId).not.toBeNull();
  });

  it('replaces the file of an earlier export instead of making a second one', () => {
    const { service, drive, documents, jobs } = setup();
    const first = service.exportPdf('d1');
    jobs.update('j1', { title: 'Kotlin Developer' });
    const second = service.exportPdf('d1');
    const pdfs = [...drive.documents.values()].filter((d) => d.name.endsWith('.pdf'));
    expect(pdfs).toHaveLength(1);
    expect(second.pdf_url).toBe(first.pdf_url);
    expect(pdfs[0]!.name).toBe('Eva Example – Resume – Example s.r.o. – Kotlin Developer.pdf');
    expect(documents.get('d1')!.pdf_url).toBe(first.pdf_url);
  });

  it('makes a new file when the earlier PDF no longer exists in Drive', () => {
    const { service, drive } = setup();
    const first = service.exportPdf('d1');
    drive.documents.delete(fileIdFromUrl(first.pdf_url));
    const second = service.exportPdf('d1');
    expect(second.pdf_url).not.toBe(first.pdf_url);
    expect([...drive.documents.values()].filter((d) => d.name.endsWith('.pdf'))).toHaveLength(1);
  });

  it('falls back to name and type when the job was deleted', () => {
    const { service, drive, jobs } = setup();
    jobs.remove('j1');
    service.exportPdf('d1');
    expect([...drive.documents.values()].some((d) => d.name === 'Eva Example – Resume.pdf')).toBe(true);
  });

  it('rejects unknown documents and applications without a folder', () => {
    const { service, applications } = setup();
    expect(errorOf(() => service.exportPdf('ghost'))).toMatchObject({ code: 'document_not_found' });
    applications.update('a1', { folder_url: '' });
    expect(errorOf(() => service.exportPdf('d1'))).toMatchObject({ code: 'application_folder_missing' });
  });
});

describe('stale detection', () => {
  it('marks the PDF stale once the Doc was edited after the export', () => {
    const { service, drive, copy, setNow } = setup();
    setNow('2000-01-01T00:00:00.000Z');
    service.exportPdf('d1');
    expect(service.list('a1')[0]!.pdf_stale).toBe(true);
    setNow('2100-01-01T00:00:00.000Z');
    service.exportPdf('d1');
    expect(service.list('a1')[0]!.pdf_stale).toBe(false);
    drive.replaceInDocument(fileIdFromUrl(copy.url), { name: 'Eva' });
    // The fake clock only runs in 2026, so the edit is older than the 2100 export: still fresh.
    expect(service.list('a1')[0]!.pdf_stale).toBe(false);
  });

  it('never calls a document stale before its first export', () => {
    expect(setup().service.list('a1')[0]!.pdf_stale).toBe(false);
  });

  it('survives a Doc that was deleted in Drive', () => {
    const { service, drive, copy } = setup();
    service.exportPdf('d1');
    drive.documents.delete(fileIdFromUrl(copy.url));
    expect(service.list('a1')).toMatchObject([{ id: 'd1', pdf_stale: false }]);
  });

  it('lists only the documents of the given application', () => {
    const { service, documents } = setup();
    documents.insert(makeDocument({ id: 'd2', application_id: 'other' }));
    expect(service.list('a1').map((d) => d.id)).toEqual(['d1']);
  });
});

describe('preview', () => {
  it('exports the Doc as HTML', () => {
    expect(setup().service.previewHtml('d1')).toContain('Hello {{name}}');
  });
  it('rejects an unknown document', () => {
    expect(errorOf(() => setup().service.previewHtml('ghost'))).toMatchObject({ code: 'document_not_found' });
  });
});

describe('sanitizeDocHtml', () => {
  it('removes scripts, frames, event handlers and javascript links but keeps formatting', () => {
    const dirty = [
      '<style>p{color:red}</style>',
      '<p onclick="steal()">Hello <b>world</b></p>',
      '<script>alert(1)</script>',
      '<SCRIPT SRC=x></SCRIPT>',
      '<img src=x onerror=alert(1)>',
      '<a href="javascript:alert(1)">click</a>',
      '<iframe src="https://evil.example"></iframe>',
      '<object data="x"></object><embed src="x">',
      '<form action="https://evil.example"><input></form>',
      '<meta http-equiv="refresh" content="0;url=https://evil.example">',
    ].join('');
    const clean = sanitizeDocHtml(dirty);
    expect(clean).toContain('<style>p{color:red}</style>');
    expect(clean).toContain('<b>world</b>');
    for (const bad of ['<script', 'alert(1)', 'onclick', 'onerror', 'javascript:', '<iframe', '<object', '<embed', '<form', 'http-equiv']) {
      expect(clean.toLowerCase(), bad).not.toContain(bad);
    }
  });
});

describe('pdfFileName', () => {
  const base = { type: 'resume', fullName: 'Eva Example', company: 'Example s.r.o.', title: 'Android Developer', language: 'en' as const };
  it('joins full name, type, company and job title', () => {
    expect(pdfFileName(base)).toBe('Eva Example – Resume – Example s.r.o. – Android Developer');
  });
  it('drops empty parts', () => {
    expect(pdfFileName({ ...base, fullName: '' })).toBe('Resume – Example s.r.o. – Android Developer');
    expect(pdfFileName({ ...base, company: '  ' })).toBe('Eva Example – Resume – Android Developer');
  });
  it('translates the type into the application language', () => {
    expect(pdfFileName({ ...base, language: 'cs' })).toBe('Eva Example – Životopis – Example s.r.o. – Android Developer');
  });
  it('replaces forbidden characters and has no counter or date', () => {
    const name = pdfFileName({ ...base, title: 'Dev/Ops: "Lead"' });
    expect(name).not.toMatch(/[\/:"]/);
    expect(name).toContain('Dev Ops');
    expect(name).not.toContain('#');
    expect(name).not.toContain('(2026-10)');
  });
});
