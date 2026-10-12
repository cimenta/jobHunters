export type {
  AiTask, AiTaskRow, AppWarning, Application, ApplicationDocument, ApplicationRow, Communication, Company, CompanyRow, CreateApplicationResult, PrepareResult,
  Dashboard, DashboardReminder, DocumentView, Job, JobPreview, JobRow, Question, Reminder, SaveResult, Settings, Template,
  TimelineEvent,
} from '@jobhunters/core';
import type { AiTask, AiTaskRow, Application, ApplicationRow, Communication, Company, DocumentView, Job, JobRow, Question, Reminder, TimelineEvent } from '@jobhunters/core';

export interface AppInfo {
  version: string;
  locales: string[];
  /** Time zone of the script; every time is shown in it. */
  timeZone: string;
}

export interface AvailabilityCheck {
  job: Job;
  verdict: { availability: 'online' | 'offline' | 'unknown'; rule: string; reason: string };
  changed: boolean;
}

export interface JobDetail {
  job: Job;
  company: Company | undefined;
  applications: ApplicationRow[];
  match: AiTask | undefined;
}

export interface CompanyDetail {
  company: Company;
  jobs: JobRow[];
  applications: ApplicationRow[];
}

export interface ApplicationDetail {
  application: Application;
  job: Job | undefined;
  company: Company | undefined;
  documents: DocumentView[];
  questions: Question[];
  communications: Communication[];
  reminders: Reminder[];
  timeline: TimelineEvent[];
  tasks: AiTaskRow[];
}

export type Profile = Record<'name' | 'email' | 'phone' | 'address' | 'links', string>;
