import { describe, expect, it } from 'vitest';
import { applicationRows, buildDashboard, CatalogService, companyRows, jobRows } from './catalog';
import { InMemoryRepository } from './repository';
import { errorOf } from './testing/errors';
import { makeApplication, makeCompany, makeJob, makeReminder } from './testing/fixtures';
import type { Company, Job } from './types';

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
  const dashboard = buildDashboard({ reminders, applications, jobs, companies, today: '2026-10-11' });

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
