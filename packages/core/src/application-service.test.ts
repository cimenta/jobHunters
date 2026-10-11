import { describe, expect, it } from 'vitest';
import { ApplicationService } from './application-service';
import { NotFoundError, ValidationError } from './errors';
import type { Locale } from './i18n';
import { InMemoryAppendLog, InMemoryRepository } from './repository';
import { makeApplication, makeReminder, sequentialIds } from './testing/fixtures';
import type { Application, Reminder, StatusHistoryEntry } from './types';
import type { ApplicationStatus } from './status';

const NOW = '2026-10-10T08:00:00.000Z';

function setup(application: Partial<Application> = {}, extraReminders: Reminder[] = [], locale: Locale = 'en') {
  const applications = new InMemoryRepository<Application>([makeApplication({ id: 'a1', status: 'sent', ...application })]);
  const reminders = new InMemoryRepository<Reminder>(extraReminders);
  const history = new InMemoryAppendLog<StatusHistoryEntry>();
  const service = new ApplicationService({ applications, reminders, history, newId: sequentialIds('r'), now: () => NOW, locale: () => locale });
  return { applications, reminders, history, service };
}

describe('setStatus basics', () => {
  it('moves draft to sent, sets applied_at and last_activity_at, and records history', () => {
    const { service, applications, history } = setup({ status: 'draft' });
    const updated = service.setStatus('a1', 'sent');
    expect(updated.status).toBe('sent');
    expect(updated.applied_at).toBe(NOW);
    expect(updated.last_activity_at).toBe(NOW);
    expect(applications.get('a1')?.status).toBe('sent');
    expect(history.list()).toEqual([{ application_id: 'a1', from: 'draft', to: 'sent', at: NOW }]);
  });

  it('does not overwrite an existing applied_at', () => {
    const { service } = setup({ status: 'waiting', applied_at: '2026-09-01T00:00:00.000Z' }, [
      makeReminder({ id: 'w', source: 'waiting' }),
    ]);
    expect(service.setStatus('a1', 'sent').applied_at).toBe('2026-09-01T00:00:00.000Z');
  });

  it('throws NotFoundError for an unknown application', () => {
    const { service } = setup();
    expect(() => service.setStatus('nope', 'interview')).toThrow(NotFoundError);
  });

  it('rejects a transition the rules do not allow', () => {
    const { service, history } = setup({ status: 'rejected' });
    expect(() => service.setStatus('a1', 'sent')).toThrow(ValidationError);
    expect(history.list()).toEqual([]);
  });

  it('rejects a target status that does not exist', () => {
    const { service } = setup();
    expect(() => service.setStatus('a1', 'done' as ApplicationStatus)).toThrow(ValidationError);
  });
});

describe('rows edited outside the app', () => {
  it.each(['Waiting ', 'done', '', 'SENT'])('refuses an application whose stored status is "%s" and writes nothing', (bad) => {
    const { service, applications, history, reminders } = setup({ status: bad });
    expect(() => service.setStatus('a1', 'interview')).toThrow(/Application a1 has unknown status/);
    expect(applications.get('a1')?.status).toBe(bad);
    expect(history.list()).toEqual([]);
    expect(reminders.list()).toEqual([]);
  });
});

describe('entering waiting', () => {
  it('writes the waiting reminder text in the configured language', () => {
    const { service, reminders } = setup({ status: 'sent' }, [], 'cs');
    service.setStatus('a1', 'waiting', { remindAt: '2026-10-20' });
    expect(reminders.list()[0]?.text).toBe('Čekání na odpověď');
  });

  it('creates an open waiting reminder due on the given date', () => {
    const { service, reminders, history } = setup({ job_id: 'j7' });
    service.setStatus('a1', 'waiting', { remindAt: '2026-10-20' });
    expect(reminders.list()).toEqual([
      {
        id: 'r1',
        application_id: 'a1',
        job_id: 'j7',
        due_at: '2026-10-20',
        text: 'Waiting for a reply',
        status: 'open',
        source: 'waiting',
        created_at: NOW,
        done_at: '',
        reminded_at: '',
      },
    ]);
    expect(history.list()).toEqual([{ application_id: 'a1', from: 'sent', to: 'waiting', at: NOW }]);
  });

  it('accepts today as the reminder date', () => {
    const { service } = setup();
    expect(() => service.setStatus('a1', 'waiting', { remindAt: '2026-10-10' })).not.toThrow();
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['dotted format', '10.10.2026'],
    ['words', 'tomorrow'],
    ['impossible calendar date', '2026-02-31'],
    ['in the past', '2026-10-09'],
  ])('rejects a %s reminder date and changes nothing', (_name, remindAt) => {
    const { service, applications, reminders, history } = setup();
    expect(() => service.setStatus('a1', 'waiting', { remindAt })).toThrow(ValidationError);
    expect(applications.get('a1')?.status).toBe('sent');
    expect(reminders.list()).toEqual([]);
    expect(history.list()).toEqual([]);
  });
});

describe('leaving and rescheduling waiting', () => {
  it('closes the waiting reminder when the application leaves waiting', () => {
    const { service, reminders } = setup();
    service.setStatus('a1', 'waiting', { remindAt: '2026-10-20' });
    service.setStatus('a1', 'interview');
    expect(reminders.get('r1')).toMatchObject({ status: 'done', done_at: NOW });
  });

  it('rescheduling closes the old reminder and leaves exactly one open waiting reminder', () => {
    const { service, reminders, history } = setup();
    service.setStatus('a1', 'waiting', { remindAt: '2026-10-20' });
    service.setStatus('a1', 'waiting', { remindAt: '2026-10-25' });
    const open = reminders.list().filter((r) => r.status === 'open' && r.source === 'waiting');
    expect(open).toHaveLength(1);
    expect(open[0]?.due_at).toBe('2026-10-25');
    expect(reminders.get('r1')?.status).toBe('done');
    expect(history.list().map((h) => `${h.from}>${h.to}`)).toEqual(['sent>waiting', 'waiting>waiting']);
  });

  it('does not throw or overwrite when the waiting reminder was already dismissed by hand', () => {
    const { service, reminders } = setup();
    service.setStatus('a1', 'waiting', { remindAt: '2026-10-20' });
    reminders.update('r1', { status: 'dismissed' });
    expect(() => service.setStatus('a1', 'interview')).not.toThrow();
    expect(reminders.get('r1')?.status).toBe('dismissed');
  });

  it('leaves manual reminders and other applications reminders untouched', () => {
    const other = makeReminder({ id: 'o1', application_id: 'a2', source: 'waiting' });
    const manual = makeReminder({ id: 'm1', application_id: 'a1', source: 'manual' });
    const { service, reminders } = setup({ status: 'waiting' }, [other, manual]);
    service.setStatus('a1', 'interview');
    expect(reminders.get('o1')?.status).toBe('open');
    expect(reminders.get('m1')?.status).toBe('open');
  });
});
