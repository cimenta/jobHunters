import { reminderBuckets } from './applications/reminder-service';
import { NotFoundError, ValidationError } from './errors';
import { DEFAULT_JOB_STATUS_STYLES, type JobStatusStyles } from './job-status';
import { parseUrl } from './jobs/url';
import type { Repository } from './repository';
import { APPLICATION_STATUSES, type ApplicationStatus } from './status';
import type { Application, Company, Job, Reminder } from './types';

export type JobRow = Job & { company_name: string; application_count: number };
export type CompanyRow = Company & { job_count: number; application_count: number };
export type ApplicationRow = Application & { job_title: string; company_name: string };

const DESCRIPTION_PREVIEW = 200;

function companyNames(companies: readonly Company[]): Map<string, string> {
  return new Map(companies.map((company) => [company.id, company.name]));
}

function countBy<T>(items: readonly T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return counts;
}

export function jobRows(jobs: readonly Job[], companies: readonly Company[], applications: readonly Application[]): JobRow[] {
  const names = companyNames(companies);
  const counts = countBy(applications, (a) => a.job_id);
  return jobs.map((job) => ({
    ...job,
    description: job.description.slice(0, DESCRIPTION_PREVIEW),
    company_name: names.get(job.company_id) ?? '',
    application_count: counts.get(job.id) ?? 0,
  }));
}

export function companyRows(companies: readonly Company[], jobs: readonly Job[], applications: readonly Application[]): CompanyRow[] {
  const jobCounts = countBy(jobs, (j) => j.company_id);
  const companyOfJob = new Map(jobs.map((job) => [job.id, job.company_id]));
  const applicationCounts = countBy(applications, (a) => companyOfJob.get(a.job_id) ?? '');
  return companies.map((company) => ({
    ...company,
    job_count: jobCounts.get(company.id) ?? 0,
    application_count: applicationCounts.get(company.id) ?? 0,
  }));
}

export function applicationRows(applications: readonly Application[], jobs: readonly Job[], companies: readonly Company[]): ApplicationRow[] {
  const names = companyNames(companies);
  const byId = new Map(jobs.map((job) => [job.id, job]));
  return applications.map((application) => {
    const job = byId.get(application.job_id);
    return { ...application, job_title: job?.title ?? '', company_name: job ? (names.get(job.company_id) ?? '') : '' };
  });
}

export interface DashboardReminder {
  id: string;
  due_at: string;
  text: string;
  application_id: string;
  application_label: string;
  job_title: string;
  company_name: string;
}

export interface Dashboard {
  reminders: { overdue: DashboardReminder[]; today: DashboardReminder[]; soon: DashboardReminder[] };
  statusCounts: Record<ApplicationStatus, number>;
}

export function buildDashboard(input: {
  reminders: readonly Reminder[];
  applications: readonly Application[];
  jobs: readonly Job[];
  companies: readonly Company[];
  /** YYYY-MM-DD. */
  today: string;
}): Dashboard {
  const rows = new Map(applicationRows(input.applications, input.jobs, input.companies).map((row) => [row.id, row]));
  const describe = (reminder: Reminder): DashboardReminder => {
    const row = rows.get(reminder.application_id);
    return {
      id: reminder.id,
      due_at: reminder.due_at,
      text: reminder.text,
      application_id: reminder.application_id,
      application_label: row?.label ?? '',
      job_title: row?.job_title ?? '',
      company_name: row?.company_name ?? '',
    };
  };
  const buckets = reminderBuckets(input.reminders, input.today);
  const statusCounts = Object.fromEntries(APPLICATION_STATUSES.map((status) => [status, 0])) as Record<ApplicationStatus, number>;
  for (const application of input.applications) {
    if ((APPLICATION_STATUSES as readonly string[]).includes(application.status)) statusCounts[application.status as ApplicationStatus]++;
  }
  return {
    reminders: { overdue: buckets.overdue.map(describe), today: buckets.today.map(describe), soon: buckets.soon.map(describe) },
    statusCounts,
  };
}

export interface CatalogServiceDeps {
  jobs: Repository<Job>;
  companies: Repository<Company>;
  /** The statuses an ad may have; the built-in ones when not given. */
  jobStatuses?: () => JobStatusStyles;
}

export class CatalogService {
  constructor(private readonly deps: CatalogServiceDeps) {}

  updateJob(id: string, patch: { notes?: string; is_gig?: boolean; status?: string }): Job {
    if (!this.deps.jobs.get(id)) throw new NotFoundError('job_not_found', `Job ${id} not found`, { id });
    const change: Partial<Omit<Job, 'id'>> = {};
    if (patch.notes !== undefined) change.notes = patch.notes;
    if (patch.is_gig !== undefined) change.is_gig = patch.is_gig;
    if (patch.status !== undefined) {
      const known = this.deps.jobStatuses?.() ?? DEFAULT_JOB_STATUS_STYLES;
      if (!Object.prototype.hasOwnProperty.call(known, patch.status)) {
        throw new ValidationError('job_status_invalid', `Unknown job status ${patch.status}`, { status: patch.status });
      }
      change.status = patch.status;
    }
    return this.deps.jobs.update(id, change);
  }

  updateCompany(id: string, patch: { name?: string; website?: string; notes?: string }): Company {
    if (!this.deps.companies.get(id)) throw new NotFoundError('company_not_found', `Company ${id} not found`, { id });
    const change: Partial<Omit<Company, 'id'>> = {};
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (name === '') throw new ValidationError('company_name_required', 'The company name is empty', {});
      change.name = name;
    }
    if (patch.website !== undefined) {
      const website = patch.website.trim();
      if (website !== '' && parseUrl(website) === undefined) {
        throw new ValidationError('company_website_invalid', 'The website is not a web address', {});
      }
      change.website = website;
    }
    if (patch.notes !== undefined) change.notes = patch.notes;
    return this.deps.companies.update(id, change);
  }
}
