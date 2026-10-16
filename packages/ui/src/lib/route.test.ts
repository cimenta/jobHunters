import { describe, expect, it } from 'vitest';
import { parseRoute, paths, sectionOf } from './route';

describe('parseRoute', () => {
  it.each([
    ['', { name: 'dashboard', query: {} }],
    ['#/', { name: 'dashboard', query: {} }],
    ['#/jobs', { name: 'jobs', query: {} }],
    ['#/jobs/new', { name: 'job-new', query: {} }],
    ['#/jobs/j%201', { name: 'job', id: 'j 1', query: {} }],
    ['#/applications?status=sent', { name: 'applications', query: { status: 'sent' } }],
    ['#/applications/a1', { name: 'application', id: 'a1', query: {} }],
    ['#/companies', { name: 'companies', query: {} }],
    ['#/companies/c1', { name: 'company', id: 'c1', query: {} }],
    ['#/emails', { name: 'emails', query: {} }],
    ['#/emails/m%201', { name: 'email', id: 'm 1', query: {} }],
    ['#/settings', { name: 'settings', query: {} }],
    ['#/help', { name: 'help', query: {} }],
    ['#/help/x', { name: 'not-found', query: {} }],
    ['#/nope', { name: 'not-found', query: {} }],
    ['#/jobs/a/b', { name: 'not-found', query: {} }],
  ])('parses %j', (hash, expected) => {
    expect(parseRoute(hash)).toEqual(expected);
  });

  it('survives broken encodings and hostile query keys', () => {
    expect(parseRoute('#/jobs/%E0%A4%A')).toMatchObject({ name: 'job' });
    const route = parseRoute('#/jobs?__proto__=x&a=1');
    expect(route.query.a).toBe('1');
    expect(Object.getPrototypeOf(route.query)).toBeNull();
  });
});

describe('paths', () => {
  it('builds links that parse back', () => {
    expect(parseRoute(paths.job('a b'))).toMatchObject({ name: 'job', id: 'a b' });
    expect(parseRoute(paths.applicationsWithStatus('sent'))).toMatchObject({ name: 'applications', query: { status: 'sent' } });
    expect(parseRoute(paths.newJob).name).toBe('job-new');
  });
});

describe('sectionOf', () => {
  it('maps routes to the navigation section', () => {
    expect(sectionOf(parseRoute('#/jobs/new'))).toBe('jobs');
    expect(sectionOf(parseRoute('#/applications/a1'))).toBe('applications');
    expect(sectionOf(parseRoute('#/companies/c1'))).toBe('companies');
    expect(sectionOf(parseRoute('#/emails/m1'))).toBe('emails');
    expect(sectionOf(parseRoute('#/help'))).toBe('help');
    expect(sectionOf(parseRoute('#/'))).toBe('dashboard');
    expect(sectionOf(parseRoute('#/nope'))).toBe('dashboard');
  });
});
