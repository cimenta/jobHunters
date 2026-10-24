export interface Company {
  id: string;
  name: string;
  website: string;
  notes: string;
}

export interface Job {
  id: string;
  company_id: string;
  title: string;
  url: string;
  source: string;
  parser_id: string;
  parsed_at: string;
  contact_id: string;
  found_at: string;
  is_gig: boolean;
  location: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  salary_period: string;
  employment_type: string;
  /** Legacy work mode (yes / no / hybrid). Only read once, by Setup, to fill is_remote and is_hybrid; the app no longer uses it. */
  remote: '' | 'yes' | 'no' | 'hybrid';
  /** Work mode checkboxes of the ad; both can be ticked. */
  is_remote: boolean;
  is_hybrid: boolean;
  posted_at: string;
  valid_until: string;
  description: string;
  /** Language of the ad: en, cs or empty. */
  language: string;
  availability: 'online' | 'offline' | 'unknown';
  availability_reason: string;
  offline_strikes: number;
  last_checked_at: string;
  flags: string;
  folder_url: string;
  notes: string;
  /** Status of the ad (see job-status.ts); empty means new. */
  status: string;
  /** 0-100, written by the AI after a match evaluation; null until then. */
  match_percent: number | null;
  /** `<ask> (<min>-<max>)`, whole monthly amounts in salary_currency; written by the AI only while empty. */
  ai_salary: string;
  /** The person the ad names as responsible for the position or as a contact, free text; written by the AI or the user. */
  contact_person: string;
  /** Why the user does not want this job (status No), free text. */
  no_reason: string;
  /** The shift of a gig (Job.is_gig), free text; the user fills it in. */
  gig_shift: string;
  /** A gig the user marked as high priority (only a gig can have it). */
  gig_priority: boolean;
  /** The evaluation of the match (strengths, gaps, verdict), written by the AI together with match_percent by whichever task evaluated it. */
  match_note: string;
}

export interface Application {
  id: string;
  job_id: string;
  attempt: number;
  label: string;
  /** Language of the application documents. */
  language: string;
  /** Untrusted: the cell may have been edited outside the app. Validate with isApplicationStatus. */
  status: string;
  applied_at: string;
  last_activity_at: string;
  snapshot_used: string;
  folder_url: string;
  notes: string;
  /** The salary the user asks for in this application, free text (for example "75 000 CZK / month"); empty when not given. */
  salary: string;
  /** Position among the cards of its status in the Kanban board; null = not placed yet (shown first). */
  board_position: number | null;
  /** The user's preparation for the interview, free text; at most CELL_LIMIT characters so it always fits in a cell. */
  interview_prep: string;
}

export interface Reminder {
  id: string;
  application_id: string;
  job_id: string;
  due_at: string;
  text: string;
  status: 'open' | 'done' | 'dismissed';
  source: 'manual' | 'waiting' | 'homework';
  created_at: string;
  done_at: string;
  reminded_at: string;
}

export interface AiTask {
  id: string;
  created_at: string;
  application_id: string;
  job_id: string;
  type: string;
  target_type: string;
  target_id: string;
  instructions: string;
  /** Untrusted: the cell may be edited by the AI or by hand. */
  status: string;
  /** Result or note written by the AI. For match_job it holds the evaluation. */
  ai_note: string;
  completed_at: string;
}

export interface StatusHistoryEntry {
  application_id: string;
  from: string;
  to: string;
  at: string;
}

export interface LogEntry {
  time: string;
  flow: string;
  entity: string;
  message: string;
}

export interface ApplicationDocument {
  id: string;
  application_id: string;
  /** resume, cover_letter or other. */
  type: string;
  doc_url: string;
  pdf_url: string;
  template_id: string;
  created_at: string;
  pdf_exported_at: string;
}

export interface Question {
  id: string;
  application_id: string;
  position: number;
  question: string;
  answer: string;
  max_sentences: number | null;
  /** open or answered. */
  status: string;
  created_at: string;
  updated_at: string;
}

/** A mail from the mailbox. The first twelve fields are appended by a separate script; the rest belongs to the app (empty for now). */
export interface Email {
  /** The Gmail message id. */
  id: string;
  thread_id: string;
  /** ISO 8601 date-time (UTC). */
  received_at: string;
  /** incoming or outgoing. */
  direction: string;
  from_email: string;
  from_name: string;
  to: string;
  cc: string;
  subject: string;
  /** Plain text, quoted earlier messages and signature already removed, at most 10000 characters. */
  body: string;
  /** File names separated by " | "; empty when there are none. */
  attachments: string;
  /** Looks like bulk mail (newsletter, job alert, no-reply sender). */
  is_bulk: boolean;
  type: string;
  type_confidence: string;
  signals: string;
  application_id: string;
  job_id: string;
  match_method: string;
  /** Empty means new. */
  state: string;
  communication_id: string;
}

export interface Communication {
  id: string;
  /** Empty for an entry kept on the job itself (a gig can have no application); then job_id is set. */
  application_id: string;
  datetime: string;
  /** incoming, outgoing or note. */
  direction: string;
  /** email, phone, linkedin, in_person, portal or other. */
  channel: string;
  contact_id: string;
  summary: string;
  details: string;
  attachment_url: string;
  /** message, meeting, homework or confirmation; empty in rows from before the kind existed (read as message). */
  kind: string;
  /** Set only for an entry kept on the job itself; empty in entries of an application. */
  job_id: string;
}

export interface Template {
  id: string;
  type: string;
  /** en, cs or empty (valid for every language). */
  language: string;
  name: string;
  doc_url: string;
}

export type HistorySource = 'initial' | 'saved' | 'reset' | 'restored';

/** One saved version of a tracked text (see history.ts). */
export interface HistoryEntry {
  id: string;
  /** The tracked setting key, for example candidate_experience. */
  key: string;
  /** 1, 2, 3 ... per key; never reused, so "restored from #3" stays true. */
  version: number;
  saved_at: string;
  source: HistorySource;
  /** The version number this entry was restored from, as text; empty otherwise. */
  restored_from: string;
  pinned: boolean;
  comment: string;
  text: string;
}
