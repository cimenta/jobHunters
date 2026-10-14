import type { Application, ApplicationDocument, Company, Job, Reminder, Template } from '../types';

export function makeApplication(overrides: Partial<Application> = {}): Application {
  return {
    id: 'a1',
    job_id: 'j1',
    attempt: 1,
    label: 'Acme – Developer – #1 (2026-10)',
    language: 'en',
    status: 'draft',
    applied_at: '',
    last_activity_at: '',
    board_position: null,
    snapshot_used: '',
    folder_url: '',
    notes: '',
    salary: '',
    ...overrides,
  };
}

export function makeReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r0',
    application_id: 'a1',
    job_id: 'j1',
    due_at: '2026-10-20',
    text: 'Call HR',
    status: 'open',
    source: 'manual',
    created_at: '2026-10-10T08:00:00.000Z',
    done_at: '',
    reminded_at: '',
    ...overrides,
  };
}

/** Deterministic id generator for tests: 'r1', 'r2', ... */
export function sequentialIds(prefix: string): () => string {
  let next = 1;
  return () => `${prefix}${next++}`;
}

export function makeCompany(overrides: Partial<Company> = {}): Company {
  return { id: 'c1', name: 'Example s.r.o.', website: '', notes: '', ...overrides };
}

export function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'j1', company_id: 'c1', title: 'Android Developer', url: 'https://example.com/job/1', source: 'example.com',
    parser_id: 'generic', parsed_at: '', contact_id: '', found_at: '2026-10-10T08:00:00.000Z', is_gig: false,
    location: 'Praha', salary_min: null, salary_max: null, salary_currency: '', salary_period: '', employment_type: '',
    remote: '', is_remote: false, is_hybrid: false, posted_at: '', valid_until: '', description: '', language: 'en', availability: 'online',
    availability_reason: '', offline_strikes: 0, last_checked_at: '', flags: '', folder_url: '', notes: '', status: 'new', match_percent: null, ai_salary: '',
    ...overrides,
  };
}

export function makeDocument(overrides: Partial<ApplicationDocument> = {}): ApplicationDocument {
  return {
    id: 'd1', application_id: 'a1', type: 'resume', doc_url: '', pdf_url: '', template_id: '',
    created_at: '2026-10-10T08:00:00.000Z', pdf_exported_at: '', ...overrides,
  };
}

export function makeTemplate(overrides: Partial<Template> = {}): Template {
  return { id: 't1', type: 'resume', language: 'en', name: 'Resume', doc_url: '', ...overrides };
}
