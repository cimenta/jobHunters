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
  remote: '' | 'yes' | 'no' | 'hybrid';
  posted_at: string;
  valid_until: string;
  description: string;
  availability: 'online' | 'offline' | 'unknown';
  availability_reason: string;
  offline_strikes: number;
  last_checked_at: string;
  flags: string;
  folder_url: string;
  notes: string;
}

export interface Application {
  id: string;
  job_id: string;
  attempt: number;
  label: string;
  /** Untrusted: the cell may have been edited outside the app. Validate with isApplicationStatus. */
  status: string;
  applied_at: string;
  last_activity_at: string;
  snapshot_used: string;
  folder_url: string;
  notes: string;
}

export interface Reminder {
  id: string;
  application_id: string;
  job_id: string;
  due_at: string;
  text: string;
  status: 'open' | 'done' | 'dismissed';
  source: 'manual' | 'waiting';
  created_at: string;
  done_at: string;
  reminded_at: string;
}

export interface StatusHistoryEntry {
  application_id: string;
  from: string;
  to: string;
  at: string;
}
