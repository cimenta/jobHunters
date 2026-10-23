import { describe, expect, it } from 'vitest';
import { InMemoryRepository } from '../repository';
import { errorOf } from '../testing/errors';
import { makeApplication, makeJob, sequentialIds } from '../testing/fixtures';
import type { Application, Communication, Job } from '../types';
import { CommunicationService } from './communication-service';

const NOW = '2026-10-11T08:00:00.000Z';

function setup() {
  const communications = new InMemoryRepository<Communication>();
  const applications = new InMemoryRepository<Application>([makeApplication({ id: 'a1' })]);
  return { service: new CommunicationService({ communications, applications, newId: sequentialIds('m'), now: () => NOW }), applications };
}

const base = { applicationId: 'a1', direction: 'outgoing', channel: 'email', summary: 'Sent the application' };
const MEETING_BASE = { ...base, kind: 'meeting', direction: 'incoming', channel: 'video', summary: 'Technical interview' };

describe('CommunicationService', () => {
  it('adds an entry, defaults the kind to message and the time to now and updates last_activity_at', () => {
    const { service, applications } = setup();
    expect(service.add(base)).toEqual({
      id: 'm1', application_id: 'a1', datetime: NOW, direction: 'outgoing', channel: 'email', contact_id: '',
      summary: 'Sent the application', details: '', attachment_url: '', kind: 'message', job_id: '',
    });
    expect(applications.get('a1')!.last_activity_at).toBe(NOW);
  });

  it('lists newest first', () => {
    const { service } = setup();
    service.add({ ...base, datetime: '2026-10-01T10:00:00.000Z', summary: 'old' });
    service.add({ ...base, datetime: '2026-10-05T10:00:00.000Z', summary: 'new' });
    expect(service.listFor('a1').map((c) => c.summary)).toEqual(['new', 'old']);
  });

  it('rejects bad direction, channel, kind and bad datetime', () => {
    const { service } = setup();
    expect(errorOf(() => service.add({ ...base, direction: 'sideways' }))).toMatchObject({ code: 'communication_invalid', params: { field: 'direction' } });
    expect(errorOf(() => service.add({ ...base, channel: 'pigeon' }))).toMatchObject({ code: 'communication_invalid', params: { field: 'channel' } });
    expect(errorOf(() => service.add({ ...base, kind: 'party' }))).toMatchObject({ code: 'communication_invalid', params: { field: 'kind' } });
    expect(errorOf(() => service.add({ ...base, datetime: 'yesterday' }))).toMatchObject({ code: 'communication_invalid', params: { field: 'datetime' } });
    expect(errorOf(() => service.add({ ...base, applicationId: 'ghost' }))).toMatchObject({ code: 'application_not_found' });
  });

  it('accepts an entry without a summary and trims the summary', () => {
    const { service } = setup();
    expect(service.add({ ...base, summary: ' ' }).summary).toBe('');
    const { summary: _omitted, ...withoutSummary } = base;
    expect(service.add(withoutSummary).summary).toBe('');
    const entry = service.add({ ...base, summary: '  Called  ' });
    expect(entry.summary).toBe('Called');
    expect(service.update(entry.id, { summary: '' }).summary).toBe('');
  });

  it('stores an entry after a meeting with no channel and only the direction note', () => {
    const { service } = setup();
    const { channel: _unused, ...noChannel } = base;
    const entry = service.add({ ...noChannel, kind: 'after_meeting', direction: 'note', summary: 'It went well' });
    expect(entry).toMatchObject({ kind: 'after_meeting', direction: 'note', channel: '', summary: 'It went well' });
    // Whatever channel arrives, this kind keeps it empty.
    expect(service.add({ ...base, kind: 'after_meeting', direction: 'note' }).channel).toBe('');
    expect(errorOf(() => service.add({ ...noChannel, kind: 'after_meeting', direction: 'incoming' }))).toMatchObject({ code: 'communication_invalid', params: { field: 'direction' } });
    expect(errorOf(() => service.add({ ...noChannel }))).toMatchObject({ code: 'communication_invalid', params: { field: 'channel' } });
  });

  it('empties the channel when an entry becomes an after-meeting entry and asks for one when it stops being it', () => {
    const { service } = setup();
    const entry = service.add(base);
    expect(service.update(entry.id, { kind: 'after_meeting', direction: 'note' })).toMatchObject({ kind: 'after_meeting', channel: '' });
    expect(errorOf(() => service.update(entry.id, { kind: 'message', direction: 'incoming' }))).toMatchObject({ code: 'communication_invalid', params: { field: 'channel' } });
    expect(service.update(entry.id, { kind: 'message', direction: 'incoming', channel: 'phone' })).toMatchObject({ kind: 'message', channel: 'phone' });
  });

  it('accepts the video channel and the kinds with their directions', () => {
    const { service } = setup();
    expect(service.add(MEETING_BASE)).toMatchObject({ kind: 'meeting', direction: 'incoming', channel: 'video' });
    expect(service.add({ ...base, kind: 'homework', direction: 'outgoing' })).toMatchObject({ kind: 'homework', direction: 'outgoing' });
    expect(service.add({ ...base, kind: 'confirmation', direction: 'incoming' })).toMatchObject({ kind: 'confirmation' });
  });

  it('refuses a direction that does not belong to the kind', () => {
    const { service } = setup();
    expect(errorOf(() => service.add({ ...MEETING_BASE, direction: 'note' }))).toMatchObject({ code: 'communication_invalid', params: { field: 'direction' } });
    expect(errorOf(() => service.add({ ...base, kind: 'homework', direction: 'note' }))).toMatchObject({ code: 'communication_invalid', params: { field: 'direction' } });
    expect(errorOf(() => service.add({ ...base, kind: 'confirmation', direction: 'outgoing' }))).toMatchObject({ code: 'communication_invalid', params: { field: 'direction' } });
  });

  it('a confirmation fills applied_at only when it is empty and leaves the status alone', () => {
    const { service, applications } = setup();
    service.add({ ...base, kind: 'confirmation', direction: 'incoming', datetime: '2026-10-02T08:03:00.000Z' });
    expect(applications.get('a1')).toMatchObject({ applied_at: '2026-10-02T08:03:00.000Z', status: 'draft' });
    service.add({ ...base, kind: 'confirmation', direction: 'incoming', datetime: '2026-10-09T08:00:00.000Z' });
    expect(applications.get('a1')!.applied_at).toBe('2026-10-02T08:03:00.000Z');
    service.add(base);
    expect(applications.get('a1')!.applied_at).toBe('2026-10-02T08:03:00.000Z');
  });

  it('editing an entry into a confirmation fills applied_at when it is empty, using the time of the entry', () => {
    const { service, applications } = setup();
    service.add({ ...base, datetime: '2026-10-03T09:00:00.000Z' });
    service.update('m1', { kind: 'confirmation', direction: 'incoming' });
    expect(applications.get('a1')).toMatchObject({ applied_at: '2026-10-03T09:00:00.000Z', status: 'draft' });
    service.add({ ...base, datetime: '2026-10-05T09:00:00.000Z' });
    service.update('m2', { kind: 'confirmation', direction: 'incoming' });
    expect(applications.get('a1')!.applied_at).toBe('2026-10-03T09:00:00.000Z');
  });

  it('reads an entry with an empty or unknown kind as a message', () => {
    const communications = new InMemoryRepository<Communication>([
      { id: 'old', application_id: 'a1', datetime: NOW, direction: 'note', channel: 'other', contact_id: '', summary: 'legacy', details: '', attachment_url: '', kind: '', job_id: '' },
      { id: 'odd', application_id: 'a1', datetime: NOW, direction: 'note', channel: 'other', contact_id: '', summary: 'typo', details: '', attachment_url: '', kind: 'mesage', job_id: '' },
    ]);
    const applications = new InMemoryRepository<Application>([makeApplication({ id: 'a1' })]);
    const service = new CommunicationService({ communications, applications, newId: sequentialIds('m'), now: () => NOW });
    expect(service.listFor('a1').map((c) => c.kind)).toEqual(['message', 'message']);
    expect(service.update('old', { direction: 'incoming' })).toMatchObject({ direction: 'incoming' });
  });

  it('updates and removes entries', () => {
    const { service } = setup();
    service.add(base);
    expect(service.update('m1', { summary: 'Edited', details: 'long text', channel: 'phone' })).toMatchObject({ summary: 'Edited', details: 'long text', channel: 'phone' });
    expect(errorOf(() => service.update('m1', { channel: 'pigeon' }))).toMatchObject({ code: 'communication_invalid' });
    expect(errorOf(() => service.update('ghost', {}))).toMatchObject({ code: 'communication_not_found' });
    service.remove('m1');
    expect(service.listFor('a1')).toEqual([]);
    expect(errorOf(() => service.remove('m1'))).toMatchObject({ code: 'communication_not_found' });
  });

  it('changes the kind on update and checks the direction together with it', () => {
    const { service } = setup();
    service.add(base); // outgoing message
    expect(service.update('m1', { kind: 'homework' })).toMatchObject({ kind: 'homework', direction: 'outgoing' });
    expect(errorOf(() => service.update('m1', { kind: 'confirmation' }))).toMatchObject({ code: 'communication_invalid', params: { field: 'direction' } });
    expect(service.update('m1', { kind: 'confirmation', direction: 'incoming' })).toMatchObject({ kind: 'confirmation', direction: 'incoming' });
    expect(errorOf(() => service.update('m1', { direction: 'note' }))).toMatchObject({ code: 'communication_invalid', params: { field: 'direction' } });
    expect(errorOf(() => service.update('m1', { kind: 'party' }))).toMatchObject({ code: 'communication_invalid', params: { field: 'kind' } });
  });
});

describe('CommunicationService: entries kept on a job', () => {
  function jobSetup() {
    const communications = new InMemoryRepository<Communication>();
    const applications = new InMemoryRepository<Application>([makeApplication({ id: 'a1', job_id: 'j1' }), makeApplication({ id: 'a2', job_id: 'j2' })]);
    const jobs = new InMemoryRepository<Job>([makeJob({ id: 'j1' }), makeJob({ id: 'j2' })]);
    return { service: new CommunicationService({ communications, applications, jobs, newId: sequentialIds('m'), now: () => NOW }), applications, communications };
  }
  const entry = { jobId: 'j1', direction: 'outgoing', channel: 'phone', summary: 'Called the recruiter' };

  it('adds an entry to a job without an application and touches no application', () => {
    const { service, applications } = jobSetup();
    const before = applications.list();
    expect(service.add(entry)).toEqual({
      id: 'm1', application_id: '', datetime: NOW, direction: 'outgoing', channel: 'phone', contact_id: '',
      summary: 'Called the recruiter', details: '', attachment_url: '', kind: 'message', job_id: 'j1',
    });
    expect(applications.list()).toEqual(before);
  });

  it('refuses an unknown job and an entry that names neither an application nor a job', () => {
    const { service } = jobSetup();
    expect(errorOf(() => service.add({ ...entry, jobId: 'nope' }))).toMatchObject({ code: 'job_not_found' });
    expect(errorOf(() => service.add({ direction: 'note', channel: 'other' }))).toMatchObject({ code: 'job_not_found' });
    expect(errorOf(() => service.add({ ...entry, kind: 'party' }))).toMatchObject({ code: 'communication_invalid', params: { field: 'kind' } });
  });

  it('lists for a job the entries kept on it and the entries of its applications, newest first, and nothing of other jobs', () => {
    const { service } = jobSetup();
    service.add({ ...entry, datetime: '2026-10-02T10:00:00.000Z', summary: 'job entry' });
    service.add({ applicationId: 'a1', direction: 'outgoing', channel: 'email', datetime: '2026-10-03T10:00:00.000Z', summary: 'application entry' });
    service.add({ applicationId: 'a2', direction: 'outgoing', channel: 'email', summary: 'other job' });
    service.add({ ...entry, jobId: 'j2', summary: 'other job entry' });
    expect(service.listForJob('j1', ['a1']).map((c) => c.summary)).toEqual(['application entry', 'job entry']);
  });

  it('edits and removes an entry of a job', () => {
    const { service, communications } = jobSetup();
    const added = service.add(entry);
    expect(service.update(added.id, { summary: 'Changed', kind: 'meeting', direction: 'incoming', channel: 'video' })).toMatchObject({ summary: 'Changed', kind: 'meeting', job_id: 'j1', application_id: '' });
    service.remove(added.id);
    expect(communications.list()).toEqual([]);
  });
});
