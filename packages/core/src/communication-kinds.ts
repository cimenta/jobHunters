/** What a communication entry is. Channel (email, phone, video, ...) says how it happened, kind says what it was. */
export const COMMUNICATION_KINDS = ['message', 'meeting', 'after_meeting', 'homework', 'confirmation'] as const;

export type CommunicationKind = (typeof COMMUNICATION_KINDS)[number];

/**
 * Directions each kind accepts. Meeting: incoming = invited by the employer, outgoing = arranged by me.
 * Homework: incoming = received (posted), outgoing = submitted. Confirmation: always from the employer.
 * After a meeting: my own note on how it went, so the direction is always `note` and there is no channel.
 */
export const DIRECTIONS_BY_KIND: Record<CommunicationKind, readonly string[]> = {
  message: ['incoming', 'outgoing', 'note'],
  meeting: ['incoming', 'outgoing'],
  after_meeting: ['note'],
  homework: ['incoming', 'outgoing'],
  confirmation: ['incoming'],
};

/** The kind that has no channel: the channel cell stays empty. */
export const KINDS_WITHOUT_CHANNEL: readonly CommunicationKind[] = ['after_meeting'];

/** Rows written before the kind existed have an empty value, and a typo in the sheet must not break the screens: both read as a message. */
export function communicationKind(value: string | undefined): CommunicationKind {
  return (COMMUNICATION_KINDS as readonly string[]).includes(value ?? '') ? (value as CommunicationKind) : 'message';
}
