import { describe, expect, it } from 'vitest';
import type { ApplicationRow } from './catalog';
import { matchEmail, normalizeName, type MatchInput } from './email-matcher';
import { makeApplication, makeCompany, makeJob } from './testing/fixtures';
import type { Email } from './types';

// Invented data only.

const email = (over: Partial<Email> = {}): Email => ({
  id: 'e1', thread_id: 't1', received_at: '2026-10-20T10:00:00Z', direction: 'incoming', from_email: 'hr@acme.example', from_name: 'Acme HR',
  to: 'me@example.invalid', cc: '', subject: 'Hello', body: 'Hello', attachments: '', is_bulk: false, type: '', type_confidence: '', signals: '',
  application_id: '', job_id: '', match_method: '', state: '', communication_id: '', ...over,
});

const row = (over: Partial<ApplicationRow> & { id: string; job_id: string }): ApplicationRow => {
  const { interview_prep: _drop, ...base } = makeApplication(over);
  return { ...base, job_title: 'Developer', company_name: 'Acme', location: '', is_remote: false, is_hybrid: false, match_percent: null, salary_min: null, salary_max: null, salary_currency: '', salary_period: '', created_at: '', waiting_since: '', ...over };
};

const acme = makeCompany({ id: 'c1', name: 'Acme s.r.o.', website: 'https://www.acme.example' });
const globex = makeCompany({ id: 'c2', name: 'Globex', website: '' });
const jobs = [
  makeJob({ id: 'j1', company_id: 'c1', title: 'Backend Developer', url: 'https://jobs.example.invalid/offer/1234567' }),
  makeJob({ id: 'j2', company_id: 'c2', title: 'Data Analyst' }),
  makeJob({ id: 'j3', company_id: 'c2', title: 'Product Manager' }),
];

const base = (over: Partial<MatchInput> = {}): MatchInput => ({
  email: email(), titleHints: [], companyHints: [], applications: [], jobs, companies: [acme, globex], others: [], relayDomains: ['jobs.example', 'portal.example'], ...over,
});

describe('normalizeName', () => {
  it('ignores case, diacritics, company forms and punctuation', () => {
    expect(normalizeName('Příliš Žlutý, s.r.o.')).toBe('prilis zluty');
    expect(normalizeName('ACME a.s.')).toBe('acme');
    expect(normalizeName('Initech GmbH')).toBe('initech');
    expect(normalizeName('R&D Labs Inc.')).toBe('r d labs');
  });
});

describe('matchEmail', () => {
  it('finds nothing when nothing fits', () => {
    const result = matchEmail(base({ email: email({ from_email: 'x@unknown.example', thread_id: '' }) }));
    expect(result).toEqual({ candidates: [], best: undefined, unique: false });
  });

  it('follows the thread of a mail that is already tied to an application', () => {
    const applications = [row({ id: 'a1', job_id: 'j2' })];
    const others = [email({ id: 'e0', thread_id: 't1', application_id: 'a1', state: 'confirmed' })];
    const result = matchEmail(base({ applications, others }));
    expect(result.best).toMatchObject({ applicationId: 'a1', jobId: 'j2', method: 'thread', score: 100 });
    expect(result.unique).toBe(true);
  });

  it('follows the sender of a saved mail, but not a portal sender', () => {
    const applications = [row({ id: 'a1', job_id: 'j1' })];
    const others = [email({ id: 'e0', thread_id: 't9', from_email: 'jana@acme.example', application_id: 'a1', state: 'confirmed' })];
    const direct = matchEmail(base({ email: email({ thread_id: 't2', from_email: 'jana@acme.example' }), applications, others }));
    expect(direct.best).toMatchObject({ applicationId: 'a1', method: 'contact', score: 80 });
    const viaPortal = matchEmail(base({ email: email({ thread_id: 't2', from_email: 'bot@portal.example', from_name: 'Bot' }), applications, others: others.map((o) => ({ ...o, from_email: 'bot@portal.example' })) }));
    expect(viaPortal.candidates).toEqual([]);
  });

  it('uses the recipient as the counterpart of an outgoing mail', () => {
    const applications = [row({ id: 'a1', job_id: 'j1' })];
    const others = [email({ id: 'e0', thread_id: 't9', from_email: 'jana@acme.example', application_id: 'a1', state: 'confirmed' })];
    const outgoing = email({ thread_id: 't3', direction: 'outgoing', from_email: 'me@example.invalid', to: 'Jana <jana@acme.example>' });
    expect(matchEmail(base({ email: outgoing, applications, others })).best).toMatchObject({ method: 'contact' });
  });

  it('finds a job by its link in the text', () => {
    const result = matchEmail(base({ email: email({ thread_id: '', from_email: 'x@unknown.example', body: 'See https://www.jobs.example.invalid/offer/1234567?utm=1 please' }) }));
    expect(result.best).toMatchObject({ jobId: 'j1', applicationId: '', method: 'url', score: 90 });
  });

  it('finds the jobs of a company by the domain of the sender, never for a relay domain', () => {
    expect(matchEmail(base({ email: email({ thread_id: '' }) })).best).toMatchObject({ jobId: 'j1', method: 'domain', score: 70 });
    const relayCompany = makeCompany({ id: 'c3', name: 'Portal', website: 'https://portal.example' });
    const result = matchEmail(base({ email: email({ thread_id: '', from_email: 'bot@portal.example', from_name: 'Bot' }), companies: [relayCompany], jobs: [makeJob({ id: 'j9', company_id: 'c3', title: 'Whatever Role' })] }));
    expect(result.candidates).toEqual([]);
  });

  it('finds a company by the name in the domain when it has no website', () => {
    const result = matchEmail(base({ email: email({ thread_id: '', from_email: 'karin@globex.example' }) }));
    expect(result.candidates.map((c) => c.jobId).sort()).toEqual(['j2', 'j3']);
  });

  it('scores a company and a title together above the company alone, and finds a title that is unique', () => {
    const together = matchEmail(base({ email: email({ thread_id: '', from_email: 'bot@portal.example', from_name: 'Bot' }), companyHints: ['Globex'], titleHints: ['Data Analyst (Brno)'] }));
    expect(together.best).toMatchObject({ jobId: 'j2', method: 'title', score: 85 });
    expect(together.unique).toBe(true);
    const companyOnly = matchEmail(base({ email: email({ thread_id: '', from_email: 'bot@portal.example', from_name: 'Bot' }), companyHints: ['GLOBEX, s.r.o.'] }));
    expect(companyOnly.candidates).toHaveLength(2);
    expect(companyOnly.unique).toBe(false);
    const titleOnly = matchEmail(base({ email: email({ thread_id: '', from_email: 'bot@portal.example', from_name: 'Bot' }), titleHints: ['Product Manager'] }));
    expect(titleOnly.best).toMatchObject({ jobId: 'j3', method: 'title', score: 50 });
    expect(titleOnly.unique).toBe(false);
  });

  it('reads the company from the name of an applicant system sender', () => {
    const result = matchEmail(base({ email: email({ thread_id: '', from_email: 'no-reply@portal.example', from_name: 'Globex Hiring Team' }), titleHints: ['Data Analyst'] }));
    expect(result.best).toMatchObject({ jobId: 'j2', score: 85 });
  });

  it('reads the company from the name of the sender of an applicant system: "HERE @ icims", "Amethyst from Acme"', () => {
    const here = makeCompany({ id: 'c9', name: 'HERE Technologies' });
    const job = makeJob({ id: 'j9', company_id: 'c9', title: 'Staff Engineer' });
    const result = matchEmail(base({ email: email({ thread_id: '', from_email: 'here+autoreply@portal.example', from_name: 'HERE @ icims' }), companies: [acme, globex, here], jobs: [...jobs, job] }));
    expect(result.best).toMatchObject({ jobId: 'j9', method: 'company', score: 60 });
    expect(result.unique).toBe(true);
    const bot = matchEmail(base({ email: email({ thread_id: '', from_email: 'bot@portal.example', from_name: 'Amethyst from Globex' }), titleHints: ['Data Analyst'] }));
    expect(bot.best).toMatchObject({ jobId: 'j2', score: 85 });
  });

  it('uses the latest open application of a job, else the latest one, else the job itself', () => {
    const applications = [
      row({ id: 'a1', job_id: 'j1', attempt: 1, status: 'rejected', last_activity_at: '2026-10-25T10:00:00Z' }),
      row({ id: 'a2', job_id: 'j1', attempt: 2, status: 'sent', last_activity_at: '2026-10-10T10:00:00Z' }),
    ];
    expect(matchEmail(base({ applications })).best).toMatchObject({ applicationId: 'a2', jobId: 'j1' });
    const closed = [row({ id: 'a1', job_id: 'j1', status: 'rejected' }), row({ id: 'a3', job_id: 'j1', attempt: 2, status: 'withdrawn' })];
    expect(matchEmail(base({ applications: closed })).best?.applicationId).toBe('a3');
    expect(matchEmail(base()).best).toMatchObject({ applicationId: '', jobId: 'j1' });
  });

  it('is not unique when two targets are about as strong, and a stronger method wins for the same target', () => {
    const tie = matchEmail(base({ email: email({ thread_id: '', from_email: 'x@unknown.example' }), companyHints: ['Globex'] }));
    expect(tie.unique).toBe(false);
    const applications = [row({ id: 'a1', job_id: 'j1' })];
    const both = matchEmail(base({ applications, others: [email({ id: 'e0', application_id: 'a1', state: 'confirmed' })], companyHints: ['Acme'] }));
    expect(both.candidates.filter((c) => c.applicationId === 'a1')).toHaveLength(1);
    expect(both.best?.method).toBe('thread');
  });

  it('puts the open application of a company before a ghosted one when both are equally strong', () => {
    const applications = [
      row({ id: 'a1', job_id: 'j2', status: 'ghosted', last_activity_at: '2026-09-01T10:00:00Z' }),
      row({ id: 'a2', job_id: 'j3', status: 'waiting', last_activity_at: '2026-10-01T10:00:00Z' }),
    ];
    const result = matchEmail(base({ email: email({ thread_id: '', from_email: 'x@unknown.example' }), companyHints: ['Globex'], applications }));
    expect(result.candidates.map((c) => c.applicationId)).toEqual(['a2', 'a1']);
    expect(result.best).toMatchObject({ applicationId: 'a2', jobId: 'j3' });
  });

  it('ignores the mail itself and mails that are not tied to anything', () => {
    const self = email({ id: 'e1', application_id: 'a1' });
    const untied = email({ id: 'e5', thread_id: 't1' });
    const result = matchEmail(base({ email: email({ from_email: 'x@unknown.example' }), applications: [row({ id: 'a1', job_id: 'j1' })], others: [self, untied] }));
    expect(result.candidates).toEqual([]);
  });

  it('does not throw on empty fields', () => {
    expect(() => matchEmail(base({ email: email({ thread_id: '', from_email: '', from_name: '', to: '', subject: '', body: '' }) }))).not.toThrow();
  });
});
