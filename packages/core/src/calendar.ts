import { communicationKind } from './communication-kinds';
import type { Application, Communication, Company, Job, Reminder, StatusHistoryEntry } from './types';

/** An interview: a communication entry of kind meeting, with the job it is about. */
export interface CalendarInterview {
  id: string;
  /** ISO 8601 date-time of the meeting. */
  datetime: string;
  channel: string;
  summary: string;
  /** Empty for a meeting kept on a job that has no application (a gig). */
  application_id: string;
  job_id: string;
  company_name: string;
  job_title: string;
}

/** An application in the status waiting: from the day it went to waiting to the day of its reminder. */
export interface CalendarWaiting {
  application_id: string;
  job_id: string;
  /** When the application went to waiting; empty when the history does not say. */
  start: string;
  /** Due date of the open waiting reminder; empty when there is none. */
  due_at: string;
  company_name: string;
  job_title: string;
}

export interface CalendarData {
  interviews: CalendarInterview[];
  waitings: CalendarWaiting[];
}

export interface CalendarInput {
  communications: readonly Communication[];
  applications: readonly Application[];
  jobs: readonly Job[];
  companies: readonly Company[];
  reminders: readonly Reminder[];
  history: readonly StatusHistoryEntry[];
}

/** Every interview and every waiting; the screen picks the month. Interviews come oldest first, waitings by their start. */
export function buildCalendar(input: CalendarInput): CalendarData {
  const jobs = new Map(input.jobs.map((job) => [job.id, job]));
  const companies = new Map(input.companies.map((company) => [company.id, company.name]));
  const applications = new Map(input.applications.map((application) => [application.id, application]));
  const describe = (jobId: string): { company_name: string; job_title: string } => {
    const job = jobs.get(jobId);
    return { company_name: job ? (companies.get(job.company_id) ?? '') : '', job_title: job?.title ?? '' };
  };

  const interviews: CalendarInterview[] = [];
  for (const entry of input.communications) {
    if (communicationKind(entry.kind) !== 'meeting' || entry.datetime === '') continue;
    const jobId = entry.application_id === '' ? entry.job_id : (applications.get(entry.application_id)?.job_id ?? entry.job_id);
    interviews.push({
      id: entry.id,
      datetime: entry.datetime,
      channel: entry.channel,
      summary: entry.summary,
      application_id: entry.application_id,
      job_id: jobId,
      ...describe(jobId),
    });
  }
  interviews.sort((a, b) => (a.datetime < b.datetime ? -1 : a.datetime > b.datetime ? 1 : 0));

  // The latest move into waiting; a reschedule (waiting to waiting) does not restart it.
  const started = new Map<string, string>();
  for (const entry of input.history) {
    if (entry.to !== 'waiting' || entry.from === 'waiting') continue;
    const latest = started.get(entry.application_id);
    if (latest === undefined || entry.at > latest) started.set(entry.application_id, entry.at);
  }
  const due = new Map<string, string>();
  for (const reminder of input.reminders) {
    if (reminder.source !== 'waiting' || reminder.status !== 'open' || reminder.due_at === '') continue;
    const latest = due.get(reminder.application_id);
    if (latest === undefined || reminder.due_at > latest) due.set(reminder.application_id, reminder.due_at);
  }

  const waitings: CalendarWaiting[] = [];
  for (const application of input.applications) {
    if (application.status !== 'waiting') continue;
    waitings.push({
      application_id: application.id,
      job_id: application.job_id,
      start: started.get(application.id) ?? '',
      due_at: due.get(application.id) ?? '',
      ...describe(application.job_id),
    });
  }
  waitings.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

  return { interviews, waitings };
}
