import { describe, expect, it } from 'vitest';
import { makeApplication, makeJob } from '@jobhunters/core/testing';
import type { JobRow } from '@jobhunters/core';
import { filterApplications, filterJobs, sortJobs } from './filters';

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

describe('hideApplied', () => {
  const none = { text: '', availability: '' as const, gig: false };
  it('drops jobs with an application and combines with other filters', () => {
    expect(filterJobs(jobs, { ...none, hideApplied: true }).map((j) => j.id)).toEqual(['j2']);
    expect(filterJobs(jobs, { ...none, hideApplied: false })).toHaveLength(2);
    expect(filterJobs(jobs, { ...none, hideApplied: true, text: 'android' })).toEqual([]);
    expect(filterJobs(jobs, { ...none, hideApplied: true, gig: true }).map((j) => j.id)).toEqual(['j2']);
  });
});

describe('sortJobs', () => {
  const row = (id: string, found_at: string, match_percent: unknown): JobRow => ({ ...jobs[0]!, id, found_at, match_percent } as unknown as JobRow);
  const rows = [
    row('a', '2026-10-01T10:00:00Z', 50),
    row('b', '2026-10-03T10:00:00Z', undefined),
    row('c', '2026-10-02T10:00:00Z', 90),
    row('d', '', 0),
    row('e', '2026-10-04T10:00:00Z', 50),
    row('f', '2026-10-05T10:00:00Z', null),
    row('g', '2026-10-06T10:00:00Z', Number.NaN),
  ];
  const ids = (order: Parameters<typeof sortJobs>[1], input: readonly JobRow[] = rows) => sortJobs(input, order).map((j) => j.id);
  it('sorts by found_at', () => {
    expect(ids('newest')).toEqual(['g', 'f', 'e', 'b', 'c', 'a', 'd']);
    expect(ids('oldest')).toEqual(['d', 'a', 'c', 'b', 'e', 'f', 'g']);
  });
  it('sorts by match with no match last and ties newest first', () => {
    expect(ids('match_desc')).toEqual(['c', 'e', 'a', 'd', 'g', 'f', 'b']);
    expect(ids('match_asc')).toEqual(['d', 'e', 'a', 'c', 'g', 'f', 'b']);
  });
  it('does not mutate the input and is stable for equal keys', () => {
    const before = rows.map((r) => r.id);
    sortJobs(rows, 'match_desc');
    expect(rows.map((r) => r.id)).toEqual(before);
    const same = [row('x', '', 10), row('y', '', 10), row('z', '', 10)];
    expect(ids('newest', same)).toEqual(['x', 'y', 'z']);
    expect(ids('match_asc', same)).toEqual(['x', 'y', 'z']);
  });
});

describe('filterApplications', () => {
  const job = { match_percent: null, salary_min: null, salary_max: null, salary_currency: '', salary_period: '', created_at: '', waiting_since: '' };
  const rows = [
    { ...makeApplication({ id: 'a1', status: 'sent', label: 'Example – Android – #1 (2026-10)' }), ...job, job_title: 'Android Developer', company_name: 'Example s.r.o.' },
    { ...makeApplication({ id: 'a2', status: 'weird' }), ...job, job_title: 'Analyst', company_name: 'Sample GmbH' },
  ];
  it('filters by status and text', () => {
    expect(filterApplications(rows, { text: '', status: 'sent' }).map((r) => r.id)).toEqual(['a1']);
    expect(filterApplications(rows, { text: 'sample', status: '' }).map((r) => r.id)).toEqual(['a2']);
    expect(filterApplications(rows, { text: '', status: '' })).toHaveLength(2);
  });
});
