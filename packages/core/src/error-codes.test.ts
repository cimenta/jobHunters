import { describe, expect, it } from 'vitest';
import { ApplicationService } from './application-service';
import { DuplicateIdError, NotFoundError, ValidationError } from './errors';
import { buildLabel } from './label';
import { InMemoryAppendLog, InMemoryRepository } from './repository';
import { errorOf } from './testing/errors';
import { makeApplication, sequentialIds } from './testing/fixtures';
import type { Application, Reminder, StatusHistoryEntry } from './types';

const NOW = '2026-10-10T08:00:00.000Z';

function service(application: Partial<Application> = {}) {
  return new ApplicationService({
    applications: new InMemoryRepository<Application>([makeApplication({ id: 'a1', status: 'sent', ...application })]),
    reminders: new InMemoryRepository<Reminder>(),
    history: new InMemoryAppendLog<StatusHistoryEntry>(),
    newId: sequentialIds('r'),
    now: () => NOW,
    locale: () => 'en',
  });
}

describe('repository errors', () => {
  const repo = new InMemoryRepository<{ id: string }>([{ id: 'a' }]);

  it('uses codes and params', () => {
    expect(errorOf(() => repo.insert({ id: '' }))).toMatchObject({ code: 'row_id_required' });
    expect(errorOf(() => repo.insert({ id: 'a' }))).toMatchObject({ code: 'duplicate_id', params: { id: 'a' } });
    expect(errorOf(() => repo.update('zz', {}))).toMatchObject({ code: 'row_not_found', params: { id: 'zz' } });
    expect(errorOf(() => repo.remove('zz'))).toMatchObject({ code: 'row_not_found', params: { id: 'zz' } });
  });

  it('keeps the error classes', () => {
    expect(errorOf(() => repo.insert({ id: '' }))).toBeInstanceOf(ValidationError);
    expect(errorOf(() => repo.insert({ id: 'a' }))).toBeInstanceOf(DuplicateIdError);
    expect(errorOf(() => repo.remove('zz'))).toBeInstanceOf(NotFoundError);
  });
});

describe('label errors', () => {
  const ok = { company: 'Acme', title: 'Dev', attempt: 1, date: '2026-10-01' };
  it('uses codes and params', () => {
    expect(errorOf(() => buildLabel({ ...ok, company: ' ' }))).toMatchObject({ code: 'label_company_required' });
    expect(errorOf(() => buildLabel({ ...ok, title: '' }))).toMatchObject({ code: 'label_title_required' });
    expect(errorOf(() => buildLabel({ ...ok, attempt: 0 }))).toMatchObject({ code: 'label_attempt_invalid', params: { attempt: 0 } });
    expect(errorOf(() => buildLabel({ ...ok, date: 'x' }))).toMatchObject({ code: 'label_date_invalid', params: { date: 'x' } });
  });
});

describe('application service errors', () => {
  it('uses codes and params', () => {
    expect(errorOf(() => service().setStatus('nope', 'interview'))).toMatchObject({
      code: 'application_not_found',
      params: { id: 'nope' },
    });
    expect(errorOf(() => service().setStatus('a1', 'bogus' as never))).toMatchObject({
      code: 'status_unknown',
      params: { status: 'bogus' },
    });
    expect(errorOf(() => service({ status: 'weird' }).setStatus('a1', 'interview'))).toMatchObject({
      code: 'application_status_unknown',
      params: { id: 'a1', status: 'weird' },
    });
    expect(errorOf(() => service({ status: 'draft' }).setStatus('a1', 'interview'))).toMatchObject({
      code: 'transition_not_allowed',
      params: { id: 'a1', from: 'draft', to: 'interview' },
    });
  });

  it('uses codes for reminder dates', () => {
    expect(errorOf(() => service().setStatus('a1', 'waiting'))).toMatchObject({ code: 'reminder_date_required' });
    expect(errorOf(() => service().setStatus('a1', 'waiting', { remindAt: '20.10.2026' }))).toMatchObject({
      code: 'reminder_date_required',
    });
    expect(errorOf(() => service().setStatus('a1', 'waiting', { remindAt: '2026-02-30' }))).toMatchObject({
      code: 'reminder_date_invalid',
      params: { date: '2026-02-30' },
    });
    expect(errorOf(() => service().setStatus('a1', 'waiting', { remindAt: '2026-10-01' }))).toMatchObject({
      code: 'reminder_date_in_past',
      params: { date: '2026-10-01' },
    });
  });
});
