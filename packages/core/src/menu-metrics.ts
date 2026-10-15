import { DEFAULT_JOB_STATUS_STYLES, jobStatusOf, type JobStatusStyles } from './job-status';
import { INACTIVE_APPLICATION_STATUSES, isApplicationStatus } from './status';
import type { AiTask, Application, Job } from './types';

/** The main menu items that can show numbers. */
export const MENU_ITEMS = ['jobs', 'applications', 'tasks'] as const;
export type MenuItem = (typeof MENU_ITEMS)[number];

/** The numbers each menu item can show, in the order the settings offer them; the first one is the default. */
export const MENU_METRICS = {
  jobs: ['new', 'new_no_application', 'no_application', 'all'],
  applications: ['draft', 'waiting', 'sent', 'active'],
  tasks: ['waiting', 'needs_input', 'failed'],
} as const satisfies Record<MenuItem, readonly string[]>;

/** The counts of every number of every menu item, by item and number id. */
export type MenuMetrics = Record<MenuItem, Record<string, number>>;

/** The numbers the user chose for each menu item: none, one, or two (shown as "first / second"). */
export type MenuNumbers = Record<MenuItem, string[]>;

export const MAX_MENU_NUMBERS = 2;

export const DEFAULT_MENU_NUMBERS: Readonly<MenuNumbers> = { jobs: ['new'], applications: ['draft'], tasks: ['waiting'] };

function idsOf(value: unknown, item: MenuItem): string[] | undefined {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) return undefined;
  const known: readonly string[] = MENU_METRICS[item];
  return [...new Set(value as string[])].filter((id) => known.includes(id)).slice(0, MAX_MENU_NUMBERS);
}

/** Reads the setting menu_numbers. An item that is missing keeps its default; unknown ids are dropped; wrong shapes are invalid. */
export function parseMenuNumbers(raw: string): MenuNumbers | undefined {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return undefined;
  const record = data as Record<string, unknown>;
  const result = {} as MenuNumbers;
  for (const item of MENU_ITEMS) {
    if (record[item] === undefined) {
      result[item] = [...DEFAULT_MENU_NUMBERS[item]];
      continue;
    }
    const ids = idsOf(record[item], item);
    if (ids === undefined) return undefined;
    result[item] = ids;
  }
  return result;
}

/** The value to store in the setting menu_numbers. */
export function stringifyMenuNumbers(numbers: MenuNumbers): string {
  return JSON.stringify(numbers);
}

/**
 * Every number of every menu item, so that the screen can show whichever the user chose. Ads that wait for the AI
 * (status awaiting) are not real jobs yet and are never counted.
 */
export function computeMenuMetrics(input: {
  jobs: readonly Job[];
  applications: readonly Application[];
  tasks: readonly AiTask[];
  styles?: JobStatusStyles;
}): MenuMetrics {
  const styles = input.styles ?? DEFAULT_JOB_STATUS_STYLES;
  const applied = new Set(input.applications.map((application) => application.job_id));
  const jobs = input.jobs.filter((job) => job.status !== 'awaiting');
  const isNew = (job: Job): boolean => jobStatusOf(styles, job.status) === 'new';
  const tasksIn = (...statuses: string[]): number => input.tasks.filter((task) => statuses.includes(task.status)).length;
  const applicationsIn = (status: string): number => input.applications.filter((application) => application.status === status).length;
  return {
    jobs: {
      new: jobs.filter(isNew).length,
      new_no_application: jobs.filter((job) => isNew(job) && !applied.has(job.id)).length,
      no_application: jobs.filter((job) => !applied.has(job.id)).length,
      all: jobs.length,
    },
    applications: {
      draft: applicationsIn('draft'),
      waiting: applicationsIn('waiting'),
      sent: applicationsIn('sent'),
      active: input.applications.filter((application) => isApplicationStatus(application.status) && !INACTIVE_APPLICATION_STATUSES.includes(application.status)).length,
    },
    tasks: {
      waiting: tasksIn('pending', 'in_progress'),
      needs_input: tasksIn('needs_input'),
      failed: tasksIn('failed'),
    },
  };
}
