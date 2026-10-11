export const APPLICATION_STATUSES = [
  'draft',
  'sent',
  'waiting',
  'interview',
  'offer',
  'rejected',
  'ghosted',
  'withdrawn',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === 'string' && (APPLICATION_STATUSES as readonly string[]).includes(value);
}

const TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  draft: ['sent', 'waiting', 'withdrawn'],
  sent: ['waiting', 'interview', 'offer', 'rejected', 'ghosted', 'withdrawn'],
  waiting: ['sent', 'interview', 'offer', 'rejected', 'ghosted', 'withdrawn'],
  interview: ['waiting', 'offer', 'rejected', 'ghosted', 'withdrawn'],
  offer: ['waiting', 'interview', 'rejected', 'withdrawn'],
  ghosted: ['waiting', 'interview', 'rejected', 'withdrawn'],
  rejected: [],
  withdrawn: [],
};

/** Same-status moves return false; rescheduling a `waiting` application is handled by the service. */
export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
