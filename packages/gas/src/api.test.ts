import { describe, expect, it } from 'vitest';
import type { HistoryList } from '@jobhunters/core';
import type { FakePage } from '@jobhunters/core/testing';
import { makeApplication } from '@jobhunters/core/testing';
import { createApi } from './api';
import { createHandlers } from './handlers';
import { makeTestContainer } from './test-container';

function setup(pages: Record<string, FakePage> = {}, options: Parameters<typeof makeTestContainer>[1] = {}) {
  const { container, grid, drive } = makeTestContainer(pages, options);
  const api = createApi({ handlers: createHandlers(container), log: container.log });
  return { api, container, grid, drive };
}

describe('api', () => {
  it('returns app info', () => {
    expect(setup().api('getAppInfo')).toEqual({ ok: true, data: { version: '9.9.9', locales: ['en', 'cs'], timeZone: 'UTC' } });
  });

  it('getSetupStatus says setup is not needed where nothing can be checked', () => {
    expect(setup().api('getSetupStatus')).toEqual({ ok: true, data: { needed: false, reasons: [] } });
  });

  it('runSetup reports that setup cannot run where no runner is given', () => {
    expect(setup().api('runSetup')).toEqual({ ok: true, data: { ok: false, lines: ['Setup cannot run here.'] } });
  });

  it('importAiJob queues one import-and-match task, and refuses without the candidate experience', () => {
    const { api } = setup();
    expect(api('importAiJob', { url: 'https://example.com/jobs/1' })).toMatchObject({ ok: false, error: { code: 'match_experience_required' } });
    expect(api('updateSettings', { candidate_experience: 'Ten years of Kotlin' })).toMatchObject({ ok: true });
    const result = api('importAiJob', { url: 'https://example.com/jobs/1' }) as { ok: true; data: { status: string; task: { type: string } } };
    expect(result.data).toMatchObject({ status: 'queued', task: { type: 'import_match_job' } });
    expect(api('importAiJob', { url: 5 })).toMatchObject({ ok: false, error: { code: 'invalid_arguments' } });
  });

  it('the AI job uses the built-in import-and-match prompt even when the user kept old own prompts and never reset them', () => {
    const { api } = setup();
    api('updateSettings', { candidate_experience: 'Ten years of Kotlin', ai_prompt_import_job: 'My old import prompt {{job_id}}', ai_prompts_version: '1' });
    const result = api('importAiJob', { url: 'https://example.com/jobs/2' }) as { ok: true; data: { task: { instructions: string } } };
    expect(result.data.task.instructions).toContain('match_percent');
    expect(result.data.task.instructions).not.toContain('My old import prompt');
  });

  it('rejects unknown methods, including inherited property names', () => {
    const { api } = setup();
    expect(api('nope')).toMatchObject({ ok: false, error: { code: 'unknown_method', params: { method: 'nope' } } });
    expect(api('constructor')).toMatchObject({ ok: false, error: { code: 'unknown_method' } });
    expect(api('__proto__')).toMatchObject({ ok: false, error: { code: 'unknown_method' } });
  });

  it('validates arguments', () => {
    const { api } = setup();
    expect(api('setApplicationStatus', 'x')).toMatchObject({ ok: false, error: { code: 'invalid_arguments' } });
    expect(api('setApplicationStatus', { id: 5, to: 'sent' })).toMatchObject({ ok: false, error: { code: 'invalid_arguments' } });
    expect(api('updateSettings', { ui_language: 5 })).toMatchObject({ ok: false, error: { code: 'invalid_arguments' } });
  });

  it('moves an application to waiting and writes reminder, history and timestamps to the sheets', () => {
    const { api, container, grid } = setup();
    container.applications.insert(makeApplication({ id: 'a1', status: 'sent' }));
    const result = api('setApplicationStatus', { id: 'a1', to: 'waiting', remindAt: '2026-10-20' });
    expect(result).toMatchObject({ ok: true, data: { id: 'a1', status: 'waiting' } });
    expect(container.reminders.list()).toMatchObject([{ application_id: 'a1', due_at: '2026-10-20', text: 'Waiting for a reply' }]);
    expect(grid('StatusHistory').rows).toHaveLength(2);
  });

  it('answers with a coded error and logs it', () => {
    const { api, container } = setup();
    container.applications.insert(makeApplication({ id: 'a1', status: 'sent' }));
    expect(api('setApplicationStatus', { id: 'a1', to: 'waiting' })).toMatchObject({
      ok: false,
      error: { code: 'reminder_date_required', params: {} },
    });
    expect(container.logEntries()).toMatchObject([{ flow: 'api', entity: 'setApplicationStatus' }]);
  });

  it('hides unexpected errors from the caller but logs the details', () => {
    const { container } = setup();
    const api = createApi({
      handlers: {
        boom: () => {
          throw new Error('secret detail');
        },
      },
      log: container.log,
    });
    const result = api('boom');
    expect(result).toMatchObject({ ok: false, error: { code: 'internal_error' } });
    expect(JSON.stringify(result)).not.toContain('secret detail');
    expect(container.logEntries()[0]?.message).toContain('secret detail');
  });

  it('survives a log that fails', () => {
    const api = createApi({
      handlers: { boom: () => { throw new Error('x'); } },
      log: () => { throw new Error('log down'); },
    });
    expect(api('boom')).toMatchObject({ ok: false, error: { code: 'internal_error' } });
  });

  it('applies settings immediately, including the language of generated texts', () => {
    const { api, container } = setup();
    expect(api('updateSettings', { ui_language: 'cs' })).toMatchObject({ ok: true, data: { ui_language: 'cs' } });
    expect(api('getSettings')).toMatchObject({ ok: true, data: { settings: { ui_language: 'cs' }, warnings: [] } });
    container.applications.insert(makeApplication({ id: 'a1', status: 'sent' }));
    api('setApplicationStatus', { id: 'a1', to: 'waiting', remindAt: '2026-10-20' });
    expect(container.reminders.list()[0]?.text).toBe('Čekání na odpověď');
  });

  it('reads the application sheets too and warns about rows edited outside the app', () => {
    const { api, grid } = setup();
    grid('Documents').appendRow(['', 'a1', 'resume', '', '', '', '', '']);
    grid('Questions').appendRow(['', 'a1', 1, 'Why us?', '', '', 'open', '', '']);
    const result = api('getWarnings') as { ok: true; data: { code: string; params: { sheet: string } }[] };
    expect(result.data.map((w) => `${w.code}:${w.params.sheet}`)).toEqual(['row_missing_id:Documents', 'row_missing_id:Questions']);
  });

  it('reports rows edited outside the app as warnings', () => {
    const { api, grid } = setup();
    grid('Applications').appendRow(['a9', 'j1', 1, 'Label', 'en', 'weird', '', '', '', '', '']);
    grid('Companies').appendRow(['', 'No id', '', '']);
    expect(api('getWarnings')).toEqual({
      ok: true,
      data: [
        { code: 'row_missing_id', params: { sheet: 'Companies', row: 2, value: '' } },
        { code: 'cell_not_allowed', params: { sheet: 'Applications', row: 2, column: 'status', value: 'weird' } },
      ],
    });
  });
});

const AD = '<script type="application/ld+json">{"@type":"JobPosting","title":"Data Analyst","hiringOrganization":{"name":"Example Ltd"},"description":"Analyse data for the business and report to the head of data with the team."}</script>';
const AD_URL = 'https://example.com/jobs/1?utm_source=mail';
const CLEAN_URL = 'https://example.com/jobs/1';

describe('jobs api', () => {
  it('previews without saving', () => {
    const { api, container } = setup({ [CLEAN_URL]: { status: 200, html: AD } });
    expect(api('previewJob', { url: AD_URL })).toMatchObject({
      ok: true,
      data: { url: CLEAN_URL, fetched: true, parserId: 'generic', duplicateOf: '', parsed: { title: 'Data Analyst', company: 'Example Ltd' } },
    });
    expect(container.jobs.list()).toEqual([]);
  });

  it('saves a job to the sheets and lists it', () => {
    const { api, container, grid } = setup({ [CLEAN_URL]: { status: 200, html: AD } });
    const saved = api('saveJob', { url: AD_URL, overrides: { location: 'Brno' } });
    expect(saved).toMatchObject({ ok: true, data: { status: 'created', job: { title: 'Data Analyst', location: 'Brno', url: CLEAN_URL } } });
    expect(container.companies.list().map((c) => c.name)).toEqual(['Example Ltd']);
    expect(grid('Jobs').rows).toHaveLength(2);
    const listed = api('listJobs') as { ok: true; data: { title: string; description: string }[] };
    expect(listed.data.map((j) => j.title)).toEqual(['Data Analyst']);
    expect(listed.data[0]!.description.length).toBeLessThanOrEqual(200);
  });

  it('checks the availability of a job on demand and rejects bad calls', () => {
    const pages: Record<string, FakePage> = { [CLEAN_URL]: { status: 200, html: AD } };
    const { api, container } = setup(pages);
    const id = (api('saveJob', { url: AD_URL }) as { data: { job: { id: string } } }).data.job.id;
    expect(api('checkJobAvailability', { id })).toMatchObject({ ok: true, data: { changed: false, verdict: { availability: 'online' }, job: { id, availability: 'online' } } });
    expect(container.jobs.get(id)?.last_checked_at).not.toBe('');
    pages[CLEAN_URL] = { status: 200, html: AD + ' This position has been filled.' };
    container.settings.update({ offline_texts: 'position has been filled' });
    expect(api('checkJobAvailability', { id })).toMatchObject({ ok: true, data: { changed: true, job: { availability: 'offline' } } });
    expect(api('checkJobAvailability', { id: 'zz' })).toMatchObject({ ok: false, error: { code: 'job_not_found' } });
    expect(api('checkJobAvailability', {})).toMatchObject({ ok: false });
  });

  it('runs the scheduled availability check in the configured hour only', () => {
    const pages: Record<string, FakePage> = { [CLEAN_URL]: { status: 200, html: AD } };
    const { api, container } = setup(pages);
    const id = (api('saveJob', { url: AD_URL }) as { data: { job: { id: string } } }).data.job.id;
    pages[CLEAN_URL] = { status: 200, html: AD + ' This position has been filled.' };
    container.settings.update({ availability_check_enabled: 'true', availability_check_hours: '18', offline_texts: 'position has been filled' });
    expect(container.scheduler.tick({ day: '2026-10-12', hour: 17 })).toEqual([]);
    expect(container.jobs.get(id)?.availability).toBe('online');
    expect(container.scheduler.tick({ day: '2026-10-12', hour: 18 })).toEqual(['availability']);
    expect(container.jobs.get(id)?.availability).toBe('offline');
  });

  it('answers duplicate for the same ad and saves a failed download with a warning', () => {
    const { api } = setup({ [CLEAN_URL]: { status: 200, html: AD } });
    api('saveJob', { url: AD_URL });
    expect(api('saveJob', { url: CLEAN_URL })).toMatchObject({ ok: true, data: { status: 'duplicate' } });
    expect(api('saveJob', { url: 'https://example.com/blocked' })).toMatchObject({
      ok: true,
      data: { status: 'created', job: { flags: 'snapshot_missing' }, warnings: [{ code: 'page_not_fetched', params: { status: 404 } }] },
    });
  });

  it('saves pasted text', () => {
    const { api } = setup();
    const text = 'Backend Developer\n\nWe are hiring a developer for our team and you will work with us.';
    expect(api('saveJob', { url: 'https://example.com/blocked', text })).toMatchObject({
      ok: true,
      data: { job: { title: 'Backend Developer', parser_id: 'manual' } },
    });
  });

  it('validates arguments', () => {
    const { api } = setup();
    for (const args of [undefined, 'x', { url: 5 }, { url: 'https://example.com/a', text: 5 }, { url: 'https://example.com/a', overrides: 'x' },
      { url: 'https://example.com/a', overrides: { id: 'hack' } }, { url: 'https://example.com/a', overrides: { salary_min: 'lots' } },
      { url: 'https://example.com/a', overrides: { is_gig: 'yes' } }]) {
      expect(api('saveJob', args), JSON.stringify(args)).toMatchObject({ ok: false, error: { code: 'invalid_arguments' } });
    }
    expect(api('saveJob', { url: 'ftp://x.cz/a' })).toMatchObject({ ok: false, error: { code: 'url_invalid' } });
  });
});

describe('applications api', () => {
  function prepared() {
    const ctx = setup({ [CLEAN_URL]: { status: 200, html: AD } });
    const { api, drive } = ctx;
    const saved = api('saveJob', { url: AD_URL }) as { ok: true; data: { job: { id: string } } };
    for (const type of ['resume', 'cover_letter']) {
      const docId = drive.addTemplate(`${type}: {{name}} for {{company}} as {{position}} {{body}}`);
      expect(api('addTemplate', { type, language: 'en', name: type, docUrl: `https://docs.google.com/document/d/${docId}/edit` })).toMatchObject({ ok: true });
    }
    api('updateProfile', { name: 'Eva Example', email: 'eva@example.com' });
    return { ...ctx, jobId: saved.data.job.id };
  }

  it('creates an application with documents filled from the templates and the profile', () => {
    const { api, drive, jobId } = prepared();
    const created = api('createApplication', { jobId }) as { ok: true; data: { application: { id: string; status: string }; documents: { doc_url: string }[]; warnings: unknown[] } };
    expect(created).toMatchObject({ ok: true, data: { application: { status: 'draft' }, warnings: [] } });
    expect(created.data.documents).toHaveLength(2);
    const resume = [...drive.documents.values()].find((d) => d.name.startsWith('Resume – '));
    expect(resume?.content).toBe('resume: Eva Example for Example Ltd as Data Analyst {{body}}');
  });

  it('prepareApplication creates the application and queues the AI tasks', () => {
    const { api, jobId } = prepared();
    expect(api('prepareApplication', { jobId })).toMatchObject({ ok: false, error: { code: 'match_experience_required' } });
    expect((api('listApplications') as { data: unknown[] }).data).toHaveLength(0);
    api('updateSettings', { candidate_experience: 'Ten years of TypeScript' });
    const result = api('prepareApplication', { jobId }) as { ok: true; data: { application: { id: string; job_id: string }; documents: unknown[]; tasks: { type: string }[]; warnings: unknown[] } };
    expect(result).toMatchObject({ ok: true, data: { application: { job_id: jobId }, warnings: expect.any(Array) } });
    expect(result.data.documents).toHaveLength(2);
    expect(result.data.tasks.map((t) => t.type).sort()).toEqual(['cover_letter', 'resume_tailor']);
    const listed = (api('listAiTasks') as { data: { type: string; status: string; application_id: string }[] }).data;
    expect(listed.filter((t) => t.status === 'pending' && t.application_id === result.data.application.id)).toHaveLength(2);
    expect(api('prepareApplication', { jobId })).toMatchObject({ ok: false, error: { code: 'application_exists' } });
    expect(api('prepareApplication', {})).toMatchObject({ ok: false, error: { code: 'invalid_arguments' } });
    expect(api('prepareApplication', { jobId: 'ghost' })).toMatchObject({ ok: false, error: { code: 'job_not_found' } });
  });

  it('shows the whole application with timeline, exports a PDF and previews safe HTML', () => {
    const { api, jobId } = prepared();
    const { data } = api('createApplication', { jobId }) as { ok: true; data: { application: { id: string }; documents: { id: string }[] } };
    const applicationId = data.application.id;
    const exported = api('exportDocumentPdf', { id: data.documents[0]!.id }) as { ok: true; data: { pdf_url: string; pdf_stale: boolean } };
    expect(exported.data.pdf_url).toMatch(/^https:/);
    expect(api('previewDocument', { id: data.documents[0]!.id })).toMatchObject({ ok: true, data: { html: expect.stringContaining('Eva Example') } });
    api('addQuestion', { applicationId, question: 'Why us?', maxSentences: 100 });
    api('addCommunication', { applicationId, direction: 'outgoing', channel: 'email', summary: 'Sent' });
    api('addReminder', { applicationId, dueAt: '2026-10-20', text: 'Call HR' });
    api('setApplicationStatus', { id: applicationId, to: 'sent' });
    const detail = api('getApplication', { id: applicationId }) as { ok: true; data: { documents: unknown[]; questions: unknown[]; communications: unknown[]; reminders: unknown[]; timeline: { type: string }[]; job: { title: string }; company: { name: string } } };
    expect(detail.data).toMatchObject({ job: { title: 'Data Analyst' }, company: { name: 'Example Ltd' } });
    expect(detail.data.documents).toHaveLength(2);
    expect(detail.data.questions).toHaveLength(1);
    expect(new Set(detail.data.timeline.map((e) => e.type))).toEqual(new Set(['status', 'document', 'pdf', 'communication', 'reminder']));
    const listed = api('listApplications') as { ok: true; data: { job_title: string; company_name: string }[] };
    expect(listed.data).toMatchObject([{ job_title: 'Data Analyst', company_name: 'Example Ltd' }]);
  });

  it('answers questions within the limit and manages reminders', () => {
    const { api, jobId } = prepared();
    const applicationId = (api('createApplication', { jobId }) as { data: { application: { id: string } } }).data.application.id;
    const question = (api('addQuestion', { applicationId, question: 'Why?', maxSentences: 2 }) as { data: { id: string } }).data;
    expect(api('answerQuestion', { id: question.id, answer: 'One. Two. Three.' })).toMatchObject({ ok: false, error: { code: 'answer_too_long' } });
    expect(api('answerQuestion', { id: question.id, answer: 'fine' })).toMatchObject({ ok: true, data: { status: 'answered' } });
    const reminder = (api('addReminder', { applicationId, dueAt: '2026-10-20', text: 'x' }) as { data: { id: string } }).data;
    expect(api('postponeReminder', { id: reminder.id, dueAt: '2026-10-25' })).toMatchObject({ ok: true, data: { due_at: '2026-10-25' } });
    expect(api('listReminders')).toMatchObject({ ok: true, data: { reminders: [{ id: reminder.id }], buckets: { overdue: [], today: [], soon: [] } } });
    expect(api('completeReminder', { id: reminder.id })).toMatchObject({ ok: true, data: { status: 'done' } });
  });

  it('adds a document from a template and copies documents when applying again', () => {
    const { api, container, jobId } = prepared();
    const first = (api('createApplication', { jobId }) as { data: { application: { id: string } } }).data.application.id;
    const templateId = container.templates.list()[0]!.id;
    expect(api('addApplicationDocument', { applicationId: first, templateId })).toMatchObject({ ok: true, data: { application_id: first } });
    const again = api('createApplication', { jobId, fromApplicationId: first }) as { ok: true; data: { documents: unknown[]; warnings: { code: string }[] } };
    expect(again.data.documents).toHaveLength(3);
    expect(again.data.warnings.map((w) => w.code)).toEqual(['active_application_exists']);
  });

  it('validates arguments and reports coded errors', () => {
    const { api } = setup();
    for (const [method, args] of [
      ['createApplication', undefined], ['createApplication', { jobId: 5 }], ['createApplication', { jobId: 'j', language: 5 }],
      ['addTemplate', { type: 'resume' }], ['updateProfile', { password: 'x' }], ['updateProfile', { name: 5 }],
      ['addQuestion', { applicationId: 'a', question: 5 }], ['addQuestion', { applicationId: 'a', question: 'q', maxSentences: 'x' }],
      ['addCommunication', { applicationId: 'a', direction: 'incoming', channel: 'email' }],
      ['addReminder', { applicationId: 'a', dueAt: 5, text: 'x' }], ['postponeReminder', { id: 'r' }], ['exportDocumentPdf', {}],
    ] as const) {
      expect(api(method, args), `${method} ${JSON.stringify(args)}`).toMatchObject({ ok: false, error: { code: 'invalid_arguments' } });
    }
    expect(api('createApplication', { jobId: 'ghost' })).toMatchObject({ ok: false, error: { code: 'job_not_found' } });
    expect(api('exportDocumentPdf', { id: 'ghost' })).toMatchObject({ ok: false, error: { code: 'document_not_found' } });
    expect(api('addTemplate', { type: 'poem', language: 'en', name: 'x', docUrl: 'https://docs.google.com/document/d/1/edit' })).toMatchObject({ ok: false, error: { code: 'template_invalid' } });
  });
});

describe('overview api', () => {
  function seeded() {
    const ctx = setup({ [CLEAN_URL]: { status: 200, html: AD } });
    const { api, drive } = ctx;
    const jobId = (api('saveJob', { url: AD_URL }) as { data: { job: { id: string } } }).data.job.id;
    const docId = drive.addTemplate('{{name}}');
    api('addTemplate', { type: 'resume', language: '', name: 'Resume', docUrl: `https://docs.google.com/document/d/${docId}/edit` });
    const applicationId = (api('createApplication', { jobId }) as { data: { application: { id: string } } }).data.application.id;
    return { ...ctx, jobId, applicationId };
  }

  it('shows a job with its company and applications and updates its notes', () => {
    const { api, jobId, applicationId } = seeded();
    expect(api('getJob', { id: jobId })).toMatchObject({
      ok: true,
      data: { job: { title: 'Data Analyst' }, company: { name: 'Example Ltd' }, applications: [{ id: applicationId, job_title: 'Data Analyst' }] },
    });
    expect(api('updateJob', { id: jobId, notes: 'Hello', is_gig: true })).toMatchObject({ ok: true, data: { notes: 'Hello', is_gig: true } });
    expect(api('listJobs')).toMatchObject({ ok: true, data: [{ company_name: 'Example Ltd', application_count: 1 }] });
  });

  it('shows the status and id of the newest match task on the job row', () => {
    const { api, jobId } = seeded();
    expect(api('listJobs')).toMatchObject({ ok: true, data: [{ match_task_status: '', match_task_id: '' }] });
    api('updateSettings', { candidate_experience: 'Ten years of TypeScript' });
    const task = (api('requestJobMatch', { id: jobId }) as { data: { id: string } }).data;
    expect(api('listJobs')).toMatchObject({ ok: true, data: [{ match_task_status: 'pending', match_task_id: task.id }] });
  });

  it('lists companies with counts and edits one', () => {
    const { api } = seeded();
    const list = api('listCompanies') as { ok: true; data: { id: string; job_count: number; application_count: number }[] };
    expect(list.data).toMatchObject([{ job_count: 1, application_count: 1 }]);
    const id = list.data[0]!.id;
    expect(api('getCompany', { id })).toMatchObject({ ok: true, data: { company: { id }, jobs: [{ title: 'Data Analyst' }], applications: [{ company_name: 'Example Ltd' }] } });
    expect(api('updateCompany', { id, name: 'Renamed', website: 'https://example.com' })).toMatchObject({ ok: true, data: { name: 'Renamed' } });
    expect(api('updateCompany', { id, name: '' })).toMatchObject({ ok: false, error: { code: 'company_name_required' } });
  });

  it('builds the dashboard', () => {
    const { api, applicationId } = seeded();
    api('addReminder', { applicationId, dueAt: '2026-10-10', text: 'Call HR' });
    expect(api('getDashboard')).toMatchObject({
      ok: true,
      data: { reminders: { today: [{ text: 'Call HR', job_title: 'Data Analyst' }] }, statusCounts: { draft: 1, sent: 0 } },
    });
  });

  it('validates arguments', () => {
    const { api } = setup();
    for (const [method, args] of [['getJob', {}], ['updateJob', { id: 'j', notes: 5 }], ['updateJob', { id: 'j', is_gig: 'yes' }], ['getCompany', undefined], ['updateCompany', { id: 'c', website: 5 }]] as const) {
      expect(api(method, args), method).toMatchObject({ ok: false, error: { code: 'invalid_arguments' } });
    }
    expect(api('getJob', { id: 'ghost' })).toMatchObject({ ok: false, error: { code: 'job_not_found' } });
    expect(api('getCompany', { id: 'ghost' })).toMatchObject({ ok: false, error: { code: 'company_not_found' } });
  });
});

describe('deleteApplication api', () => {
  function seeded() {
    const ctx = setup({ [CLEAN_URL]: { status: 200, html: AD } });
    const { api, drive } = ctx;
    const jobId = (api('saveJob', { url: AD_URL }) as { data: { job: { id: string } } }).data.job.id;
    const docId = drive.addTemplate('{{name}}');
    api('addTemplate', { type: 'resume', language: '', name: 'Resume', docUrl: `https://docs.google.com/document/d/${docId}/edit` });
    const created = (api('createApplication', { jobId }) as { data: { application: { id: string; folder_url: string } } }).data.application;
    api('addQuestion', { applicationId: created.id, question: 'Why?' });
    api('addCommunication', { applicationId: created.id, direction: 'note', channel: 'other', summary: 'x' });
    api('addReminder', { applicationId: created.id, dueAt: '2026-10-20', text: 'Call' });
    return { ...ctx, jobId, applicationId: created.id, folderUrl: created.folder_url };
  }

  it('removes the application with everything that belongs to it and trashes the folder', () => {
    const { api, container, drive, applicationId } = seeded();
    const foldersBefore = drive.folders.size;
    expect(api('deleteApplication', { id: applicationId, trashFolder: true })).toMatchObject({
      ok: true,
      data: { removed: { documents: 2, questions: 1, communications: 1, reminders: 1 }, folderTrashed: true, warnings: [] },
    });
    expect(container.applications.list()).toEqual([]);
    expect(container.documents.list()).toEqual([]);
    expect(container.questions.list()).toEqual([]);
    expect(container.reminders.list()).toEqual([]);
    expect(drive.folders.size).toBe(foldersBefore - 1);
    expect(api('getApplication', { id: applicationId })).toMatchObject({ ok: false, error: { code: 'application_not_found' } });
    expect(container.jobs.list()).toHaveLength(1);
  });

  it('keeps the folder unless asked, and the next application starts again with a clean folder', () => {
    const { api, drive, jobId, applicationId } = seeded();
    const foldersBefore = drive.folders.size;
    expect(api('deleteApplication', { id: applicationId })).toMatchObject({ ok: true, data: { folderTrashed: false } });
    expect(drive.folders.size).toBe(foldersBefore);
    expect(api('createApplication', { jobId })).toMatchObject({ ok: true, data: { application: { attempt: 1 } } });
  });

  it('validates arguments and reports an unknown application', () => {
    const { api } = setup();
    for (const args of [undefined, {}, { id: 5 }, { id: 'a', trashFolder: 'yes' }]) {
      expect(api('deleteApplication', args), JSON.stringify(args)).toMatchObject({ ok: false, error: { code: 'invalid_arguments' } });
    }
    expect(api('deleteApplication', { id: 'ghost' })).toMatchObject({ ok: false, error: { code: 'application_not_found' } });
  });
});

describe('job import api', () => {
  const BLOCKED = 'https://blocked.example/jobs/9';
  const pages = (): Record<string, FakePage> => ({ [CLEAN_URL]: { status: 200, html: AD }, [BLOCKED]: { status: 429, html: '' } });

  it('importJob saves a readable link and queues an unreadable one', () => {
    const { api } = setup(pages());
    expect(api('importJob', { url: CLEAN_URL })).toMatchObject({ ok: true, data: { status: 'saved' } });
    expect((api('listJobs') as { data: unknown[] }).data).toHaveLength(1);
    expect(api('importJob', { url: BLOCKED })).toMatchObject({
      ok: true,
      data: { status: 'queued', job: { status: 'awaiting' }, task: { type: 'import_job' } },
    });
    const tasks = (api('listAiTasks') as { data: { type: string; status: string }[] }).data;
    expect(tasks.filter((t) => t.type === 'import_job' && t.status === 'pending')).toHaveLength(1);
  });

  it('importJob rejects a non-link', () => {
    const { api } = setup(pages());
    expect(api('importJob', { url: 'not a link' })).toMatchObject({ ok: true, data: { status: 'invalid' } });
    expect(api('importJob', {})).toMatchObject({ ok: false, error: { code: 'invalid_arguments' } });
  });

  it('deleteJob deletes an awaiting job, refuses a normal one', () => {
    const { api, container } = setup(pages());
    const saved = api('importJob', { url: CLEAN_URL }) as { data: { job: { id: string } } };
    const queued = api('importJob', { url: BLOCKED }) as { data: { job: { id: string } } };
    expect(api('deleteJob', { id: saved.data.job.id })).toMatchObject({ ok: false, error: { code: 'job_not_deletable' } });
    expect(api('deleteJob', { id: queued.data.job.id })).toEqual({ ok: true, data: null });
    expect(container.jobs.list().map((j) => j.id)).toEqual([saved.data.job.id]);
  });

  it('removeAiTask of an import task removes the awaiting job', () => {
    const { api, container } = setup(pages());
    const queued = api('importJob', { url: BLOCKED }) as { data: { task: { id: string } } };
    expect(api('removeAiTask', { id: queued.data.task.id })).toMatchObject({ ok: true });
    expect(container.jobs.list()).toEqual([]);
  });

  it('getMenuCounts counts waiting AI tasks and status-new jobs but not the awaiting placeholder', () => {
    const { api } = setup(pages());
    api('importJob', { url: BLOCKED });
    const jobs = (api('listJobs') as { data: { status: string }[] }).data;
    const result = api('getMenuCounts') as { ok: true; data: { newJobs: number; aiTasksWaiting: number } };
    expect(result.ok).toBe(true);
    expect(result.data.aiTasksWaiting).toBeGreaterThanOrEqual(1);
    expect(result.data.newJobs).toBe(jobs.filter((j) => j.status === 'new').length);
  });

  it('getMenuCounts counts applications in draft and follows status changes and new applications', () => {
    const { api } = setup(pages());
    const saved = api('saveJob', { url: CLEAN_URL }) as { ok: true; data: { job: { id: string } } };
    const jobId = saved.data.job.id;
    const draftCount = () => (api('getMenuCounts') as { data: { draftApplications: number } }).data.draftApplications;
    const listedDrafts = () => (api('listApplications') as { data: { status: string }[] }).data.filter((a) => a.status === 'draft').length;
    expect(draftCount()).toBe(0);
    const first = (api('createApplication', { jobId }) as { data: { application: { id: string } } }).data.application.id;
    expect(draftCount()).toBe(1);
    expect(draftCount()).toBe(listedDrafts());
    api('createApplication', { jobId, fromApplicationId: first });
    expect(draftCount()).toBe(2);
    expect(draftCount()).toBe(listedDrafts());
    api('setApplicationStatus', { id: first, to: 'sent' });
    expect(draftCount()).toBe(1);
    expect(draftCount()).toBe(listedDrafts());
  });

  it('getDashboard counts waiting AI tasks', () => {
    const { api } = setup(pages());
    api('importJob', { url: BLOCKED });
    expect(api('getDashboard')).toMatchObject({ ok: true, data: { aiTasksWaiting: { total: 1, byType: { import_job: 1 } } } });
  });

  it('refreshJob re-reads the ad, reports the changed fields and keeps the user data', () => {
    const fetched = pages();
    const { api, container } = setup(fetched);
    const saved = api('saveJob', { url: CLEAN_URL }) as { data: { job: { id: string } } };
    const id = saved.data.job.id;
    container.jobs.update(id, { notes: 'mine', ai_salary: '1 (1-1)' });
    fetched[CLEAN_URL] = { status: 200, html: AD.replace(/Data Analyst/g, 'Lead Data Analyst') };
    const result = api('refreshJob', { id }) as { ok: true; data: { job: { title: string; notes: string; ai_salary: string }; changed: string[] } };
    expect(result).toMatchObject({ ok: true, data: { changed: ['title'], job: { title: 'Lead Data Analyst', notes: 'mine', ai_salary: '1 (1-1)' } } });
    expect(container.jobs.get(id)!.title).toBe('Lead Data Analyst');
  });

  it('refreshJob answers with coded errors', () => {
    const fetched = pages();
    const { api } = setup(fetched);
    expect(api('refreshJob', {})).toMatchObject({ ok: false, error: { code: 'invalid_arguments' } });
    expect(api('refreshJob', { id: 'ghost' })).toMatchObject({ ok: false, error: { code: 'job_not_found' } });
    const queued = api('importJob', { url: BLOCKED }) as { data: { job: { id: string } } };
    expect(api('refreshJob', { id: queued.data.job.id })).toMatchObject({ ok: false, error: { code: 'job_awaiting' } });
    const saved = api('saveJob', { url: CLEAN_URL }) as { data: { job: { id: string } } };
    fetched[CLEAN_URL] = { status: 429, html: '' };
    expect(api('refreshJob', { id: saved.data.job.id })).toMatchObject({ ok: false, error: { code: 'refresh_unreadable', params: { status: 429 } } });
  });
});

type Ok<T> = { ok: true; data: T };
const HKEY = 'candidate_experience';

describe('history', () => {
  it('records the saves of the experience and lists them newest first', () => {
    const { api } = setup();
    api('updateSettings', { [HKEY]: 'First' });
    api('updateSettings', { [HKEY]: 'Second' });
    const { data } = api('listHistory', { key: HKEY }) as Ok<HistoryList>;
    expect(data.entries.map((e) => [e.version, e.source, e.text])).toEqual([[3, 'saved', 'Second'], [2, 'saved', 'First'], [1, 'initial', '']]);
    expect(data).toMatchObject({ used: 2, max: 50, live: 'Second' });
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it('keeps a text that starts with = as text', () => {
    const { api } = setup();
    api('updateSettings', { [HKEY]: '=SUM(1,1)\n"quoted"' });
    const { data } = api('listHistory', { key: HKEY }) as Ok<HistoryList>;
    expect(data.entries[0]!.text).toBe('=SUM(1,1)\n"quoted"');
  });

  it('restores a version by saving it again as a new version', () => {
    const { api } = setup();
    api('updateSettings', { [HKEY]: 'First' });
    api('updateSettings', { [HKEY]: 'Second' });
    const first = (api('listHistory', { key: HKEY }) as Ok<HistoryList>).data.entries.find((e) => e.text === 'First')!;
    expect(api('restoreHistory', { key: HKEY, id: first.id })).toMatchObject({ ok: true, data: { candidate_experience: 'First' } });
    const after = (api('listHistory', { key: HKEY }) as Ok<HistoryList>).data.entries[0]!;
    expect(after).toMatchObject({ version: 4, source: 'restored', restored_from: String(first.version), text: 'First' });
  });

  it('refuses to restore a version of another text or an unknown one', () => {
    const { api } = setup();
    expect(api('restoreHistory', { key: HKEY, id: 'nope' })).toMatchObject({ ok: false, error: { code: 'history_entry_not_found' } });
    expect(api('restoreHistory', { key: 'ui_language', id: 'x' })).toMatchObject({ ok: false, error: { code: 'invalid_arguments' } });
    expect(api('listHistory', { key: 'ui_language' })).toMatchObject({ ok: false, error: { code: 'invalid_arguments' } });
  });

  it('updates the comment and the pin, and deletes an old unpinned version', () => {
    const { api } = setup();
    for (const text of ['A', 'B', 'C']) api('updateSettings', { [HKEY]: text });
    const entries = (api('listHistory', { key: HKEY }) as Ok<HistoryList>).data.entries;
    const b = entries.find((e) => e.text === 'B')!;
    expect(api('updateHistoryEntry', { id: b.id, comment: 'Sent to Acme', pinned: true })).toMatchObject({ ok: true, data: { comment: 'Sent to Acme', pinned: true } });
    expect(api('deleteHistoryEntry', { id: b.id })).toMatchObject({ ok: false, error: { code: 'history_entry_locked' } });
    const a = entries.find((e) => e.text === 'A')!;
    expect(api('deleteHistoryEntry', { id: a.id })).toEqual({ ok: true, data: null });
    expect(api('updateHistoryEntry', { id: b.id, comment: 5 })).toMatchObject({ ok: false, error: { code: 'invalid_arguments' } });
    expect(api('updateHistoryEntry', { id: b.id, pinned: 'yes' })).toMatchObject({ ok: false, error: { code: 'invalid_arguments' } });
  });

  it('refuses to save at the limit, explains it, and works again after the user pins or deletes', () => {
    const { api } = setup();
    api('updateSettings', { history_max_versions: '1' });
    api('updateSettings', { [HKEY]: 'A' });
    expect(api('updateSettings', { [HKEY]: 'B' })).toMatchObject({ ok: false, error: { code: 'history_full', params: { used: 1, max: 1 } } });
    expect(api('getSettings')).toMatchObject({ ok: true, data: { settings: { candidate_experience: 'A' } } });
    const a = (api('listHistory', { key: HKEY }) as Ok<HistoryList>).data.entries.find((e) => e.text === 'A')!;
    api('updateHistoryEntry', { id: a.id, pinned: true });
    expect(api('updateSettings', { [HKEY]: 'B' })).toMatchObject({ ok: true });
  });

  it('keeps the app working and answers an empty history while the History sheet is missing; saving the experience asks for setup', () => {
    const { api } = setup({}, { missingSheets: ['History'] });
    expect(api('listHistory', { key: HKEY })).toEqual({ ok: true, data: { entries: [], used: 0, max: 50, live: '' } });
    expect(api('getSettings')).toMatchObject({ ok: true });
    expect(api('updateSettings', { ui_language: 'cs' })).toMatchObject({ ok: true });
    expect(api('updateSettings', { [HKEY]: 'Text' })).toMatchObject({ ok: false, error: { code: 'sheet_missing', params: { sheet: 'History' } } });
  });
});
