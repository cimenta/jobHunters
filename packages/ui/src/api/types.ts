export type {
  AppWarning, Application, ApplicationDocument, ApplicationRow, Communication, Company, CompanyRow, CreateApplicationResult,
  Dashboard, DashboardReminder, DocumentView, Job, JobPreview, JobRow, Question, Reminder, SaveResult, Settings, Template,
  TimelineEvent,
} from '@jobhunters/core';
import type { Application, ApplicationRow, Communication, Company, DocumentView, Job, JobRow, Question, Reminder, TimelineEvent } from '@jobhunters/core';

export interface AppInfo {
  version: string;
  locales: string[];
}

export interface JobDetail {
  job: Job;
  company: Company | undefined;
  applications: ApplicationRow[];
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
}

export type Profile = Record<'name' | 'email' | 'phone' | 'address' | 'links', string>;
