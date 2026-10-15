import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AiTaskService } from '../applications/ai-task-service';
import { InMemoryRepository } from '../repository';
import { DEFAULT_PROMPTS } from '../seed';
import { errorOf } from '../testing/errors';
import { FakeDrive } from '../testing/fake-drive';
import { FakePageFetcher, type FakePage } from '../testing/fake-fetcher';
import { makeApplication, sequentialIds } from '../testing/fixtures';
import type { AiTask, Application, ApplicationDocument, Company, Job, Question } from '../types';
import { JobImportService } from './job-import-service';
import { JobService } from './job-service';

const NOW = '2026-10-10T08:00:00.000Z';
const AD = readFileSync(new URL('../../fixtures/jobs-cz/ad.html', import.meta.url), 'utf8');
const URL1 = 'https://www.jobs.cz/rpd/2000000001/';
const URL2 = 'https://www.jobs.cz/rpd/2000000002/';

function setup(pages: Record<string, FakePage> = {}, experience = '') {
  const jobs = new InMemoryRepository<Job>();
  const companies = new InMemoryRepository<Company>();
  const tasks = new InMemoryRepository<AiTask>();
  const applications = new InMemoryRepository<Application>();
  const fetcher = new FakePageFetcher(pages);
  const drive = new FakeDrive();
  const root = drive.ensureFolder(null, 'JobHunters');
  const newId = sequentialIds('x');
  const jobService = new JobService({ jobs, companies, fetcher, drive, rootFolder: () => root, newId, now: () => NOW });
  const aiTasks = new AiTaskService({
    tasks, jobs, companies,
    documents: new InMemoryRepository<ApplicationDocument>(),
    questions: new InMemoryRepository<Question>(),
    applications,
    newId, now: () => NOW, experience: () => experience, language: () => 'en',
    prompt: (type) => DEFAULT_PROMPTS.find((p) => p.type === type)!.instruction,
  });
  const service = new JobImportService({ jobService, aiTasks });
  return { service, jobs, tasks, fetcher, applications, aiTasks };
}

describe('JobImportService', () => {
  it('saves a readable link', () => {
    const { service, jobs, tasks } = setup({ [URL1]: { status: 200, html: AD } });
    const result = service.importOne(URL1);
    expect(result.status).toBe('saved');
    expect(jobs.list()).toHaveLength(1);
    expect(tasks.list()).toHaveLength(0);
  });

  it('queues an unreadable link: placeholder + one task', () => {
    const { service, jobs, tasks } = setup({ [URL2]: { status: 429, html: '' } });
    const result = service.importOne(URL2);
    expect(result).toMatchObject({ status: 'queued', fetchStatus: 429 });
    if (result.status !== 'queued') throw new Error('expected queued');
    expect(result.job.status).toBe('awaiting');
    expect(result.task.type).toBe('import_job');
    expect(jobs.list()).toHaveLength(1);
    expect(tasks.list()).toHaveLength(1);
  });

  it('reports a duplicate of a saved job and of a placeholder, with no second task', () => {
    const { service, tasks, fetcher } = setup({ [URL1]: { status: 200, html: AD }, [URL2]: { status: 429, html: '' } });
    service.importOne(URL1);
    service.importOne(URL2);
    const calls = fetcher.calls.length;
    expect(service.importOne(URL1).status).toBe('duplicate');
    expect(service.importOne(URL2).status).toBe('duplicate');
    expect(tasks.list()).toHaveLength(1);
    expect(fetcher.calls.length).toBe(calls);
  });

  it('rejects text that is not an http(s) link without a download', () => {
    const { service, fetcher } = setup();
    expect(service.importOne('hello world')).toEqual({ status: 'invalid' });
    expect(service.importOne('ftp://example.com/x')).toEqual({ status: 'invalid' });
    expect(fetcher.calls).toEqual([]);
  });
});

describe('importWithAi', () => {
  const EXPERIENCE = 'Ten years of Kotlin';

  it('creates a placeholder and ONE task that imports the ad and evaluates the match, without downloading anything', () => {
    const { service, jobs, tasks, fetcher } = setup({}, EXPERIENCE);
    const result = service.importWithAi(URL1);
    expect(result.status).toBe('queued');
    expect(fetcher.calls).toEqual([]);
    expect(jobs.list()).toHaveLength(1);
    expect(jobs.list()[0]).toMatchObject({ status: 'awaiting', url: URL1 });
    expect(tasks.list()).toHaveLength(1);
    const task = tasks.list()[0]!;
    expect(task).toMatchObject({ type: 'import_match_job', status: 'pending', job_id: jobs.list()[0]!.id, target_type: 'job' });
    expect(task.instructions).toContain(URL1);
    expect(task.instructions).toContain(jobs.list()[0]!.id);
    expect(task.instructions).toContain('match_percent');
    expect(task.instructions).not.toMatch(/\{\{\s*\w+\s*\}\}/);
  });

  it('puts the extra instructions of the user into the task, and leaves no placeholder when there are none', () => {
    const { service, tasks } = setup({}, EXPERIENCE);
    service.importWithAi(URL1, '  The contact person is at the bottom of the page.  ');
    const task = tasks.list()[0]!;
    expect(task.instructions).toContain('Instructions from the user: The contact person is at the bottom of the page.');
    expect(task.instructions).not.toMatch(/\{\{\s*\w+\s*\}\}/);
    expect(task.instructions).toContain('contact_person');
    const { service: plain, tasks: plainTasks } = setup({}, EXPERIENCE);
    plain.importWithAi(URL1);
    expect(plainTasks.list()[0]!.instructions).not.toContain('Instructions from the user:');
  });

  it('still delivers the extra instructions when the user kept an older prompt without the notes place', () => {
    const { aiTasks, jobs, tasks, service } = setup({}, EXPERIENCE);
    service.importWithAi(URL1);
    tasks.remove(tasks.list()[0]!.id);
    const old = new AiTaskService({
      tasks, jobs, companies: new InMemoryRepository<Company>(), documents: new InMemoryRepository<ApplicationDocument>(), questions: new InMemoryRepository<Question>(),
      applications: new InMemoryRepository<Application>(), newId: sequentialIds('y'), now: () => NOW, experience: () => EXPERIENCE, language: () => 'en',
      prompt: () => 'OLD PROMPT for {{url}} and {{job_id}}',
    });
    expect(aiTasks).toBeDefined();
    const task = old.requestImportAndMatch(jobs.list()[0]!.id, 'Ignore the second position');
    expect(task.instructions).toBe(['OLD PROMPT for ' + URL1 + ' and ' + jobs.list()[0]!.id, '', 'Instructions from the user: Ignore the second position'].join(String.fromCharCode(10)));
  });

  it('needs the candidate experience and then creates nothing', () => {
    const { service, jobs, tasks } = setup({}, '');
    expect(() => service.importWithAi(URL1)).toThrow();
    expect(jobs.list()).toHaveLength(0);
    expect(tasks.list()).toHaveLength(0);
  });

  it('refuses an invalid address and does not queue a second task for a known ad', () => {
    const { service, jobs, tasks } = setup({}, EXPERIENCE);
    expect(service.importWithAi('not a link').status).toBe('invalid');
    expect(service.importWithAi(URL1).status).toBe('queued');
    expect(service.importWithAi(URL1).status).toBe('duplicate');
    expect(jobs.list()).toHaveLength(1);
    expect(tasks.list()).toHaveLength(1);
  });

  it('counts as the match task of the job and removing the task takes the waiting placeholder with it', () => {
    const { service, jobs, tasks, aiTasks } = setup({}, EXPERIENCE);
    service.importWithAi(URL1);
    const job = jobs.list()[0]!;
    expect(aiTasks.matchFor(job.id)?.type).toBe('import_match_job');
    aiTasks.remove(tasks.list()[0]!.id);
    expect(jobs.list()).toHaveLength(0);
  });
});
