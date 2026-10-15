import { describe, expect, it } from 'vitest';
import { DEFAULT_JOB_STATUS_STYLES, resolveJobStatus } from './job-status';
import { JOB_STATUS_MIGRATION_KEY, JobStatusMigration, jobStatusOnApplication, jobStatusOnRejection, planJobStatusMigration } from './job-lifecycle';
import { InMemoryRepository } from './repository';
import { SettingsService } from './settings';
import { InMemoryKeyValueStore } from './key-value';
import { makeApplication, makeJob } from './testing/fixtures';
import type { Application, Job } from './types';

const styles = DEFAULT_JOB_STATUS_STYLES;

describe('job status after an application', () => {
  it('turns a new ad, and an archived one, into applied; every other status stays', () => {
    expect(jobStatusOnApplication(styles, 'new')).toBe('applied');
    expect(jobStatusOnApplication(styles, '')).toBe('applied');
    expect(jobStatusOnApplication(styles, 'weird')).toBe('applied');
    expect(jobStatusOnApplication(styles, 'archived')).toBe('applied');
    expect(jobStatusOnApplication(styles, 'applied')).toBeUndefined();
    expect(jobStatusOnApplication(styles, 'no')).toBeUndefined();
    expect(jobStatusOnApplication(styles, 'awaiting')).toBeUndefined();
  });

  it('turns a new or applied ad into archived after a rejection; the statuses the user chose stay', () => {
    expect(jobStatusOnRejection(styles, 'new')).toBe('archived');
    expect(jobStatusOnRejection(styles, 'applied')).toBe('archived');
    expect(jobStatusOnRejection(styles, 'archived')).toBeUndefined();
    expect(jobStatusOnRejection(styles, 'no')).toBeUndefined();
    expect(jobStatusOnRejection({ ...styles, s_maybe: { color: '#112233', check: true } }, 's_maybe')).toBeUndefined();
  });

  it('has names and colours for the two new statuses in both languages', () => {
    expect(resolveJobStatus(styles, 'applied', null, 'en')).toMatchObject({ code: 'applied', text: 'Applied', color: '#4f46e5' });
    expect(resolveJobStatus(styles, 'archived', null, 'cs')).toMatchObject({ code: 'archived', text: 'Archivováno' });
  });
});

describe('planJobStatusMigration', () => {
  const jobs = [
    makeJob({ id: 'j1', status: 'new' }), makeJob({ id: 'j2', status: '' }), makeJob({ id: 'j3', status: 'new' }),
    makeJob({ id: 'j4', status: 'no' }), makeJob({ id: 'j5', status: 'new' }), makeJob({ id: 'j6', status: 'awaiting' }),
  ];
  const applications = [
    makeApplication({ id: 'a1', job_id: 'j1', attempt: 1, status: 'sent' }),
    makeApplication({ id: 'a2', job_id: 'j2', attempt: 1, status: 'rejected' }),
    makeApplication({ id: 'a3', job_id: 'j3', attempt: 1, status: 'rejected' }),
    makeApplication({ id: 'a4', job_id: 'j3', attempt: 2, status: 'waiting' }),
    makeApplication({ id: 'a5', job_id: 'j4', attempt: 1, status: 'sent' }),
    makeApplication({ id: 'a6', job_id: 'j6', attempt: 1, status: 'sent' }),
  ];

  it('moves ads that have an application and are still new: archived when the latest is rejected, else applied', () => {
    expect(planJobStatusMigration({ jobs, applications, styles })).toEqual([
      { id: 'j1', to: 'applied' }, { id: 'j2', to: 'archived' }, { id: 'j3', to: 'applied' },
    ]);
  });
});

describe('JobStatusMigration', () => {
  function setup() {
    const jobs = new InMemoryRepository<Job>([makeJob({ id: 'j1', status: 'new' }), makeJob({ id: 'j2', status: 'new' })]);
    const applications = new InMemoryRepository<Application>([makeApplication({ id: 'a1', job_id: 'j1', status: 'sent' })]);
    const settings = new SettingsService(new InMemoryKeyValueStore());
    return { jobs, settings, migration: new JobStatusMigration({ jobs, applications, settings }) };
  }

  it('counts what is pending, runs once, and never undoes a status the user sets afterwards', () => {
    const { jobs, settings, migration } = setup();
    expect(migration.pending()).toBe(1);
    expect(migration.run()).toBe(1);
    expect(jobs.get('j1')!.status).toBe('applied');
    expect(jobs.get('j2')!.status).toBe('new');
    expect(settings.raw(JOB_STATUS_MIGRATION_KEY)).toBe('1');
    expect(migration.pending()).toBe(0);
    jobs.update('j1', { status: 'new' });
    expect(migration.run()).toBe(0);
    expect(jobs.get('j1')!.status).toBe('new');
  });
});
