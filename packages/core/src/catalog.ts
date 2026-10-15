import { reminderBuckets } from './applications/reminder-service';
import { NotFoundError, ValidationError } from './errors';
import { DEFAULT_JOB_STATUS_STYLES, jobStatusOf, type JobStatusStyles } from './job-status';
import { parseUrl } from './jobs/url';
import { computeMenuMetrics, type MenuMetrics } from './menu-metrics';
import { MAX_ASKED_SALARY } from './applications/application-factory';
import type { Repository } from './repository';
import { APPLICATION_STATUSES, type ApplicationStatus } from './status';
import type { AiTask, Application, Company, Job, Reminder, StatusHistoryEntry } from './types';

export type JobRow = Job & { company_name: string; application_count: number; match_task_status: string; match_task_id: string };
export type CompanyRow = Company & { job_count: number; application_count: number };
export type ApplicationRow = Application & {
  job_title: string;
  company_name: string;
  /** Of the job. */
  location: string;
  is_remote: boolean;
  is_hybrid: boolean;
  /** Of the job; null until the AI evaluated the match. */
  match_percent: number | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  salary_period: string;
  /** First entry of the status history; empty when there is none. */
  created_at: string;
  /** When the application went to waiting (only while it is waiting); empty otherwise. */
  waiting_since: string;
};

const DESCRIPTION_PREVIEW = 200;

function companyNames(companies: readonly Company[]): Map<string, string> {
  return new Map(companies.map((company) => [company.id, company.name]));
}

function countBy<T>(items: readonly T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return counts;
}

export function jobRows(jobs: readonly Job[], companies: readonly Company[], applications: readonly Application[], tasks: readonly AiTask[] = []): JobRow[] {
  const names = companyNames(companies);
  const counts = countBy(applications, (a) => a.job_id);
  const newestMatch = new Map<string, AiTask>();
  for (const task of tasks) {
    if (task.type !== 'match_job' && task.type !== 'import_match_job') continue;
    const current = newestMatch.get(task.job_id);
    if (!current || task.created_at >= current.created_at) newestMatch.set(task.job_id, task);
  }
  return jobs.map((job) => ({
    ...job,
    description: job.description.slice(0, DESCRIPTION_PREVIEW),
    company_name: names.get(job.company_id) ?? '',
    application_count: counts.get(job.id) ?? 0,
    match_task_status: newestMatch.get(job.id)?.status ?? '',
    match_task_id: newestMatch.get(job.id)?.id ?? '',
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

/** `history` is optional: without it `created_at` and `waiting_since` are empty. */
export function applicationRows(applications: readonly Application[], jobs: readonly Job[], companies: readonly Company[], history: readonly StatusHistoryEntry[] = []): ApplicationRow[] {
  const names = companyNames(companies);
  const byId = new Map(jobs.map((job) => [job.id, job]));
  const created = new Map<string, string>();
  const waitingStart = new Map<string, string>();
  for (const entry of history) {
    const first = created.get(entry.application_id);
    if (first === undefined || entry.at < first) created.set(entry.application_id, entry.at);
    // A reschedule (waiting to waiting) does not restart the waiting.
    if (entry.to === 'waiting' && entry.from !== 'waiting') {
      const latest = waitingStart.get(entry.application_id);
      if (latest === undefined || entry.at > latest) waitingStart.set(entry.application_id, entry.at);
    }
  }
  return applications.map((application) => {
    const job = byId.get(application.job_id);
    return {
      ...application,
      job_title: job?.title ?? '',
      company_name: job ? (names.get(job.company_id) ?? '') : '',
      location: job?.location ?? '',
      is_remote: job?.is_remote ?? false,
      is_hybrid: job?.is_hybrid ?? false,
      match_percent: job?.match_percent ?? null,
      salary_min: job?.salary_min ?? null,
      salary_max: job?.salary_max ?? null,
      salary_currency: job?.salary_currency ?? '',
      salary_period: job?.salary_period ?? '',
      created_at: created.get(application.id) ?? '',
      waiting_since: application.status === 'waiting' ? (waitingStart.get(application.id) ?? '') : '',
    };
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
  /** AI tasks still waiting for the AI (pending or in progress), in total and per task type. */
  aiTasksWaiting: { total: number; byType: Record<string, number> };
}

/** AI tasks still waiting for the AI (pending or in progress), in total and per task type. */
function countWaitingTasks(tasks: readonly AiTask[]): { total: number; byType: Record<string, number> } {
  const counts = new Map<string, number>();
  let total = 0;
  for (const task of tasks) {
    if (task.status !== 'pending' && task.status !== 'in_progress') continue;
    counts.set(task.type, (counts.get(task.type) ?? 0) + 1);
    total++;
  }
  return { total, byType: Object.fromEntries(counts) as Record<string, number> };
}

export interface MenuCounts {
  /** AI tasks waiting or in progress; always present because it sets how fast the menu refreshes. */
  aiTasksWaiting: number;
  /** Every number the menu can show, by menu item and number id (see menu-metrics.ts). */
  metrics: MenuMetrics;
}

export function buildMenuCounts(input: { jobs: readonly Job[]; tasks: readonly AiTask[]; applications: readonly Application[]; styles?: JobStatusStyles }): MenuCounts {
  return { aiTasksWaiting: countWaitingTasks(input.tasks).total, metrics: computeMenuMetrics(input) };
}

export function buildDashboard(input: {
  reminders: readonly Reminder[];
  applications: readonly Application[];
  jobs: readonly Job[];
  companies: readonly Company[];
  tasks: readonly AiTask[];
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
  const { total, byType } = countWaitingTasks(input.tasks);
  return {
    reminders: { overdue: buckets.overdue.map(describe), today: buckets.today.map(describe), soon: buckets.soon.map(describe) },
    statusCounts,
    aiTasksWaiting: { total, byType },
  };
}

export interface CatalogServiceDeps {
  jobs: Repository<Job>;
  applications: Repository<Application>;
  companies: Repository<Company>;
  /** The statuses an ad may have; the built-in ones when not given. */
  jobStatuses?: () => JobStatusStyles;
}

export class CatalogService {
  constructor(private readonly deps: CatalogServiceDeps) {}

  updateJob(id: string, patch: { notes?: string; is_gig?: boolean; is_remote?: boolean; is_hybrid?: boolean; status?: string }): Job {
    if (!this.deps.jobs.get(id)) throw new NotFoundError('job_not_found', `Job ${id} not found`, { id });
    const change: Partial<Omit<Job, 'id'>> = {};
    if (patch.notes !== undefined) change.notes = patch.notes;
    if (patch.is_gig !== undefined) change.is_gig = patch.is_gig;
    if (patch.is_remote !== undefined) change.is_remote = patch.is_remote;
    if (patch.is_hybrid !== undefined) change.is_hybrid = patch.is_hybrid;
    if (patch.status !== undefined) {
      const known = this.deps.jobStatuses?.() ?? DEFAULT_JOB_STATUS_STYLES;
      if (patch.status === 'awaiting' || !Object.prototype.hasOwnProperty.call(known, patch.status)) {
        throw new ValidationError('job_status_invalid', `Unknown job status ${patch.status}`, { status: patch.status });
      }
      change.status = patch.status;
    }
    return this.deps.jobs.update(id, change);
  }

  /** The salary the user asks for in an application; an empty text clears it. */
  updateApplication(id: string, patch: { salary?: string }): Application {
    if (!this.deps.applications.get(id)) throw new NotFoundError('application_not_found', `Application ${id} not found`, { id });
    const change: Partial<Omit<Application, 'id'>> = {};
    if (patch.salary !== undefined) change.salary = patch.salary.trim().slice(0, MAX_ASKED_SALARY);
    return this.deps.applications.update(id, change);
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
