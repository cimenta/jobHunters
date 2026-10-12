import { describe, expect, it } from 'vitest';
import { InMemoryAppendLog, InMemoryRepository } from '../repository';
import { SETTINGS_DEFAULTS, parseSettings } from '../settings';
import { DEFAULT_PROMPTS } from '../seed';
import { FakeDrive } from '../testing/fake-drive';
import { errorOf } from '../testing/errors';
import { makeApplication, makeCompany, makeJob, makeTemplate, sequentialIds } from '../testing/fixtures';
import type { AiTask, Application, ApplicationDocument, Company, Job, Question, StatusHistoryEntry, Template } from '../types';
import { AiTaskService } from './ai-task-service';
import { ApplicationFactory } from './application-factory';
import { ApplicationPreparer } from './application-preparer';

const NOW = '2026-10-13T08:00:00.000Z';

function setup(options: { experience?: string; languages?: string[]; types?: string[]; job?: Partial<Job> } = {}) {
  const drive = new FakeDrive();
  const root = drive.ensureFolder(null, 'JobHunters');
  const templates = new InMemoryRepository<Template>();
  for (const language of options.languages ?? ['en', 'cs']) {
    for (const type of options.types ?? ['resume', 'cover_letter']) {
      const docId = drive.addTemplate('Dear {{company}} {{body}}');
      templates.insert(makeTemplate({ id: `t-${type}-${language}`, type, language, doc_url: `https://docs.example.invalid/document/d/${docId}/edit` }));
    }
  }
  const jobs = new InMemoryRepository<Job>([makeJob({ id: 'j1', company_id: 'c1', language: 'cs', ...options.job })]);
  const companies = new InMemoryRepository<Company>([makeCompany({ id: 'c1', name: 'Example s.r.o.' })]);
  const applications = new InMemoryRepository<Application>();
  const documents = new InMemoryRepository<ApplicationDocument>();
  const tasks = new InMemoryRepository<AiTask>();
  const newId = sequentialIds('x');
  const settings = () => parseSettings({ ...SETTINGS_DEFAULTS, default_document_language: 'en' }).settings;
  const factory = new ApplicationFactory({
    jobs, companies, applications, documents, templates, history: new InMemoryAppendLog<StatusHistoryEntry>(),
    drive, rootFolder: () => root, profile: () => ({ name: 'Eva Example' }), settings, newId, now: () => NOW,
  });
  const experience = options.experience ?? 'Ten years of TypeScript';
  const aiTasks = new AiTaskService({
    tasks, jobs, companies, documents, questions: new InMemoryRepository<Question>(), applications, newId, now: () => NOW,
    experience: () => experience, language: () => 'en',
    prompt: (type) => DEFAULT_PROMPTS.find((p) => p.type === type)!.instruction,
  });
  const preparer = new ApplicationPreparer({ jobs, applications, factory, aiTasks, experience: () => experience, defaultLanguage: () => 'en' });
  return { preparer, jobs, applications, documents, tasks, aiTasks };
}

describe('prepare', () => {
  it('creates the application in the job language with one document and one pending AI task per document', () => {
    const { preparer, applications, tasks } = setup();
    const result = preparer.prepare('j1');
    expect(result.application.language).toBe('cs');
    expect(result.documents.map((d) => d.type).sort()).toEqual(['cover_letter', 'resume']);
    expect(result.tasks.map((t) => t.type).sort()).toEqual(['cover_letter', 'resume_tailor']);
    expect(result.tasks.every((t) => t.status === 'pending' && t.application_id === result.application.id)).toBe(true);
    expect(result.tasks.map((t) => t.target_id).sort()).toEqual(result.documents.map((d) => d.id).sort());
    expect(result.warnings).toEqual([]);
    expect(applications.list()).toHaveLength(1);
    expect(tasks.list()).toHaveLength(2);
  });

  it('uses the default document language when the job language is neither en nor cs, or empty', () => {
    for (const language of ['de', '']) {
      expect(setup({ job: { language } }).preparer.prepare('j1').application.language).toBe('en');
    }
    expect(setup({ job: { language: 'en' } }).preparer.prepare('j1').application.language).toBe('en');
  });

  it('refuses an unknown or awaiting job and creates nothing', () => {
    const { preparer, applications, tasks, jobs } = setup();
    expect(errorOf(() => preparer.prepare('zz')).code).toBe('job_not_found');
    jobs.update('j1', { status: 'awaiting' });
    expect(errorOf(() => preparer.prepare('j1')).code).toBe('job_awaiting');
    expect(applications.list()).toHaveLength(0);
    expect(tasks.list()).toHaveLength(0);
  });

  it('refuses an empty experience before creating anything', () => {
    const { preparer, applications, documents, tasks } = setup({ experience: '  ' });
    expect(errorOf(() => preparer.prepare('j1')).code).toBe('match_experience_required');
    expect(applications.list()).toHaveLength(0);
    expect(documents.list()).toHaveLength(0);
    expect(tasks.list()).toHaveLength(0);
  });

  it('refuses a job that already has an application and queues nothing', () => {
    const { preparer, applications, tasks } = setup();
    applications.insert(makeApplication({ id: 'a0', job_id: 'j1' }));
    expect(errorOf(() => preparer.prepare('j1')).code).toBe('application_exists');
    expect(applications.list()).toHaveLength(1);
    expect(tasks.list()).toHaveLength(0);
    // a second tick after a successful one fails the same way
    const second = setup();
    second.preparer.prepare('j1');
    expect(errorOf(() => second.preparer.prepare('j1')).code).toBe('application_exists');
    expect(second.applications.list()).toHaveLength(1);
    expect(second.tasks.list()).toHaveLength(2);
  });

  it('warns about a missing template: the factory makes an empty document, which still gets its task, and the warning is returned', () => {
    const { preparer } = setup({ types: ['resume'] });
    const result = preparer.prepare('j1');
    expect(result.warnings).toMatchObject([{ code: 'template_missing', params: { type: 'cover_letter', language: 'cs' } }]);
    expect(result.documents).toHaveLength(2);
    expect(result.tasks).toHaveLength(2);
  });

  it('keeps the application and reports a warning when one task cannot be queued', () => {
    const { preparer, aiTasks } = setup();
    const original = aiTasks.requestDocument.bind(aiTasks);
    let calls = 0;
    aiTasks.requestDocument = (id: string, notes?: string) => {
      if (++calls === 1) throw new Error('boom');
      return original(id, notes);
    };
    const result = preparer.prepare('j1');
    expect(result.tasks).toHaveLength(1);
    expect(result.warnings).toMatchObject([{ code: 'ai_task_failed', params: { type: expect.any(String) } }]);
    expect(result.documents).toHaveLength(2);
  });
});
