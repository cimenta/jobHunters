import { describe, expect, it } from 'vitest';
import { applicationRows, buildDashboard, buildMenuCounts, CatalogService, companyRows, jobRows } from './catalog';
import { InMemoryRepository } from './repository';
import { errorOf } from './testing/errors';
import { makeApplication, makeCompany, makeJob, makeReminder } from './testing/fixtures';
import type { AiTask, Application, Company, Job, StatusHistoryEntry } from './types';

const companies = [makeCompany({ id: 'c1', name: 'Example s.r.o.' }), makeCompany({ id: 'c2', name: 'Sample GmbH' })];
const jobs = [
  makeJob({ id: 'j1', company_id: 'c1', title: 'Android Developer', description: 'x'.repeat(500) }),
  makeJob({ id: 'j2', company_id: 'c1', title: 'Data Analyst' }),
  makeJob({ id: 'j3', company_id: 'ghost', title: 'Orphan' }),
];
const applications = [
  makeApplication({ id: 'a1', job_id: 'j1', status: 'sent' }),
  makeApplication({ id: 'a2', job_id: 'j1', status: 'draft' }),
  makeApplication({ id: 'a3', job_id: 'j2', status: 'weird' }),
];

describe('views', () => {
  it('adds company name and application count to jobs and cuts long descriptions', () => {
    const rows = jobRows(jobs, companies, applications);
    expect(rows.map((r) => [r.id, r.company_name, r.application_count])).toEqual([['j1', 'Example s.r.o.', 2], ['j2', 'Example s.r.o.', 1], ['j3', '', 0]]);
    expect(rows[0]!.description).toHaveLength(200);
  });
  describe('match task of a job', () => {
    const mt = (id: string, job_id: string, type: string, status: string, created_at: string): AiTask => ({ id, created_at, application_id: '', job_id, type, target_type: 'job', target_id: job_id, instructions: '', status, ai_note: '', completed_at: '' });
    it('is empty without a task', () => {
      expect(jobRows(jobs, companies, applications).map((r) => [r.match_task_status, r.match_task_id])).toEqual([['', ''], ['', ''], ['', '']]);
    });
    it('uses the newest match task and ignores other types and jobs', () => {
      const tasks = [
        mt('t1', 'j1', 'match_job', 'done', '2026-10-01T10:00:00Z'),
        mt('t2', 'j1', 'match_job', 'pending', '2026-10-02T10:00:00Z'),
        mt('t3', 'j1', 'cover_letter', 'failed', '2026-10-03T10:00:00Z'),
        mt('t4', 'j2', 'import_job', 'done', '2026-10-03T10:00:00Z'),
      ];
      const rows = jobRows(jobs, companies, applications, tasks);
      expect(rows.map((r) => [r.id, r.match_task_status, r.match_task_id])).toEqual([['j1', 'pending', 't2'], ['j2', '', ''], ['j3', '', '']]);
    });
  });
  it('counts jobs and applications per company', () => {
    expect(companyRows(companies, jobs, applications).map((r) => [r.id, r.job_count, r.application_count])).toEqual([['c1', 2, 3], ['c2', 0, 0]]);
  });
  it('adds job title and company name to applications', () => {
    expect(applicationRows(applications, jobs, companies).map((r) => [r.id, r.job_title, r.company_name])).toEqual([
      ['a1', 'Android Developer', 'Example s.r.o.'], ['a2', 'Android Developer', 'Example s.r.o.'], ['a3', 'Data Analyst', 'Example s.r.o.'],
    ]);
  });
  it('adds the match, the salary of the job and the dates from the status history', () => {
    const rich = jobs.map((job) => (job.id === applications[0]!.job_id ? { ...job, match_percent: 82, salary_min: 60000, salary_max: 80000, salary_currency: 'CZK', salary_period: 'month' } : job));
    const history: StatusHistoryEntry[] = [
      { application_id: 'a1', from: 'sent', to: 'waiting', at: '2026-10-09T10:00:00.000Z' },
      { application_id: 'a1', from: '', to: 'draft', at: '2026-10-01T10:00:00.000Z' },
      { application_id: 'a1', from: 'waiting', to: 'sent', at: '2026-10-05T10:00:00.000Z' },
      { application_id: 'a1', from: 'sent', to: 'waiting', at: '2026-10-07T10:00:00.000Z' },
    ];
    const withStatus = applications.map((a) => (a.id === 'a1' ? { ...a, status: 'waiting' } : a));
    const [first] = applicationRows(withStatus, rich, companies, history);
    expect(first).toMatchObject({ match_percent: 82, salary_min: 60000, salary_max: 80000, salary_currency: 'CZK', salary_period: 'month', created_at: '2026-10-01T10:00:00.000Z', waiting_since: '2026-10-09T10:00:00.000Z' });
  });
  it('keeps the start of waiting when the reminder of a waiting application is rescheduled', () => {
    const history: StatusHistoryEntry[] = [
      { application_id: 'a1', from: 'sent', to: 'waiting', at: '2026-10-01T10:00:00.000Z' },
      { application_id: 'a1', from: 'waiting', to: 'waiting', at: '2026-10-12T10:00:00.000Z' },
    ];
    const [first] = applicationRows(applications.map((a) => (a.id === 'a1' ? { ...a, status: 'waiting' } : a)), jobs, companies, history);
    expect(first!.waiting_since).toBe('2026-10-01T10:00:00.000Z');
  });
  it('leaves the dates empty without history and waiting_since empty unless the status is waiting', () => {
    const [first] = applicationRows(applications, jobs, companies);
    expect(first).toMatchObject({ created_at: '', waiting_since: '' });
    const history: StatusHistoryEntry[] = [{ application_id: 'a1', from: 'sent', to: 'waiting', at: '2026-10-09T10:00:00.000Z' }];
    expect(applicationRows(applications.map((a) => ({ ...a, status: 'sent' })), jobs, companies, history)[0]!.waiting_since).toBe('');
  });
});

describe('buildDashboard', () => {
  const reminders = [
    makeReminder({ id: 'r1', application_id: 'a1', due_at: '2026-10-01', text: 'Late' }),
    makeReminder({ id: 'r2', application_id: 'a1', due_at: '2026-10-11', text: 'Today' }),
    makeReminder({ id: 'r3', application_id: 'a3', due_at: '2026-10-15', text: 'Soon' }),
    makeReminder({ id: 'r4', application_id: 'a1', due_at: '2026-12-01', text: 'Far' }),
    makeReminder({ id: 'r5', application_id: 'a1', due_at: '2026-10-01', status: 'done' }),
    makeReminder({ id: 'r6', application_id: 'gone', due_at: '2026-10-11', text: 'Orphan reminder' }),
  ];
  const dashboard = buildDashboard({ reminders, applications, jobs, companies, tasks: [], today: '2026-10-11' });

  it('groups open reminders and names their application, job and company', () => {
    expect(dashboard.reminders.overdue.map((r) => r.id)).toEqual(['r1']);
    expect(dashboard.reminders.today.map((r) => r.id)).toEqual(['r2', 'r6']);
    expect(dashboard.reminders.soon.map((r) => r.id)).toEqual(['r3']);
    expect(dashboard.reminders.overdue[0]).toEqual({
      id: 'r1', due_at: '2026-10-01', text: 'Late', application_id: 'a1',
      application_label: applications[0]!.label, job_title: 'Android Developer', company_name: 'Example s.r.o.',
    });
  });
  it('does not fail for a reminder whose application was removed', () => {
    expect(dashboard.reminders.today[1]).toMatchObject({ id: 'r6', application_label: '', job_title: '', company_name: '' });
  });
  it('counts applications per known status and ignores unknown ones', () => {
    expect(dashboard.statusCounts).toEqual({ draft: 1, sent: 1, waiting: 0, interview: 0, offer: 0, rejected: 0, ghosted: 0, withdrawn: 0 });
  });
});

describe('buildDashboard AI tasks', () => {
  const task = (id: string, type: string, status: string): AiTask => ({ id, created_at: '', application_id: '', job_id: '', type, target_type: 'job', target_id: '', instructions: '', status, ai_note: '', completed_at: '' });
  const base = { reminders: [], applications: [], jobs: [], companies: [], today: '2026-10-12' };
  it('counts waiting AI tasks by type', () => {
    const result = buildDashboard({ ...base,
      tasks: [task('1', 'import_job', 'pending'), task('2', 'import_job', 'in_progress'), task('3', 'match_job', 'pending'), task('4', 'match_job', 'done'), task('5', 'cover_letter', 'needs_input'), task('6', 'weird', 'pending')] });
    expect(result.aiTasksWaiting).toEqual({ total: 4, byType: { import_job: 2, match_job: 1, weird: 1 } });
  });
  it('has an empty count without tasks', () => {
    expect(buildDashboard({ ...base, tasks: [] }).aiTasksWaiting).toEqual({ total: 0, byType: {} });
  });
});

describe('buildMenuCounts', () => {
  const task = (id: string, status: string): AiTask => ({ id, created_at: '', application_id: '', job_id: '', type: 'match_job', target_type: 'job', target_id: '', instructions: '', status, ai_note: '', completed_at: '' });
  it('counts new jobs (empty, unknown and evaluated ones too) and waiting tasks', () => {
    const result = buildMenuCounts({
      jobs: [makeJob({ id: 'a', status: 'new' }), makeJob({ id: 'b', status: '' }), makeJob({ id: 'c', status: 'weird' }), makeJob({ id: 'd', status: 'no' }), makeJob({ id: 'e', status: 'awaiting' }), makeJob({ id: 'f', status: 'new', match_percent: 80 })],
      tasks: [task('1', 'pending'), task('2', 'in_progress'), task('3', 'done'), task('4', 'needs_input'), task('5', 'failed')],
      applications: [],
    });
    expect(result.aiTasksWaiting).toBe(2);
    expect(result.metrics.jobs.new).toBe(4);
    expect(result.metrics.tasks).toEqual({ waiting: 2, needs_input: 1, failed: 1 });
  });
  it('counts only applications in draft status', () => {
    const result = buildMenuCounts({
      jobs: [],
      tasks: [],
      applications: [
        makeApplication({ id: 'a', status: 'draft' }), makeApplication({ id: 'b', status: 'draft' }), makeApplication({ id: 'c', status: 'sent' }),
        makeApplication({ id: 'd', status: 'waiting' }), makeApplication({ id: 'e', status: '' }), makeApplication({ id: 'f', status: 'weird' }),
      ],
    });
    expect(result.metrics.applications.draft).toBe(2);
  });
  it('is zero without data', () => {
    expect(buildMenuCounts({ jobs: [], tasks: [], applications: [] })).toEqual({
      aiTasksWaiting: 0,
      metrics: { jobs: { new: 0, new_no_application: 0, no_application: 0, all: 0 }, applications: { draft: 0, waiting: 0, sent: 0, active: 0 }, tasks: { waiting: 0, needs_input: 0, failed: 0 } },
    });
  });
});

describe('CatalogService', () => {
  const setup = () => {
    const jobRepo = new InMemoryRepository<Job>([makeJob({ id: 'j1' })]);
    const companyRepo = new InMemoryRepository<Company>([makeCompany({ id: 'c1' })]);
    return { service: new CatalogService({ jobs: jobRepo, applications: new InMemoryRepository<Application>(), companies: companyRepo }), jobRepo, companyRepo };
  };

  it('updates the editable fields of a job only', () => {
    const { service, jobRepo } = setup();
    expect(service.updateJob('j1', { notes: 'Call on Monday', is_gig: true })).toMatchObject({ notes: 'Call on Monday', is_gig: true, title: 'Android Developer' });
    expect(jobRepo.get('j1')!.notes).toBe('Call on Monday');
    expect(errorOf(() => service.updateJob('ghost', {}))).toMatchObject({ code: 'job_not_found' });
  });

  it('changes and clears the salary asked for in an application', () => {
    const applications = new InMemoryRepository<Application>([makeApplication({ id: 'a1', salary: '60 000' })]);
    const service = new CatalogService({ jobs: new InMemoryRepository<Job>(), applications, companies: new InMemoryRepository<Company>() });
    expect(service.updateApplication('a1', { salary: '  75 000 CZK / month ' }).salary).toBe('75 000 CZK / month');
    expect(applications.get('a1')!.salary).toBe('75 000 CZK / month');
    expect(service.updateApplication('a1', { salary: '' }).salary).toBe('');
    expect(service.updateApplication('a1', {}).salary).toBe('');
    expect(errorOf(() => service.updateApplication('ghost', { salary: 'x' }))).toMatchObject({ code: 'application_not_found' });
  });

  it('changes the contact person and the reason why not of a job, trims them and keeps them when another field changes', () => {
    const { service, jobRepo } = setup();
    expect(service.updateJob('j1', { contact_person: '  Jana Novakova, recruiter  ', no_reason: ' Salary too low ' })).toMatchObject({ contact_person: 'Jana Novakova, recruiter', no_reason: 'Salary too low' });
    service.updateJob('j1', { notes: 'x' });
    expect(jobRepo.get('j1')).toMatchObject({ contact_person: 'Jana Novakova, recruiter', no_reason: 'Salary too low' });
    expect(service.updateJob('j1', { contact_person: 'x'.repeat(500), no_reason: 'y'.repeat(2000) })).toMatchObject({ contact_person: 'x'.repeat(300), no_reason: 'y'.repeat(1000) });
    expect(service.updateJob('j1', { contact_person: '', no_reason: '' })).toMatchObject({ contact_person: '', no_reason: '' });
  });

  it('changes the location of a job, trims it, caps it and allows clearing it', () => {
    const { service, jobRepo } = setup();
    expect(service.updateJob('j1', { location: '  Brno  ' })).toMatchObject({ location: 'Brno' });
    service.updateJob('j1', { notes: 'x' });
    expect(jobRepo.get('j1')).toMatchObject({ location: 'Brno' });
    expect(service.updateJob('j1', { location: 'z'.repeat(500) })).toMatchObject({ location: 'z'.repeat(300) });
    expect(service.updateJob('j1', { location: '' })).toMatchObject({ location: '' });
  });

  it('changes the shift of a gig, trims it and caps it', () => {
    const { service, jobRepo } = setup();
    expect(service.updateJob('j1', { gig_shift: '  Sat-Sun 8-16  ' })).toMatchObject({ gig_shift: 'Sat-Sun 8-16' });
    service.updateJob('j1', { notes: 'x' });
    expect(jobRepo.get('j1')).toMatchObject({ gig_shift: 'Sat-Sun 8-16' });
    expect(service.updateJob('j1', { gig_shift: 'z'.repeat(500) })).toMatchObject({ gig_shift: 'z'.repeat(300) });
    expect(service.updateJob('j1', { gig_shift: '' })).toMatchObject({ gig_shift: '' });
  });

  it('sets the link of a job: a web address no other job has, trimmed, with the availability starting again', () => {
    const jobRepo = new InMemoryRepository<Job>([
      makeJob({ id: 'j1', url: '', availability: 'offline', offline_strikes: 2, last_checked_at: '2026-10-01T00:00:00.000Z' }),
      makeJob({ id: 'j2', title: 'Other job', url: 'https://example.com/job/2' }),
    ]);
    const service = new CatalogService({ jobs: jobRepo, applications: new InMemoryRepository<Application>(), companies: new InMemoryRepository<Company>() });
    expect(service.updateJob('j1', { url: '  https://www.example.com/job/1  ' })).toMatchObject({
      url: 'https://www.example.com/job/1', source: 'example.com', availability: 'unknown', offline_strikes: 0, last_checked_at: '',
    });
    expect(errorOf(() => service.updateJob('j1', { url: 'not a link' }))).toMatchObject({ code: 'job_url_invalid' });
    expect(errorOf(() => service.updateJob('j1', { url: 'ftp://example.com/x' }))).toMatchObject({ code: 'job_url_invalid' });
    expect(errorOf(() => service.updateJob('j1', { url: 'https://example.com/job/2' }))).toMatchObject({ code: 'job_url_duplicate', params: { id: 'j2', title: 'Other job' } });
    expect(jobRepo.get('j1')!.url).toBe('https://www.example.com/job/1');
    expect(service.updateJob('j1', { url: 'https://www.example.com/job/1' }).url).toBe('https://www.example.com/job/1');
    expect(service.updateJob('j1', { url: '' })).toMatchObject({ url: '', source: '' });
  });

  it('updates a company and validates the name and website', () => {
    const { service } = setup();
    expect(service.updateCompany('c1', { name: ' New name ', website: 'https://example.com', notes: 'n' })).toMatchObject({ name: 'New name', website: 'https://example.com', notes: 'n' });
    expect(service.updateCompany('c1', { website: '' }).website).toBe('');
    expect(errorOf(() => service.updateCompany('c1', { name: '  ' }))).toMatchObject({ code: 'company_name_required' });
    expect(errorOf(() => service.updateCompany('c1', { website: 'javascript:alert(1)' }))).toMatchObject({ code: 'company_website_invalid' });
    expect(errorOf(() => service.updateCompany('ghost', {}))).toMatchObject({ code: 'company_not_found' });
  });
});

describe('awaiting status and byType', () => {
  it('refuses to set a job to awaiting by hand', () => {
    const jobRepo = new InMemoryRepository<Job>([makeJob({ id: 'j1' })]);
    const service = new CatalogService({ jobs: jobRepo, applications: new InMemoryRepository<Application>(), companies: new InMemoryRepository<Company>() });
    expect(errorOf(() => service.updateJob('j1', { status: 'awaiting' })).code).toBe('job_status_invalid');
    expect(jobRepo.get('j1')!.status).toBe('new');
  });

  it('counts a task type called __proto__ in byType too', () => {
    const task = (id: string, type: string) => ({ id, type, status: 'pending' }) as never;
    const result = buildDashboard({ reminders: [], applications: [], jobs: [], companies: [], tasks: [task('t1', '__proto__'), task('t2', 'match_job')], today: '2026-10-11' });
    const counts = Object.values(result.aiTasksWaiting.byType).reduce((a, b) => a + b, 0);
    expect(result.aiTasksWaiting.total).toBe(2);
    expect(counts).toBe(2);
    expect(Object.getOwnPropertyDescriptor(result.aiTasksWaiting.byType, '__proto__')?.value).toBe(1);
  });
});
