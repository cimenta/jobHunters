import { describe, expect, it } from 'vitest';
import { ApplicationService } from './application-service';
import { CommunicationService } from './applications/communication-service';
import { compileEmailRules, effectiveEmailRules } from './email-rules';
import { composeDetails, EmailService, suggestStatus } from './email-service';
import { InMemoryAppendLog, InMemoryRepository } from './repository';
import { DEFAULT_TRANSITIONS } from './status';
import { errorOf } from './testing/errors';
import { makeApplication, makeCompany, makeJob, sequentialIds } from './testing/fixtures';
import type { Application, Communication, Company, Email, Job, Reminder, StatusHistoryEntry } from './types';

// Invented data only.

const NOW = '2026-10-29T08:00:00.000Z';

const mail = (over: Partial<Email> = {}): Email => ({
  id: 'e1', thread_id: 't1', received_at: '2026-10-28T10:00:00.000Z', direction: 'incoming', from_email: 'hr@acme.example', from_name: 'Acme HR',
  to: 'me@example.invalid', cc: '', subject: 'Your application has been received', body: 'Dear Alex,\n\nWe have successfully received your application for the Backend Developer role at Acme s.r.o.',
  attachments: '', is_bulk: false, type: '', type_confidence: '', signals: '', application_id: '', job_id: '', match_method: '', state: '', communication_id: '', ...over,
});

function setup(options: { emails?: Email[]; applicationStatus?: string; autoSave?: boolean; withApplication?: boolean } = {}) {
  const emails = new InMemoryRepository<Email>(options.emails ?? [mail()]);
  const companies = new InMemoryRepository<Company>([makeCompany({ id: 'c1', name: 'Acme s.r.o.', website: 'https://acme.example' })]);
  const jobs = new InMemoryRepository<Job>([makeJob({ id: 'j1', company_id: 'c1', title: 'Backend Developer', status: 'applied' })]);
  const applications = new InMemoryRepository<Application>(
    options.withApplication === false ? [] : [makeApplication({ id: 'a1', job_id: 'j1', status: options.applicationStatus ?? 'draft' })],
  );
  const communications = new InMemoryRepository<Communication>();
  const newId = sequentialIds('m');
  const communicationService = new CommunicationService({ communications, applications, jobs, newId, now: () => NOW });
  const history = new InMemoryAppendLog<StatusHistoryEntry>();
  const applicationService = new ApplicationService({
    applications, reminders: new InMemoryRepository<Reminder>(), history, newId: sequentialIds('r'), now: () => NOW, locale: () => 'en', jobs,
  });
  let auto = options.autoSave ?? false;
  const service = new EmailService({
    emails, applications, jobs, companies, communicationService, applicationService,
    rules: () => compileEmailRules(effectiveEmailRules(undefined)), autoSave: () => auto, transitions: () => DEFAULT_TRANSITIONS,
  });
  return { service, emails, applications, communications, jobs, history, setAuto: (value: boolean) => (auto = value) };
}

describe('suggestStatus', () => {
  it('suggests the status an entry implies and respects the rules', () => {
    expect(suggestStatus('confirmation', '', 'draft', DEFAULT_TRANSITIONS)).toBe('sent');
    expect(suggestStatus('confirmation', '', 'sent', DEFAULT_TRANSITIONS)).toBeUndefined();
    expect(suggestStatus('meeting', 'interview', 'sent', DEFAULT_TRANSITIONS)).toBe('interview');
    expect(suggestStatus('meeting', 'interview', 'interview', DEFAULT_TRANSITIONS)).toBeUndefined();
    expect(suggestStatus('message', 'rejected', 'interview', DEFAULT_TRANSITIONS)).toBe('rejected');
    expect(suggestStatus('message', 'offer', 'interview', DEFAULT_TRANSITIONS)).toBe('offer');
    expect(suggestStatus('message', '', 'interview', DEFAULT_TRANSITIONS)).toBeUndefined();
    expect(suggestStatus('homework', 'homework', 'interview', DEFAULT_TRANSITIONS)).toBe('homework');
    expect(suggestStatus('after_meeting', '', 'interview', DEFAULT_TRANSITIONS)).toBeUndefined();
    expect(suggestStatus('meeting', 'interview', 'withdrawn', DEFAULT_TRANSITIONS)).toBeUndefined();
    expect(suggestStatus('meeting', 'interview', 'nonsense', DEFAULT_TRANSITIONS)).toBeUndefined();
  });
});

describe('composeDetails', () => {
  it('puts the notes first, then the header and the body, and can leave the text out', () => {
    const email = mail({ cc: 'boss@acme.example' });
    const full = composeDetails(email, '  my note ', true);
    expect(full.startsWith('my note\n\n--- E-mail ---\nFrom: Acme HR <hr@acme.example>\nTo: me@example.invalid\nCc: boss@acme.example\nDate: 2026-10-28T10:00:00.000Z\nSubject: ')).toBe(true);
    expect(full.endsWith('role at Acme s.r.o.')).toBe(true);
    expect(composeDetails(email, 'only a note', false)).toBe('only a note');
    expect(composeDetails(email, '', false)).toBe('');
  });

  it('stays under the cell limit for a huge body', () => {
    expect(composeDetails(mail({ body: 'x'.repeat(100000) }), 'n', true).length).toBeLessThanOrEqual(49000);
  });
});

describe('EmailService.parseAll', () => {
  it('parses a new mail into a suggestion, finds the application and parses nothing twice', () => {
    const { service, emails } = setup();
    expect(service.parseAll()).toEqual({ parsed: 1, suggested: 1, withoutMatch: 0, saved: 0, ignored: 0 });
    const row = emails.get('e1')!;
    expect(row).toMatchObject({ type: 'confirmation', type_confidence: 'high', state: 'suggested', application_id: 'a1', job_id: 'j1' });
    expect(row.match_method).not.toBe('');
    expect(JSON.parse(row.signals)).toMatchObject({ kind: 'confirmation', dir: 'incoming' });
    expect(service.parseAll()).toEqual({ parsed: 0, suggested: 0, withoutMatch: 0, saved: 0, ignored: 0 });
  });

  it('counts a mail without a match and does not save anything while automatic saving is off', () => {
    const { service, communications } = setup({ emails: [mail({ from_email: 'x@unknown.example', from_name: 'X', body: 'Thank you for applying. We have received your application.' })] });
    expect(service.parseAll()).toMatchObject({ parsed: 1, withoutMatch: 1, saved: 0 });
    expect(communications.list()).toEqual([]);
  });

  it('handles an empty subject and an empty body', () => {
    const { service } = setup({ emails: [mail({ subject: '', body: '' })] });
    expect(() => service.parseAll()).not.toThrow();
  });
});

describe('EmailService.confirm', () => {
  it('saves the entry with the text of the mail and the notes, sets the status Sent and marks the mail confirmed', () => {
    const { service, emails, applications, communications } = setup();
    service.parseAll();
    const entry = service.confirm('e1', { applicationId: 'a1', kind: 'confirmation', direction: 'incoming', channel: 'email', summary: 'Received', notes: 'call them', includeText: true, status: 'sent' });
    expect(entry).toMatchObject({ application_id: 'a1', kind: 'confirmation', direction: 'incoming', channel: 'email', summary: 'Received', datetime: '2026-10-28T10:00:00.000Z' });
    expect(entry.details.startsWith('call them\n\n--- E-mail ---')).toBe(true);
    expect(entry.details).toContain('successfully received your application');
    expect(applications.get('a1')!.status).toBe('sent');
    expect(emails.get('e1')).toMatchObject({ state: 'confirmed', communication_id: entry.id, application_id: 'a1', job_id: 'j1' });
    expect(communications.list()).toHaveLength(1);
  });

  it('dates the status change in the history with the time of the mail, not with the time of saving', () => {
    const { service, history } = setup();
    service.parseAll();
    service.confirm('e1', { applicationId: 'a1', kind: 'confirmation', direction: 'incoming', channel: 'email', status: 'sent' });
    expect(history.list()).toEqual([{ application_id: 'a1', from: 'draft', to: 'sent', at: '2026-10-28T10:00:00.000Z' }]);
  });

  it('leaves the text out when asked, and does not parse or save twice', () => {
    const { service, communications } = setup();
    service.parseAll();
    const entry = service.confirm('e1', { applicationId: 'a1', kind: 'message', direction: 'incoming', channel: 'email', includeText: false, notes: '' });
    expect(entry.details).toBe('');
    expect(errorOf(() => service.confirm('e1', { applicationId: 'a1', kind: 'message', direction: 'incoming' }))).toMatchObject({ code: 'email_state_invalid' });
    expect(communications.list()).toHaveLength(1);
    expect(service.parseAll().parsed).toBe(0);
  });

  it('records manual when the user chose another target than the suggested one', () => {
    const { service, emails } = setup();
    service.parseAll();
    service.confirm('e1', { jobId: 'j1', applicationId: '', kind: 'message', direction: 'incoming' });
    expect(emails.get('e1')).toMatchObject({ application_id: '', job_id: 'j1', match_method: 'manual' });
  });

  it('saves on a job without an application and sets no status', () => {
    const { service, communications, applications } = setup({ withApplication: false });
    service.parseAll();
    const entry = service.confirm('e1', { jobId: 'j1', kind: 'confirmation', direction: 'incoming', status: 'sent' });
    expect(entry).toMatchObject({ application_id: '', job_id: 'j1' });
    expect(communications.list()).toHaveLength(1);
    expect(applications.list()).toEqual([]);
  });

  it('needs a target', () => {
    const { service } = setup();
    expect(errorOf(() => service.confirm('e1', { kind: 'message', direction: 'incoming' }))).toMatchObject({ code: 'email_target_missing' });
    expect(errorOf(() => service.confirm('zz', { jobId: 'j1', kind: 'message', direction: 'incoming' }))).toMatchObject({ code: 'email_not_found' });
  });

  it('refuses a status the rules do not allow before writing anything, and a dated status without a date', () => {
    const { service, communications, applications } = setup({ applicationStatus: 'withdrawn' });
    expect(errorOf(() => service.confirm('e1', { applicationId: 'a1', kind: 'meeting', direction: 'incoming', status: 'interview' }))).toMatchObject({ code: 'transition_not_allowed' });
    expect(communications.list()).toEqual([]);
    const second = setup({ applicationStatus: 'interview' });
    expect(errorOf(() => second.service.confirm('e1', { applicationId: 'a1', kind: 'homework', direction: 'incoming', status: 'homework' }))).toMatchObject({ code: 'reminder_date_required' });
    expect(second.communications.list()).toEqual([]);
    expect(applications.get('a1')!.status).toBe('withdrawn');
  });

  it('sets the status Homework with its deadline and Rejected through the application service', () => {
    const { service, applications, jobs } = setup({ applicationStatus: 'interview', emails: [mail({ id: 'e1' }), mail({ id: 'e2', thread_id: 't2' })] });
    service.confirm('e1', { applicationId: 'a1', kind: 'homework', direction: 'incoming', status: 'homework', statusDate: '2099-01-01' });
    expect(applications.get('a1')!.status).toBe('homework');
    service.confirm('e2', { applicationId: 'a1', kind: 'message', direction: 'incoming', status: 'rejected' });
    expect(applications.get('a1')!.status).toBe('rejected');
    expect(jobs.get('j1')!.status).toBe('archived');
  });

  it('uses the time a meeting names for the entry', () => {
    const { service } = setup({ emails: [mail()] });
    service.parseAll();
    const entry = service.confirm('e1', { applicationId: 'a1', kind: 'meeting', direction: 'incoming', channel: 'video', at: '2026-11-02T14:30' });
    expect(entry.datetime).toBe('2026-11-02T14:30');
  });
});

describe('EmailService.detail, parseOne, ignore, restore', () => {
  it('has no suggestion for a new mail; parseOne parses it; the suggestion lists the candidates', () => {
    const { service } = setup();
    expect(service.detail('e1').suggestion).toBeUndefined();
    const parsed = service.parseOne('e1');
    expect(parsed.suggestion).toMatchObject({ type: 'confirmation', confidence: 'high', kind: 'confirmation', unique: true });
    expect(parsed.suggestion!.candidates[0]).toMatchObject({ applicationId: 'a1' });
    expect(service.parseOne('e1').email.state).toBe('suggested');
  });

  it('lets a suggested mail use the names the current rules find, though its stored suggestion has none', () => {
    const old = { rule: '', kind: 'confirmation', dir: 'incoming', at: '', hint: '', titles: [], companies: [], summary: '' };
    const { service: later, emails } = setup({ emails: [mail({ subject: 'Thanks for applying to Acme', body: 'We will be in touch.', from_email: 'bot@portal.example', from_name: 'Bot', state: 'suggested', type: 'confirmation', signals: JSON.stringify(old) })] });
    expect(emails.get('e1')!.signals).toContain('"companies":[]');
    const suggestion = later.detail('e1').suggestion!;
    expect(suggestion.candidates.map((candidate) => candidate.jobId)).toEqual(['j1']);
    expect(suggestion.companies).toContain('Acme');
  });

  it('ignores and restores', () => {
    const { service, emails } = setup();
    service.parseAll();
    service.ignore('e1');
    expect(emails.get('e1')!.state).toBe('ignored');
    expect(errorOf(() => service.confirm('e1', { jobId: 'j1', kind: 'message', direction: 'incoming' }))).toMatchObject({ code: 'email_state_invalid' });
    service.restore('e1');
    expect(emails.get('e1')).toMatchObject({ state: '', type: '', signals: '', application_id: '' });
    expect(service.parseAll().parsed).toBe(1);
  });

  it('does not ignore or restore a saved mail', () => {
    const { service } = setup();
    service.parseAll();
    service.confirm('e1', { applicationId: 'a1', kind: 'message', direction: 'incoming' });
    expect(errorOf(() => service.ignore('e1'))).toMatchObject({ code: 'email_state_invalid' });
    expect(errorOf(() => service.restore('e1'))).toMatchObject({ code: 'email_state_invalid' });
  });

  it('shows a suggestion again after the signals were lost', () => {
    const { service, emails } = setup();
    service.parseAll();
    emails.update('e1', { signals: '' });
    expect(service.detail('e1').suggestion).toMatchObject({ kind: 'confirmation' });
  });
});

describe('automatic saving', () => {
  it('saves a clear confirmation with one clear target and sets Sent', () => {
    const { service, emails, applications, communications } = setup({ autoSave: true });
    expect(service.parseAll()).toEqual({ parsed: 1, suggested: 0, withoutMatch: 0, saved: 1, ignored: 0 });
    expect(emails.get('e1')).toMatchObject({ state: 'confirmed' });
    expect(applications.get('a1')!.status).toBe('sent');
    expect(communications.list()).toHaveLength(1);
  });

  it('never saves homework or an offer by itself, nor a low confidence one', () => {
    const emails = [
      mail({ id: 'h', thread_id: 'th', subject: 'Next step', body: 'Please complete the attached take-home assignment for Acme s.r.o. Backend Developer.' }),
      mail({ id: 'o', thread_id: 'to', subject: 'Next steps', body: 'We are pleased to offer you the Backend Developer position at Acme s.r.o. The offer letter is attached.' }),
      mail({ id: 'l', thread_id: 'tl', subject: 'Salary', body: 'Hello, what are your salary expectations for Backend Developer at Acme s.r.o.?' }),
    ];
    const { service, communications } = setup({ autoSave: true, emails, applicationStatus: 'interview' });
    expect(service.parseAll()).toMatchObject({ parsed: 3, saved: 0 });
    expect(communications.list()).toEqual([]);
  });

  it('does not save when the target is not unique', () => {
    const { service, communications, jobs } = setup({ autoSave: true, emails: [mail({ body: 'Dear Alex,\n\nWe have successfully received your application.' })] });
    jobs.insert(makeJob({ id: 'j2', company_id: 'c1', title: 'Frontend Developer', status: 'applied' }));
    expect(service.parseAll()).toMatchObject({ saved: 0, suggested: 1 });
    expect(communications.list()).toEqual([]);
  });

  it('turns high confidence noise into ignored only while automatic saving is on', () => {
    const noise = mail({ id: 'n', subject: '12 new jobs for you', body: 'Doporučujeme\nSenior Developer\nunsubscribe', is_bulk: true, from_email: 'alerts@jobs.example', thread_id: 'tn' });
    const off = setup({ emails: [noise] });
    expect(off.service.parseAll()).toMatchObject({ suggested: 1, ignored: 0 });
    expect(off.emails.get('n')!.state).toBe('suggested');
    const on = setup({ emails: [noise], autoSave: true });
    expect(on.service.parseAll()).toMatchObject({ ignored: 1 });
    expect(on.emails.get('n')!.state).toBe('ignored');
  });
});
