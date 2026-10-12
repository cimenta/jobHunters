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

/** Which statuses an application may move to; the user can change this in Settings (status_transitions). */
export type StatusTransitions = Record<ApplicationStatus, readonly ApplicationStatus[]>;

export const DEFAULT_TRANSITIONS: StatusTransitions = {
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
export function canTransition(from: ApplicationStatus, to: ApplicationStatus, transitions: StatusTransitions = DEFAULT_TRANSITIONS): boolean {
  return transitions[from].includes(to);
}

/**
 * The stored value lists, per status, the statuses it may move to. A status that is not mentioned keeps its default.
 * Undefined when the value is not valid JSON of that shape or names an unknown status.
 */
export function parseStatusTransitions(raw: string): StatusTransitions | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw.trim() === '' ? '{}' : raw);
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const result = { ...DEFAULT_TRANSITIONS } as Record<ApplicationStatus, readonly ApplicationStatus[]>;
  for (const [from, targets] of Object.entries(value)) {
    if (!isApplicationStatus(from) || !Array.isArray(targets)) return undefined;
    if (!targets.every((to) => isApplicationStatus(to) && to !== from)) return undefined;
    result[from] = [...new Set(targets as ApplicationStatus[])];
  }
  return result;
}

export function serializeStatusTransitions(transitions: StatusTransitions): string {
  return JSON.stringify(transitions);
}
