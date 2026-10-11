import type { Application, Reminder } from '../types';

export function makeApplication(overrides: Partial<Application> = {}): Application {
  return {
    id: 'a1',
    job_id: 'j1',
    attempt: 1,
    label: 'Acme – Developer – #1 (2026-10)',
    status: 'draft',
    applied_at: '',
    last_activity_at: '',
    snapshot_used: '',
    folder_url: '',
    notes: '',
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
