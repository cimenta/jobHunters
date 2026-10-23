import { communicationKind } from '../communication-kinds';
import type { Application, ApplicationDocument, Communication, Reminder, StatusHistoryEntry } from '../types';

export type TimelineType = 'status' | 'message' | 'meeting' | 'after_meeting' | 'homework' | 'confirmation' | 'document' | 'pdf' | 'reminder';

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
      events.push({ at: c.datetime, type: communicationKind(c.kind), ref: c.id, data: { direction: c.direction, channel: c.channel, summary: c.summary, details: c.details } });
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

export interface JobTimelineInput {
  jobId: string;
  applications: readonly Application[];
  history: readonly StatusHistoryEntry[];
  communications: readonly Communication[];
  documents: readonly ApplicationDocument[];
  reminders: readonly Reminder[];
}

/**
 * The timeline of a job: the events of all its applications (each marked with the application's id and its number, the
 * application started first is 1) and the entries kept on the job itself (marked scope "job"). Newest first unless asked otherwise.
 */
export function buildJobTimeline(input: JobTimelineInput, options: TimelineOptions = {}): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  // An application has no creation time of its own: its first status change (or else the time it was applied) dates it.
  const startOf = (application: Application): string => input.history.filter((h) => h.application_id === application.id && h.at !== '').map((h) => h.at).sort()[0] ?? application.applied_at;
  const ordered = input.applications.filter((a) => a.job_id === input.jobId).sort((a, b) => (startOf(a) < startOf(b) ? -1 : startOf(a) > startOf(b) ? 1 : a.id < b.id ? -1 : 1));
  ordered.forEach((application, index) => {
    for (const event of buildTimeline({ applicationId: application.id, history: input.history, communications: input.communications, documents: input.documents, reminders: input.reminders }, { types: options.types })) {
      events.push({ ...event, data: { ...event.data, application_id: application.id, application_no: String(index + 1) } });
    }
  });
  for (const c of input.communications) {
    if (c.job_id !== input.jobId || c.application_id !== '' || c.datetime === '') continue;
    if (options.types !== undefined && !options.types.includes(communicationKind(c.kind))) continue;
    events.push({ at: c.datetime, type: communicationKind(c.kind), ref: c.id, data: { direction: c.direction, channel: c.channel, summary: c.summary, details: c.details, scope: 'job' } });
  }
  events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return options.order === 'asc' ? events : events.reverse();
}
