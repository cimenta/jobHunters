import { jobStatusOf, type JobStatusStyles } from './job-status';
import type { Repository } from './repository';
import type { SettingsService } from './settings';
import type { Application, Job } from './types';

/**
 * The status of an ad after an application was created for it: a new ad, and an archived one (the user applies
 * again), become applied. Any other status stays. Undefined means no change.
 */
export function jobStatusOnApplication(styles: JobStatusStyles, status: string): string | undefined {
  const code = jobStatusOf(styles, status);
  return code === 'new' || code === 'archived' ? 'applied' : undefined;
}

/**
 * The status of an ad after one of its applications moved to rejected: a new or an applied ad becomes archived. The
 * statuses the user chose (No, own ones) stay. Undefined means no change.
 */
export function jobStatusOnRejection(styles: JobStatusStyles, status: string): string | undefined {
  const code = jobStatusOf(styles, status);
  return code === 'new' || code === 'applied' ? 'archived' : undefined;
}

/**
 * The one-time move of the ads that already have an application and still have the status new: archived when their
 * latest application (the highest attempt) is rejected, otherwise applied.
 */
export function planJobStatusMigration(input: { jobs: readonly Job[]; applications: readonly Application[]; styles: JobStatusStyles }): { id: string; to: string }[] {
  const latest = new Map<string, Application>();
  for (const application of input.applications) {
    const current = latest.get(application.job_id);
    if (current === undefined || application.attempt >= current.attempt) latest.set(application.job_id, application);
  }
  const plan: { id: string; to: string }[] = [];
  for (const job of input.jobs) {
    const application = latest.get(job.id);
    if (application === undefined || job.status === 'awaiting' || jobStatusOf(input.styles, job.status) !== 'new') continue;
    plan.push({ id: job.id, to: application.status === 'rejected' ? 'archived' : 'applied' });
  }
  return plan;
}

export const JOB_STATUS_MIGRATION_KEY = 'job_status_migration';

export interface JobStatusMigrationDeps {
  jobs: Repository<Job>;
  applications: Repository<Application>;
  settings: SettingsService;
}

/** Runs the move above once; the setting job_status_migration remembers that it ran, so a later Setup never undoes a status the user set by hand. */
export class JobStatusMigration {
  constructor(private readonly deps: JobStatusMigrationDeps) {}

  private plan(): { id: string; to: string }[] {
    const { jobs, applications, settings } = this.deps;
    return planJobStatusMigration({ jobs: jobs.list(), applications: applications.list(), styles: settings.get().settings.job_status_styles });
  }

  /** How many ads the move would change; 0 once it ran. */
  pending(): number {
    return this.deps.settings.raw(JOB_STATUS_MIGRATION_KEY) === '1' ? 0 : this.plan().length;
  }

  run(): number {
    const { jobs, settings } = this.deps;
    if (settings.raw(JOB_STATUS_MIGRATION_KEY) === '1') return 0;
    const plan = this.plan();
    for (const entry of plan) jobs.update(entry.id, { status: entry.to });
    settings.update({ [JOB_STATUS_MIGRATION_KEY]: '1' });
    return plan.length;
  }
}
