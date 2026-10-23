import { describe, expect, it } from 'vitest';
import { makeApplication, makeDocument, makeReminder } from '../testing/fixtures';
import type { Communication } from '../types';
import { buildJobTimeline, buildTimeline, type TimelineInput } from './timeline';

const communication: Communication = {
  id: 'm1', application_id: 'a1', datetime: '2026-10-05T10:00:00.000Z', direction: 'incoming', channel: 'email',
  contact_id: '', summary: 'They replied', details: '', attachment_url: '', kind: 'message', job_id: '',
};

const input: TimelineInput = {
  applicationId: 'a1',
  history: [
    { application_id: 'a1', from: '', to: 'draft', at: '2026-10-01T08:00:00.000Z' },
    { application_id: 'a1', from: 'draft', to: 'sent', at: '2026-10-02T08:00:00.000Z' },
    { application_id: 'other', from: '', to: 'draft', at: '2026-10-03T08:00:00.000Z' },
  ],
  communications: [communication, { ...communication, id: 'm2', application_id: 'other' }],
  documents: [makeDocument({ id: 'd1', created_at: '2026-10-01T08:00:01.000Z', pdf_exported_at: '2026-10-02T07:00:00.000Z' }), makeDocument({ id: 'd2', application_id: 'other' })],
  reminders: [makeReminder({ id: 'r1', created_at: '2026-10-02T08:00:01.000Z', status: 'done', done_at: '2026-10-06T08:00:00.000Z' })],
};

describe('buildTimeline', () => {
  it('collects events of one application from all sources, oldest first by default', () => {
    const events = buildTimeline(input);
    expect(events.map((e) => `${e.type}:${e.ref}`)).toEqual([
      'status:a1', 'document:d1', 'pdf:d1', 'status:a1', 'reminder:r1', 'message:m1', 'reminder:r1',
    ]);
    expect(events[0]).toEqual({ at: '2026-10-01T08:00:00.000Z', type: 'status', ref: 'a1', data: { from: '', to: 'draft' } });
    expect(events.find((e) => e.type === 'message')!.data).toEqual({ direction: 'incoming', channel: 'email', summary: 'They replied', details: '' });
    expect(events.filter((e) => e.type === 'reminder').map((e) => e.data.state)).toEqual(['created', 'done']);
  });

  it('gives each communication kind its own timeline type and reads an empty or unknown kind as a message', () => {
    const events = buildTimeline({
      ...input,
      history: [], documents: [], reminders: [],
      communications: [
        { ...communication, id: 'k1', kind: 'meeting', datetime: '2026-10-06T10:00:00.000Z' },
        { ...communication, id: 'k2', kind: 'homework', datetime: '2026-10-07T10:00:00.000Z' },
        { ...communication, id: 'k3', kind: 'confirmation', datetime: '2026-10-08T10:00:00.000Z' },
        { ...communication, id: 'k4', kind: '', datetime: '2026-10-09T10:00:00.000Z' },
        { ...communication, id: 'k5', kind: 'mesage', datetime: '2026-10-10T10:00:00.000Z' },
      ],
    });
    expect(events.map((e) => `${e.type}:${e.ref}`)).toEqual(['meeting:k1', 'homework:k2', 'confirmation:k3', 'message:k4', 'message:k5']);
    expect(buildTimeline({ ...input, communications: [{ ...communication, kind: 'meeting' }] }, { types: ['meeting'] }).map((e) => e.ref)).toEqual(['m1']);
  });

  it('can be reversed and filtered by type', () => {
    expect(buildTimeline(input, { order: 'desc' })[0]!.type).toBe('reminder');
    expect(buildTimeline(input, { types: ['status'] }).map((e) => e.data.to)).toEqual(['draft', 'sent']);
    expect(buildTimeline(input, { types: [] })).toEqual([]);
  });

  it('drops events without a time', () => {
    const events = buildTimeline({ ...input, documents: [makeDocument({ id: 'd3', created_at: '', pdf_exported_at: '' })], history: [], communications: [], reminders: [] });
    expect(events).toEqual([]);
  });
});

describe('buildJobTimeline', () => {
  const jobInput = {
    jobId: 'j1',
    applications: [makeApplication({ id: 'a1', job_id: 'j1' }), makeApplication({ id: 'a2', job_id: 'j1' }), makeApplication({ id: 'x', job_id: 'j2' })],
    history: [
      { application_id: 'a2', from: '', to: 'draft', at: '2026-10-02T08:00:00.000Z' },
      { application_id: 'a1', from: '', to: 'draft', at: '2026-10-01T08:00:00.000Z' },
      { application_id: 'x', from: '', to: 'draft', at: '2026-10-01T09:00:00.000Z' },
    ],
    communications: [
      { ...communication, id: 'c1', application_id: 'a1', datetime: '2026-10-05T10:00:00.000Z' },
      { ...communication, id: 'c2', application_id: '', job_id: 'j1', kind: 'meeting', datetime: '2026-10-06T10:00:00.000Z', summary: 'Trial shift' },
      { ...communication, id: 'c3', application_id: '', job_id: 'j2', datetime: '2026-10-07T10:00:00.000Z' },
      { ...communication, id: 'c4', application_id: 'x', datetime: '2026-10-08T10:00:00.000Z' },
    ],
    documents: [],
    reminders: [],
  };

  it('merges the events of all applications of the job with the entries kept on the job, newest first', () => {
    const events = buildJobTimeline(jobInput);
    expect(events.map((e) => `${e.type}:${e.ref}`)).toEqual(['meeting:c2', 'message:c1', 'status:a2', 'status:a1']);
  });

  it('marks the events of an application with its id and number (the one started first is 1) and the entries of the job with the scope', () => {
    const events = buildJobTimeline(jobInput, { order: 'asc' });
    expect(events.map((e) => e.data.application_no ?? e.data.scope)).toEqual(['1', '2', '1', 'job']);
    expect(events[1]!.data.application_id).toBe('a2');
    expect(events[3]!.data).toMatchObject({ scope: 'job', summary: 'Trial shift' });
  });

  it('filters by type and works for a job without any application', () => {
    expect(buildJobTimeline(jobInput, { types: ['meeting'] }).map((e) => e.ref)).toEqual(['c2']);
    expect(buildJobTimeline({ ...jobInput, applications: [], history: [] }).map((e) => e.ref)).toEqual(['c2']);
  });
});
