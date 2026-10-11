import { describe, expect, it } from 'vitest';
import { InMemoryRepository } from '../repository';
import { errorOf } from '../testing/errors';
import { makeApplication, makeReminder, sequentialIds } from '../testing/fixtures';
import type { Application, Reminder } from '../types';
import { ReminderService, reminderBuckets } from './reminder-service';

const NOW = '2026-10-11T08:00:00.000Z';

function setup(existing: Reminder[] = []) {
  const reminders = new InMemoryRepository<Reminder>(existing);
  const applications = new InMemoryRepository<Application>([makeApplication({ id: 'a1', job_id: 'j1' })]);
  return { service: new ReminderService({ reminders, applications, newId: sequentialIds('r'), now: () => NOW }), reminders };
}

describe('ReminderService', () => {
  it('adds a manual reminder for an application', () => {
    const { service } = setup();
    expect(service.add({ applicationId: 'a1', dueAt: '2026-10-20', text: ' Call HR ' })).toEqual({
      id: 'r1', application_id: 'a1', job_id: 'j1', due_at: '2026-10-20', text: 'Call HR', status: 'open',
      source: 'manual', created_at: NOW, done_at: '', reminded_at: '',
    });
  });

  it('accepts today and rejects past, invalid dates, empty text and unknown applications', () => {
    const { service } = setup();
    expect(service.add({ applicationId: 'a1', dueAt: '2026-10-11', text: 'today' }).due_at).toBe('2026-10-11');
    expect(errorOf(() => service.add({ applicationId: 'a1', dueAt: '2026-10-10', text: 'x' }))).toMatchObject({ code: 'reminder_date_in_past' });
    expect(errorOf(() => service.add({ applicationId: 'a1', dueAt: '2026-02-30', text: 'x' }))).toMatchObject({ code: 'reminder_date_invalid' });
    expect(errorOf(() => service.add({ applicationId: 'a1', dueAt: 'soon', text: 'x' }))).toMatchObject({ code: 'reminder_date_required' });
    expect(errorOf(() => service.add({ applicationId: 'a1', dueAt: '2026-10-20', text: '  ' }))).toMatchObject({ code: 'reminder_text_required' });
    expect(errorOf(() => service.add({ applicationId: 'ghost', dueAt: '2026-10-20', text: 'x' }))).toMatchObject({ code: 'application_not_found' });
  });

  it('completes, dismisses and postpones', () => {
    const { service } = setup([makeReminder({ id: 'r9', reminded_at: '2026-10-09T08:00:00.000Z' })]);
    expect(service.complete('r9')).toMatchObject({ status: 'done', done_at: NOW });
    expect(service.postpone('r9', '2026-11-01')).toMatchObject({ status: 'open', due_at: '2026-11-01', done_at: '', reminded_at: '' });
    expect(service.dismiss('r9')).toMatchObject({ status: 'dismissed' });
    expect(errorOf(() => service.postpone('r9', '2020-01-01'))).toMatchObject({ code: 'reminder_date_in_past' });
    expect(errorOf(() => service.complete('ghost'))).toMatchObject({ code: 'reminder_not_found' });
  });

  it('lists by due date', () => {
    const { service } = setup([
      makeReminder({ id: 'late', due_at: '2026-10-30' }),
      makeReminder({ id: 'early', due_at: '2026-10-12' }),
      makeReminder({ id: 'done', due_at: '2026-10-01', status: 'done' }),
    ]);
    expect(service.listFor('a1').map((r) => r.id)).toEqual(['done', 'early', 'late']);
    expect(service.listOpen().map((r) => r.id)).toEqual(['early', 'late']);
  });
});

describe('reminderBuckets', () => {
  it('splits open reminders into overdue, today and the next 7 days', () => {
    const reminders = [
      makeReminder({ id: 'old', due_at: '2026-10-01' }),
      makeReminder({ id: 'now', due_at: '2026-10-11' }),
      makeReminder({ id: 'edge', due_at: '2026-10-18' }),
      makeReminder({ id: 'far', due_at: '2026-10-19' }),
      makeReminder({ id: 'done', due_at: '2026-10-01', status: 'done' }),
      makeReminder({ id: 'month', due_at: '2026-11-02' }),
    ];
    const buckets = reminderBuckets(reminders, '2026-10-11');
    expect(buckets.overdue.map((r) => r.id)).toEqual(['old']);
    expect(buckets.today.map((r) => r.id)).toEqual(['now']);
    expect(buckets.soon.map((r) => r.id)).toEqual(['edge']);
  });
  it('handles a month and year boundary', () => {
    const buckets = reminderBuckets([makeReminder({ id: 'ny', due_at: '2027-01-03' })], '2026-12-30');
    expect(buckets.soon.map((r) => r.id)).toEqual(['ny']);
  });
});
