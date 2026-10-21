import { describe, expect, it } from 'vitest';
import type { AiTaskRow } from './applications/ai-task-service';
import { markMatches, searchAll, searchWords, type SearchData } from './search';
import { makeApplication, makeCompany, makeJob } from './testing/fixtures';
import type { Email } from './types';

const email = (overrides: Partial<Email> = {}): Email => ({
  id: 'm1', thread_id: '', received_at: '2026-10-16T09:30:00.000Z', direction: 'incoming', from_email: 'jana@example.com', from_name: 'Jana Nováková', to: 'you@example.invalid', cc: '',
  subject: 'Interview invitation', body: 'Thanks for applying to Wipro, we would like to talk.', attachments: '', is_bulk: false, type: '', type_confidence: '', signals: '', application_id: '', job_id: '',
  match_method: '', state: '', communication_id: '', ...overrides,
});

const task = (overrides: Partial<AiTaskRow> = {}): AiTaskRow => ({
  id: 't1', created_at: '2026-10-16T10:00:00.000Z', application_id: '', job_id: 'j1', type: 'match_job', target_type: 'job', target_id: 'j1', instructions: 'a very long prompt about nothing', status: 'done',
  ai_note: 'Strong match: Kotlin and Compose.', completed_at: '', job_title: 'Android Developer', company_name: 'Wipro', ...overrides,
});

const data = (): SearchData => ({
  companies: [makeCompany({ id: 'c1', name: 'Wipro', website: 'https://wipro.example.com', notes: 'Large consultancy' }), makeCompany({ id: 'c2', name: 'Příklad s.r.o.' })],
  jobs: [
    makeJob({ id: 'j1', company_id: 'c1', title: 'Android Developer', location: 'Praha', description: 'Build Kotlin apps for a bank.', contact_person: 'Petr Svoboda, HR' }),
    makeJob({ id: 'j2', company_id: 'c1', title: 'Data Engineer', location: 'Brno', status: 'applied' }),
    makeJob({ id: 'j3', company_id: 'c2', title: 'Wipro integration lead', location: 'Ostrava' }),
  ],
  applications: [makeApplication({ id: 'a1', job_id: 'j1', label: 'Wipro – Android Developer – #1 (2026-10)', status: 'sent', interview_prep: 'Ask about the Kotlin roadmap.' })],
  emails: [email(), email({ id: 'm2', direction: 'outgoing', to: 'Bob <bob@example.com>', subject: 'Re: Interview', body: 'Thursday works.', received_at: '2026-10-17T09:30:00.000Z' })],
  tasks: [task()],
});

describe('searchWords', () => {
  it('splits into folded lower case words', () => {
    expect(searchWords('  Příklad   WIPRO ')).toEqual(['priklad', 'wipro']);
    expect(searchWords('')).toEqual([]);
  });
});

describe('searchAll', () => {
  it('finds a word in every type and says which type each hit is, with how many matched', () => {
    const result = searchAll(data(), 'wipro');
    expect(Object.fromEntries(Object.entries(result.groups).map(([type, group]) => [type, group.total]))).toEqual({ companies: 1, jobs: 3, applications: 1, emails: 1, tasks: 1 });
    expect(result.groups.companies.hits[0]).toMatchObject({ type: 'companies', id: 'c1', title: 'Wipro', counts: { jobs: 2, applications: 1 } });
    expect(result.groups.applications.hits[0]).toMatchObject({ type: 'applications', id: 'a1', status: 'sent', parts: ['Android Developer', 'Wipro'] });
    expect(result.groups.emails.hits[0]).toMatchObject({ type: 'emails', id: 'm1', kind: 'incoming', parts: ['Jana Nováková'] });
    expect(result.groups.tasks.hits[0]).toMatchObject({ type: 'tasks', id: 't1', kind: 'match_job', status: 'done' });
  });

  it('matches a job by its company name and ranks a title match before a match only deeper in the text', () => {
    const jobs = searchAll(data(), 'wipro').groups.jobs;
    expect(jobs.hits.map((hit) => hit.id)).toEqual(['j3', 'j1', 'j2']);
    expect(jobs.hits[0]!.snippet).toBe('');
    expect(jobs.hits[1]!.snippet).toBe('Wipro');
  });

  it('ignores case and diacritics, and needs every word to match somewhere in the item', () => {
    expect(searchAll(data(), 'PRIKLAD').groups.companies.total).toBe(1);
    expect(searchAll(data(), 'novakova zzz').groups.emails.total).toBe(0);
    expect(searchAll(data(), 'novakova interview').groups.emails.hits.map((hit) => hit.id)).toEqual(['m1', 'm2']);
    expect(searchAll(data(), 'novakova thursday').groups.emails.hits.map((hit) => hit.id)).toEqual(['m2']);
    expect(searchAll(data(), 'android bank').groups.jobs.hits.map((hit) => hit.id)).toEqual(['j1']);
    expect(searchAll(data(), 'android zzz').groups.jobs.total).toBe(0);
  });

  it('shows a snippet of the text around a match that is not in the title, cut with dots', () => {
    const long = `${'word '.repeat(40)}needle ${'more '.repeat(40)}`;
    const hit = searchAll({ ...data(), jobs: [makeJob({ id: 'x', title: 'Other', description: long })] }, 'needle').groups.jobs.hits[0]!;
    expect(hit.snippet.startsWith('…')).toBe(true);
    expect(hit.snippet.endsWith('…')).toBe(true);
    expect(hit.snippet).toContain('needle');
    expect(hit.snippet.length).toBeLessThan(130);
  });

  it('finds the interview preparation of an application, the whole e-mail text, the contact person and the note of the AI', () => {
    expect(searchAll(data(), 'roadmap').groups.applications.hits.map((hit) => hit.id)).toEqual(['a1']);
    expect(searchAll(data(), 'thursday').groups.emails.hits.map((hit) => hit.id)).toEqual(['m2']);
    expect(searchAll(data(), 'svoboda').groups.jobs.hits.map((hit) => hit.id)).toEqual(['j1']);
    expect(searchAll(data(), 'compose').groups.tasks.hits.map((hit) => hit.id)).toEqual(['t1']);
    expect(searchAll(data(), 'match job').groups.tasks.total).toBe(1);
  });

  it('puts the newest e-mail first when nothing else ranks them, and names the recipient of an outgoing one', () => {
    const hits = searchAll(data(), 'example').groups.emails.hits;
    expect(hits.map((hit) => hit.id)).toEqual(['m2', 'm1']);
    expect(hits[0]!.parts).toEqual(['Bob']);
  });

  it('limits a group but still counts all matches, and can search only some types', () => {
    const many: SearchData = { ...data(), jobs: Array.from({ length: 8 }, (_, index) => makeJob({ id: `j${index}`, company_id: 'c1', title: `Consultant ${index}` })) };
    const group = searchAll(many, 'consultant').groups.jobs;
    expect(group.total).toBe(8);
    expect(group.hits).toHaveLength(5);
    expect(searchAll(many, 'consultant', { limit: 50 }).groups.jobs.hits).toHaveLength(8);
    const only = searchAll(data(), 'wipro', { types: ['jobs'] });
    expect(only.groups.jobs.total).toBe(3);
    expect(only.groups.companies.total).toBe(0);
    expect(only.groups.emails.total).toBe(0);
  });

  it('returns nothing for a query that is too short, and an empty emails group when the sheet is missing', () => {
    expect(searchAll(data(), 'w').groups.jobs.total).toBe(0);
    expect(searchAll(data(), ' ').groups.jobs.total).toBe(0);
    expect(searchAll({ ...data(), emails: undefined }, 'interview').groups.emails.total).toBe(0);
  });

  it('copes with a text that has no title, such as an e-mail without a subject or a task without a job', () => {
    const result = searchAll({ ...data(), emails: [email({ subject: '' })], tasks: [task({ job_title: '', company_name: '' })] }, 'kotlin');
    expect(result.groups.emails.total).toBe(0);
    expect(result.groups.tasks.hits[0]).toMatchObject({ title: '', snippet: 'Strong match: Kotlin and Compose.' });
  });

  it('searches a large mailbox quickly', () => {
    const emails = Array.from({ length: 3000 }, (_, index) => email({ id: `m${index}`, body: `${'lorem ipsum '.repeat(800)} unique${index}` }));
    const started = Date.now();
    const result = searchAll({ ...data(), emails }, 'unique2999');
    expect(result.groups.emails.hits.map((hit) => hit.id)).toEqual(['m2999']);
    expect(Date.now() - started).toBeLessThan(3000);
  });
});

describe('markMatches', () => {
  it('cuts the text into pieces and marks the words, whatever their case or diacritics', () => {
    expect(markMatches('Příklad s.r.o. a PRIKLAD', ['priklad'])).toEqual([
      { text: 'Příklad', hit: true }, { text: ' s.r.o. a ', hit: false }, { text: 'PRIKLAD', hit: true },
    ]);
    expect(markMatches('Wipro Wipro-x', ['wipro'])).toEqual([{ text: 'Wipro', hit: true }, { text: ' ', hit: false }, { text: 'Wipro', hit: true }, { text: '-x', hit: false }]);
  });

  it('merges overlapping words and leaves a text without a match whole', () => {
    expect(markMatches('android', ['and', 'droid'])).toEqual([{ text: 'android', hit: true }]);
    expect(markMatches('nothing', ['zzz'])).toEqual([{ text: 'nothing', hit: false }]);
    expect(markMatches('', ['a'])).toEqual([{ text: '', hit: false }]);
    expect(markMatches('x', [])).toEqual([{ text: 'x', hit: false }]);
  });
});
