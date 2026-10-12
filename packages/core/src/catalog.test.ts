import { describe, expect, it } from 'vitest';
import { applicationRows, buildDashboard, buildMenuCounts, CatalogService, companyRows, jobRows } from './catalog';
import { InMemoryRepository } from './repository';
import { errorOf } from './testing/errors';
import { makeApplication, makeCompany, makeJob, makeReminder } from './testing/fixtures';
import type { AiTask, Company, Job } from './types';

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
    });
    expect(result).toEqual({ newJobs: 4, aiTasksWaiting: 2 });
  });
  it('is zero without data', () => {
    expect(buildMenuCounts({ jobs: [], tasks: [] })).toEqual({ newJobs: 0, aiTasksWaiting: 0 });
  });
});

describe('CatalogService', () => {
  const setup = () => {
    const jobRepo = new InMemoryRepository<Job>([makeJob({ id: 'j1' })]);
    const companyRepo = new InMemoryRepository<Company>([makeCompany({ id: 'c1' })]);
    return { service: new CatalogService({ jobs: jobRepo, companies: companyRepo }), jobRepo, companyRepo };
  };

  it('updates the editable fields of a job only', () => {
    const { service, jobRepo } = setup();
    expect(service.updateJob('j1', { notes: 'Call on Monday', is_gig: true })).toMatchObject({ notes: 'Call on Monday', is_gig: true, title: 'Android Developer' });
    expect(jobRepo.get('j1')!.notes).toBe('Call on Monday');
    expect(errorOf(() => service.updateJob('ghost', {}))).toMatchObject({ code: 'job_not_found' });
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
    const service = new CatalogService({ jobs: jobRepo, companies: new InMemoryRepository<Company>() });
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
