import { describe, expect, it } from 'vitest';
import { InMemoryRepository } from '../repository';
import { errorOf } from '../testing/errors';
import { makeApplication, sequentialIds } from '../testing/fixtures';
import type { Application, Communication } from '../types';
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
      summary: 'Sent the application', details: '', attachment_url: '', kind: 'message',
    });
    expect(applications.get('a1')!.last_activity_at).toBe(NOW);
  });

  it('lists newest first', () => {
    const { service } = setup();
    service.add({ ...base, datetime: '2026-10-01T10:00:00.000Z', summary: 'old' });
    service.add({ ...base, datetime: '2026-10-05T10:00:00.000Z', summary: 'new' });
    expect(service.listFor('a1').map((c) => c.summary)).toEqual(['new', 'old']);
  });

  it('rejects bad direction, channel, kind, empty summary and bad datetime', () => {
    const { service } = setup();
    expect(errorOf(() => service.add({ ...base, direction: 'sideways' }))).toMatchObject({ code: 'communication_invalid', params: { field: 'direction' } });
    expect(errorOf(() => service.add({ ...base, channel: 'pigeon' }))).toMatchObject({ code: 'communication_invalid', params: { field: 'channel' } });
    expect(errorOf(() => service.add({ ...base, kind: 'party' }))).toMatchObject({ code: 'communication_invalid', params: { field: 'kind' } });
    expect(errorOf(() => service.add({ ...base, summary: ' ' }))).toMatchObject({ code: 'communication_invalid', params: { field: 'summary' } });
    expect(errorOf(() => service.add({ ...base, datetime: 'yesterday' }))).toMatchObject({ code: 'communication_invalid', params: { field: 'datetime' } });
    expect(errorOf(() => service.add({ ...base, applicationId: 'ghost' }))).toMatchObject({ code: 'application_not_found' });
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
      { id: 'old', application_id: 'a1', datetime: NOW, direction: 'note', channel: 'other', contact_id: '', summary: 'legacy', details: '', attachment_url: '', kind: '' },
      { id: 'odd', application_id: 'a1', datetime: NOW, direction: 'note', channel: 'other', contact_id: '', summary: 'typo', details: '', attachment_url: '', kind: 'mesage' },
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
