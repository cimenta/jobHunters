import type { ApplicationDocument, Communication, Reminder, StatusHistoryEntry } from '../types';

export type TimelineType = 'status' | 'communication' | 'document' | 'pdf' | 'reminder';

export interface TimelineEvent {
  at: string;
  type: TimelineType;
  /** Id of the row the event comes from (application id for status changes). */
  ref: string;
  data: Record<string, string>;
}

export interface TimelineInput {
  applicationId: string;
  history: readonly StatusHistoryEntry[];
  communications: readonly Communication[];
  documents: readonly ApplicationDocument[];
  reminders: readonly Reminder[];
}

export interface TimelineOptions {
  types?: readonly TimelineType[];
  order?: 'asc' | 'desc';
}

/** Computed from the existing sheets, there is no timeline table. Of a document only the last PDF export is known. */
export function buildTimeline(input: TimelineInput, options: TimelineOptions = {}): TimelineEvent[] {
  const { applicationId } = input;
  const events: TimelineEvent[] = [];

  for (const entry of input.history) {
    if (entry.application_id === applicationId) events.push({ at: entry.at, type: 'status', ref: applicationId, data: { from: entry.from, to: entry.to } });
  }
  for (const c of input.communications) {
    if (c.application_id === applicationId) {
      events.push({ at: c.datetime, type: 'communication', ref: c.id, data: { direction: c.direction, channel: c.channel, summary: c.summary } });
    }
  }
  for (const d of input.documents) {
    if (d.application_id !== applicationId) continue;
    events.push({ at: d.created_at, type: 'document', ref: d.id, data: { type: d.type } });
    events.push({ at: d.pdf_exported_at, type: 'pdf', ref: d.id, data: { type: d.type } });
  }
  for (const r of input.reminders) {
    if (r.application_id !== applicationId) continue;
    events.push({ at: r.created_at, type: 'reminder', ref: r.id, data: { state: 'created', text: r.text } });
    if (r.status === 'done') events.push({ at: r.done_at, type: 'reminder', ref: r.id, data: { state: 'done', text: r.text } });
  }

  const wanted = options.types;
  const filtered = events.filter((e) => e.at !== '' && (wanted === undefined || wanted.includes(e.type)));
  // Array.prototype.sort is stable in V8, so events with equal times keep the order above.
  filtered.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return options.order === 'desc' ? filtered.reverse() : filtered;
}
