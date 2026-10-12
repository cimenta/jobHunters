import { describe, expect, it } from 'vitest';
import { CatalogService } from './catalog';
import { InMemoryKeyValueStore } from './key-value';
import { parseJobStatusStyles } from './job-status';
import { JobStatusService } from './job-status-service';
import { DEFAULT_PROMPTS } from './seed';
import { InMemoryRepository } from './repository';
import { SettingsService } from './settings';
import { errorOf } from './testing/errors';
import { makeJob } from './testing/fixtures';
import type { Company, Job } from './types';

function setup(jobs: Job[] = []) {
  const jobRepo = new InMemoryRepository<Job>(jobs);
  const settings = new SettingsService(new InMemoryKeyValueStore());
  const service = new JobStatusService({ jobs: jobRepo, settings });
  const catalog = new CatalogService({ jobs: jobRepo, companies: new InMemoryRepository<Company>(), jobStatuses: () => settings.get().settings.job_status_styles });
  return { service, settings, catalog, jobRepo };
}

const MAYBE = { s_maybe1: { text: { en: 'Maybe' }, color: '#aa00bb', check: true } };

describe('JobStatusService', () => {
  it('saves a custom status and keeps the built-in ones', () => {
    const { service, settings } = setup();
    const saved = service.save({ ...parseJobStatusStyles('{}'), ...MAYBE });
    expect(Object.keys(saved).sort()).toEqual(['awaiting', 'new', 'no', 's_maybe1']);
    expect(Object.keys(settings.get().settings.job_status_styles)).toContain('s_maybe1');
  });

  it('refuses invalid styles', () => {
    const { service } = setup();
    expect(errorOf(() => service.save({ s_x: { color: 'red' } }))).toMatchObject({ code: 'settings_invalid' });
    expect(errorOf(() => service.save('nope'))).toMatchObject({ code: 'settings_invalid' });
  });

  it('refuses to remove a status that ads still use, and removes an unused one', () => {
    const { service, settings } = setup([makeJob({ id: 'j1', status: 's_maybe1' })]);
    service.save({ ...parseJobStatusStyles('{}'), ...MAYBE });
    expect(errorOf(() => service.save({}))).toMatchObject({ code: 'job_status_in_use', params: { count: 1 } });
    const free = setup();
    free.service.save({ ...MAYBE });
    free.service.save({});
    expect(Object.keys(free.settings.get().settings.job_status_styles)).toEqual(['new', 'no', 'awaiting']);
    expect(settings.get().settings.job_status_styles.s_maybe1).toBeDefined();
  });

  it('lets an ad take a known status only', () => {
    const { service, catalog } = setup([makeJob({ id: 'j1' })]);
    service.save({ ...MAYBE });
    expect(catalog.updateJob('j1', { status: 's_maybe1' }).status).toBe('s_maybe1');
    expect(catalog.updateJob('j1', { status: 'no' }).status).toBe('no');
    expect(errorOf(() => catalog.updateJob('j1', { status: 'bogus' }))).toMatchObject({ code: 'job_status_invalid' });
  });

  it('never lets the user write the match', () => {
    const { catalog } = setup([makeJob({ id: 'j1', match_percent: 70 })]);
    expect(catalog.updateJob('j1', { notes: 'x', match_percent: 5 } as never).match_percent).toBe(70);
  });
});

describe('match prompt', () => {
  it('asks the agent to write the percentage into the Jobs sheet', () => {
    const match = DEFAULT_PROMPTS.find((p) => p.type === 'match_job')!.instruction;
    expect(match).toContain('The sheet Jobs, the row with id {{job_id}}: column match_percent');
    expect(match).toContain('whole number from 0 to 100');
  });
});
