export type {
  AiTask, AiTaskRow, AppWarning, Application, ApplicationDocument, ApplicationRow, Communication, Company, CompanyRow, CreateApplicationResult, PrepareResult, TestApplicationResult, TestJobResult,
  Dashboard, DashboardReminder, DocumentView, Email, EmailRow, SearchGroup, SearchHit, SearchResult, SearchType, HistoryEntry, HistoryList, Job, JobPreview, JobRow, Question, Reminder, RefreshResult, SaveResult, Settings, Template,
  TimelineEvent,
} from '@jobhunters/core';
import type { AiTask, AiTaskRow, Application, ApplicationRow, Communication, Company, DocumentView, Job, JobRow, Question, Reminder, TimelineEvent } from '@jobhunters/core';

/** What running setup reported: every log line and whether it ended OK. */
export interface SetupResult {
  ok: boolean;
  lines: string[];
}

/** Whether setup has to be run, and why. */
export interface SetupStatus {
  needed: boolean;
  reasons: string[];
}

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
  /** The latest match evaluation of the job; Apps Script turns a missing one into null. */
  match?: AiTask | null;
}

export type Profile = Record<'name' | 'email' | 'phone' | 'address' | 'portfolio' | 'linkedin' | 'github' | 'website' | 'links', string>;
