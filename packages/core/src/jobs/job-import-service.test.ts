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

function setup(pages: Record<string, FakePage> = {}) {
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
    newId, now: () => NOW, experience: () => '', language: () => 'en',
    prompt: (type) => DEFAULT_PROMPTS.find((p) => p.type === type)!.instruction,
  });
  const service = new JobImportService({ jobService, aiTasks, jobs, tasks, companies, applications });
  return { service, jobs, tasks, fetcher, applications };
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

  it('deleteAwaiting removes the job and its tasks; refuses other statuses', () => {
    const { service, jobs, tasks } = setup({ [URL1]: { status: 200, html: AD }, [URL2]: { status: 429, html: '' } });
    const saved = service.importOne(URL1);
    const queued = service.importOne(URL2);
    if (saved.status !== 'saved' || queued.status !== 'queued') throw new Error('unexpected');
    expect(errorOf(() => service.deleteAwaiting(saved.job.id)).code).toBe('job_not_deletable');
    expect(errorOf(() => service.deleteAwaiting('nope')).code).toBe('job_not_found');
    tasks.update(queued.task.id, { status: 'in_progress' });
    service.deleteAwaiting(queued.job.id);
    expect(jobs.get(queued.job.id)).toBeUndefined();
    expect(tasks.list()).toHaveLength(0);
    expect(jobs.get(saved.job.id)).toBeDefined();
  });

  it('refuses to delete a job that has an application', () => {
    const { service, jobs, applications } = setup({ [URL2]: { status: 429, html: '' } });
    const queued = service.importOne(URL2);
    if (queued.status !== 'queued') throw new Error('unexpected');
    applications.insert(makeApplication({ id: 'a1', job_id: queued.job.id }));
    expect(errorOf(() => service.deleteAwaiting(queued.job.id)).code).toBe('job_not_deletable');
    expect(jobs.get(queued.job.id)).toBeDefined();
  });
});
