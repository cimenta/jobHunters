import { describe, expect, it } from 'vitest';
import { parseJobStatusStyles } from '../job-status';
import { InMemoryRepository } from '../repository';
import { errorOf } from '../testing/errors';
import { FakePageFetcher, type FakePage } from '../testing/fake-fetcher';
import { makeApplication, makeJob } from '../testing/fixtures';
import type { Application, Job } from '../types';
import { AvailabilityService, nextAvailability, type AvailabilitySettings } from './availability-service';
import type { Verdict } from './rules';

const URL1 = 'https://example.com/job/1';
const OK: FakePage = { status: 200, html: 'open position' };
const verdict = (availability: Verdict['availability'], rule: string, reason = ''): Verdict => ({ availability, rule, reason });

function setup(jobs: Job[], pages: Record<string, FakePage> = {}, applications: Application[] = [], settings: Partial<AvailabilitySettings> = {}) {
  const jobRepo = new InMemoryRepository<Job>(jobs);
  const fetcher = new FakePageFetcher(pages);
  const logs: string[] = [];
  let time = 0;
  const service = new AvailabilityService({
    jobs: jobRepo, applications: new InMemoryRepository<Application>(applications), fetcher,
    settings: () => ({ offlineTexts: ['position has been filled'], immediateRules: ['offline_text'], statusStyles: {}, jobStatusStyles: parseJobStatusStyles('{}')!, ...settings }),
    now: () => '2026-10-12T18:00:00.000Z', clock: () => (time += 100),
    log: (flow, entity, message) => logs.push(`${flow}|${entity}|${message}`),
  });
  return { service, jobRepo, fetcher, logs };
}

describe('nextAvailability', () => {
  const job = makeJob({ availability: 'online', offline_strikes: 0 });

  it('resets everything on online', () => {
    expect(nextAvailability({ ...job, availability: 'unknown', offline_strikes: 1, availability_reason: 'x' }, verdict('online', 'default'), []))
      .toEqual({ availability: 'online', availability_reason: '', offline_strikes: 0 });
  });

  it('keeps the state and the strikes on unknown and only notes the reason', () => {
    expect(nextAvailability({ ...job, offline_strikes: 1 }, verdict('unknown', 'unknown_response', '429'), []))
      .toEqual({ availability: 'online', availability_reason: 'unknown_response: 429', offline_strikes: 1 });
  });

  it('marks offline at once for an immediate rule', () => {
    expect(nextAvailability(job, verdict('offline', 'offline_text', 'filled'), ['offline_text']))
      .toEqual({ availability: 'offline', availability_reason: 'offline_text: filled', offline_strikes: 0 });
  });

  it('needs a second offline verdict in a row for the other rules', () => {
    const first = nextAvailability(job, verdict('offline', 'http_gone', '404'), ['offline_text']);
    expect(first).toEqual({ availability: 'online', availability_reason: 'suspected http_gone: 404', offline_strikes: 1 });
    expect(nextAvailability({ ...job, ...first }, verdict('offline', 'redirect_elsewhere', 'https://x.example/'), []))
      .toMatchObject({ availability: 'offline', offline_strikes: 2 });
  });

  it('forgets a suspicion when an online verdict comes between', () => {
    const suspected = { ...job, ...nextAvailability(job, verdict('offline', 'http_gone', '404'), []) };
    const online = { ...suspected, ...nextAvailability(suspected, verdict('online', 'default'), []) };
    expect(nextAvailability(online, verdict('offline', 'http_gone', '404'), [])).toMatchObject({ availability: 'online', offline_strikes: 1 });
  });
});

describe('AvailabilityService.check', () => {
  it('stores the verdict and the time, and reports a change', () => {
    const { service, jobRepo, logs } = setup([makeJob({ id: 'j1', url: URL1 })], { [URL1]: { status: 200, html: 'The position has been filled' } });
    const result = service.check('j1');
    expect(result).toMatchObject({ changed: true, verdict: { rule: 'offline_text' }, job: { availability: 'offline', last_checked_at: '2026-10-12T18:00:00.000Z' } });
    expect(jobRepo.get('j1')?.availability_reason).toBe('offline_text: position has been filled');
    expect(logs).toEqual(['availability|j1|online -> offline (offline_text: position has been filled)']);
  });

  it('brings an offline job back when the page is there again', () => {
    const { service } = setup([makeJob({ id: 'j1', url: URL1, availability: 'offline', offline_strikes: 2 })], { [URL1]: OK });
    expect(service.check('j1')).toMatchObject({ changed: true, job: { availability: 'online', offline_strikes: 0, availability_reason: '' } });
  });

  it('needs two checks for a 404 and never goes offline on a blocked answer', () => {
    const { service } = setup([makeJob({ id: 'j1', url: URL1 })], { [URL1]: { status: 404, html: '' } });
    expect(service.check('j1')).toMatchObject({ changed: false, job: { availability: 'online', offline_strikes: 1 } });
    expect(service.check('j1')).toMatchObject({ changed: true, job: { availability: 'offline' } });
    const blocked = setup([makeJob({ id: 'j2', url: URL1 })], { [URL1]: { status: 429, html: '' } });
    expect(blocked.service.check('j2')).toMatchObject({ changed: false, job: { availability: 'online' } });
  });

  it('refuses an unknown job', () => {
    expect(errorOf(() => setup([]).service.check('zz'))).toMatchObject({ code: 'job_not_found' });
  });
});

describe('AvailabilityService.checkDue', () => {
  const jobs = [
    makeJob({ id: 'new', url: 'https://example.com/new', last_checked_at: '' }),
    makeJob({ id: 'old', url: 'https://example.com/old', last_checked_at: '2026-10-01T00:00:00.000Z' }),
    makeJob({ id: 'recent', url: 'https://example.com/recent', last_checked_at: '2026-10-11T00:00:00.000Z' }),
    makeJob({ id: 'gone', url: 'https://example.com/gone', availability: 'offline' }),
    makeJob({ id: 'closed', url: 'https://example.com/closed', last_checked_at: '2026-10-12T00:00:00.000Z' }),
    makeJob({ id: 'open', url: 'https://example.com/open', last_checked_at: '2026-10-05T00:00:00.000Z' }),
  ];
  const applications = [
    makeApplication({ id: 'a1', job_id: 'closed', status: 'rejected' }),
    makeApplication({ id: 'a2', job_id: 'open', status: 'sent' }),
    makeApplication({ id: 'a3', job_id: 'open', status: 'rejected' }),
  ];
  const pages = Object.fromEntries(jobs.map((job) => [job.url, OK]));

  it('looks at jobs without an application and jobs with an application in a checked status, not offline ones', () => {
    const { service } = setup(jobs, pages, applications);
    expect(service.eligibleJobs().map((job) => job.id)).toEqual(['new', 'old', 'open', 'recent']);
  });

  it('takes a job without an application from the flag of its own status', () => {
    const styles = parseJobStatusStyles('{"no":{"check":false}}')!;
    const own = [makeJob({ id: 'a', url: 'https://example.com/a', status: 'new' }), makeJob({ id: 'b', url: 'https://example.com/b', status: 'no' }), makeJob({ id: 'c', url: 'https://example.com/c', status: '' })];
    const { service } = setup(own, {}, [], { jobStatusStyles: styles });
    expect(service.eligibleJobs().map((job) => job.id).sort()).toEqual(['a', 'c']);
    const on = setup(own, {}, [], { jobStatusStyles: parseJobStatusStyles('{"no":{"check":true}}')! });
    expect(on.service.eligibleJobs()).toHaveLength(3);
  });

  it('follows the flag stored for a status', () => {
    const { service } = setup(jobs, pages, applications, { statusStyles: { rejected: { check: true }, sent: { check: false } } });
    expect(service.eligibleJobs().map((job) => job.id).sort()).toEqual(['closed', 'new', 'old', 'open', 'recent']);
  });

  it('checks the longest unchecked first and reports what is left when the budget runs out', () => {
    const { service, fetcher, logs } = setup(jobs, pages, applications);
    const result = service.checkDue(250);
    expect(fetcher.calls).toEqual(['https://example.com/new', 'https://example.com/old']);
    expect(result).toEqual({ checked: 2, changed: 0, remaining: 2 });
    expect(logs.at(-1)).toBe('availability||checked 2, changed 0, left 2');
  });

  it('goes on after a failure of one job', () => {
    const { service, fetcher, logs } = setup(jobs, pages, applications);
    const original = fetcher.fetch.bind(fetcher);
    fetcher.fetch = (url: string) => {
      if (url.endsWith('/new')) throw new Error('boom');
      return original(url);
    };
    expect(service.checkDue(10_000)).toMatchObject({ checked: 4, changed: 0, remaining: 0 });
    expect(logs).toContain('availability|new|boom');
  });
});
