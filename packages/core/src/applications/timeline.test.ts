import { describe, expect, it } from 'vitest';
import { makeDocument, makeReminder } from '../testing/fixtures';
import type { Communication } from '../types';
import { buildTimeline, type TimelineInput } from './timeline';

const communication: Communication = {
  id: 'm1', application_id: 'a1', datetime: '2026-10-05T10:00:00.000Z', direction: 'incoming', channel: 'email',
  contact_id: '', summary: 'They replied', details: '', attachment_url: '',
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
      'status:a1', 'document:d1', 'pdf:d1', 'status:a1', 'reminder:r1', 'communication:m1', 'reminder:r1',
    ]);
    expect(events[0]).toEqual({ at: '2026-10-01T08:00:00.000Z', type: 'status', ref: 'a1', data: { from: '', to: 'draft' } });
    expect(events.find((e) => e.type === 'communication')!.data).toEqual({ direction: 'incoming', channel: 'email', summary: 'They replied' });
    expect(events.filter((e) => e.type === 'reminder').map((e) => e.data.state)).toEqual(['created', 'done']);
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
