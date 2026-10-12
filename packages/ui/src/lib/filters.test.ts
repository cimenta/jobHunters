import { describe, expect, it } from 'vitest';
import { makeApplication, makeJob } from '@jobhunters/core/testing';
import { filterApplications, filterJobs } from './filters';

const jobs = [
  { ...makeJob({ id: 'j1', title: 'Android Developer', location: 'Praha', availability: 'online' }), company_name: 'Example s.r.o.', application_count: 1, match_task_status: '', match_task_id: '' },
  { ...makeJob({ id: 'j2', title: 'Datový analytik', location: 'Brno', availability: 'offline', is_gig: true }), company_name: 'Sample GmbH', application_count: 0, match_task_status: '', match_task_id: '' },
];

describe('filterJobs', () => {
  const none = { text: '', availability: '' as const, gig: false };
  it('returns everything without filters', () => {
    expect(filterJobs(jobs, none).map((j) => j.id)).toEqual(['j1', 'j2']);
  });
  it('searches title, company and location without caring for case or diacritics', () => {
    expect(filterJobs(jobs, { ...none, text: 'DATOVY' }).map((j) => j.id)).toEqual(['j2']);
    expect(filterJobs(jobs, { ...none, text: 'example' }).map((j) => j.id)).toEqual(['j1']);
    expect(filterJobs(jobs, { ...none, text: 'brno' }).map((j) => j.id)).toEqual(['j2']);
    expect(filterJobs(jobs, { ...none, text: 'nothing like this' })).toEqual([]);
  });
  it('filters by availability and gig', () => {
    expect(filterJobs(jobs, { ...none, availability: 'offline' }).map((j) => j.id)).toEqual(['j2']);
    expect(filterJobs(jobs, { ...none, gig: true }).map((j) => j.id)).toEqual(['j2']);
  });
});

describe('filterApplications', () => {
  const rows = [
    { ...makeApplication({ id: 'a1', status: 'sent', label: 'Example – Android – #1 (2026-10)' }), job_title: 'Android Developer', company_name: 'Example s.r.o.' },
    { ...makeApplication({ id: 'a2', status: 'weird' }), job_title: 'Analyst', company_name: 'Sample GmbH' },
  ];
  it('filters by status and text', () => {
    expect(filterApplications(rows, { text: '', status: 'sent' }).map((r) => r.id)).toEqual(['a1']);
    expect(filterApplications(rows, { text: 'sample', status: '' }).map((r) => r.id)).toEqual(['a2']);
    expect(filterApplications(rows, { text: '', status: '' })).toHaveLength(2);
  });
});
