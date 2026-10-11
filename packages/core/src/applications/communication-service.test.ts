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

describe('CommunicationService', () => {
  it('adds an entry, defaults the time to now and updates last_activity_at', () => {
    const { service, applications } = setup();
    expect(service.add(base)).toEqual({
      id: 'm1', application_id: 'a1', datetime: NOW, direction: 'outgoing', channel: 'email', contact_id: '',
      summary: 'Sent the application', details: '', attachment_url: '',
    });
    expect(applications.get('a1')!.last_activity_at).toBe(NOW);
  });

  it('lists newest first', () => {
    const { service } = setup();
    service.add({ ...base, datetime: '2026-10-01T10:00:00.000Z', summary: 'old' });
    service.add({ ...base, datetime: '2026-10-05T10:00:00.000Z', summary: 'new' });
    expect(service.listFor('a1').map((c) => c.summary)).toEqual(['new', 'old']);
  });

  it('rejects bad direction, channel, empty summary and bad datetime', () => {
    const { service } = setup();
    expect(errorOf(() => service.add({ ...base, direction: 'sideways' }))).toMatchObject({ code: 'communication_invalid', params: { field: 'direction' } });
    expect(errorOf(() => service.add({ ...base, channel: 'pigeon' }))).toMatchObject({ code: 'communication_invalid', params: { field: 'channel' } });
    expect(errorOf(() => service.add({ ...base, summary: ' ' }))).toMatchObject({ code: 'communication_invalid', params: { field: 'summary' } });
    expect(errorOf(() => service.add({ ...base, datetime: 'yesterday' }))).toMatchObject({ code: 'communication_invalid', params: { field: 'datetime' } });
    expect(errorOf(() => service.add({ ...base, applicationId: 'ghost' }))).toMatchObject({ code: 'application_not_found' });
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
});
