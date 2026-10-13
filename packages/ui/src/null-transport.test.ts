import { render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { navigate } from './lib/router.svelte';
import { loadApp } from './state/app.svelte';
import { dropNullProperties, useDevBackend } from './test/transport';
import ApplicationsScreen from './screens/ApplicationsScreen.svelte';
import CompaniesScreen from './screens/CompaniesScreen.svelte';
import Dashboard from './screens/Dashboard.svelte';
import JobsScreen from './screens/JobsScreen.svelte';
import Settings from './screens/Settings.svelte';
import TasksScreen from './screens/TasksScreen.svelte';
import Shell from './layout/Shell.svelte';

/**
 * The real Apps Script transport drops the null properties of objects (they arrive as undefined). Until 0.13.2 the tests
 * never saw that, and the Jobs list crashed on an empty salary. These tests keep the simulation honest and render every
 * main screen through it. A crash while rendering makes Svelte stop quietly, so each screen must also show its REAL rows
 * and must not log an error.
 */
describe('null properties dropped by the transport (as in Apps Script)', () => {
  const errors: unknown[] = [];
  const onError = (event: ErrorEvent): void => void errors.push(event.error ?? event.message);
  beforeEach(() => {
    errors.length = 0;
    vi.spyOn(console, 'error').mockImplementation((...args) => void errors.push(args));
    window.addEventListener('error', onError);
  });
  afterEach(() => {
    window.removeEventListener('error', onError);
    vi.restoreAllMocks();
  });

  it('dropNullProperties removes null properties deeply and keeps everything else', () => {
    expect(dropNullProperties({ a: null, b: 0, c: '', d: false, e: { f: null, g: [{ h: null, i: 1 }] }, j: [null] })).toEqual({
      b: 0, c: '', d: false, e: { g: [{ i: 1 }] }, j: [null],
    });
  });

  it('the test backend really delivers rows without the null fields (so the simulation is active)', async () => {
    useDevBackend();
    const rows = await api.listJobs();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => !('salary_min' in row))).toBe(true);
    expect(rows.some((row) => !('match_percent' in row))).toBe(true);
    expect(rows.every((row) => Object.values(row).every((value) => value !== null))).toBe(true);
  });

  const bad = /undefined|NaN|\[object Object\]|\bnull\b/;

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 80));
  }

  function expectClean(): void {
    expect(errors, 'errors logged while rendering').toEqual([]);
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(document.body.textContent ?? '').not.toMatch(bad);
  }

  it('renders EVERY card of the jobs list (a crash in one card would stop the list)', async () => {
    useDevBackend();
    await loadApp();
    navigate('#/jobs');
    render(JobsScreen);
    const jobs = await api.listJobs();
    expect(jobs.length).toBeGreaterThan(2);
    for (const job of jobs) expect(await screen.findByText(job.title, {}, { timeout: 3000 })).toBeInTheDocument();
    await settle();
    expectClean();
  });

  it('renders the job detail of every job with its title', async () => {
    useDevBackend();
    await loadApp();
    for (const job of await api.listJobs()) {
      navigate(`#/jobs/${job.id}`);
      const view = render(JobsScreen);
      expect(await screen.findByRole('heading', { name: job.title }, { timeout: 3000 })).toBeInTheDocument();
      await settle();
      expectClean();
      view.unmount();
    }
  });

  it('renders every application of the list and of the Kanban board', async () => {
    useDevBackend();
    await loadApp();
    navigate('#/applications');
    render(ApplicationsScreen);
    const applications = await api.listApplications();
    expect(applications.length).toBeGreaterThan(1);
    for (const row of applications) expect(await screen.findByText(row.label, {}, { timeout: 3000 })).toBeInTheDocument();
    await settle();
    expectClean();
  });

  it('renders the dashboard, AI tasks, companies and settings', async () => {
    useDevBackend();
    await loadApp();
    for (const [route, mount, expected] of [
      ['#/', () => render(Dashboard), () => screen.findByRole('heading', { name: 'Dashboard' })],
      ['#/tasks', () => render(TasksScreen), () => screen.findByRole('heading', { name: 'AI tasks' })],
      ['#/companies', () => render(CompaniesScreen), async () => screen.findByText((await api.listCompanies())[0]!.name)],
      ['#/settings', () => render(Settings), () => screen.findByRole('heading', { name: 'Settings' })],
    ] as const) {
      navigate(route);
      const view = mount();
      await expected();
      await settle();
      expectClean();
      view.unmount();
    }
  });

  it('renders the main menu with its counts', async () => {
    useDevBackend();
    await loadApp();
    render(Shell);
    await screen.findByRole('navigation');
    await waitFor(() => expect(document.querySelector('[data-ui="nav.count.jobs"]')).not.toBeNull());
    await settle();
    expect(errors).toEqual([]);
    expect(document.querySelector('nav')?.textContent ?? '').not.toMatch(bad);
  });
});
