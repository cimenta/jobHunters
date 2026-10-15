import { CATALOGS } from '@jobhunters/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

it('has a navigation label for every section in both languages', () => {
  for (const locale of ['en', 'cs'] as const) {
    for (const section of ['dashboard', 'jobs', 'applications', 'companies', 'settings', 'help']) {
      expect(CATALOGS[locale], `${locale}:${section}`).toHaveProperty(`ui.nav.${section}`);
    }
  }
});

import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { api } from '../api';
import { invalidate, invalidation } from '../state/invalidate.svelte';
import { useDevBackend } from '../test/transport';
import { createRawSnippet, tick } from 'svelte';
import { app, reloadSetupStatus } from '../state/app.svelte';
import Shell from './Shell.svelte';

/** The answer of getMenuCounts for the three numbers these tests care about; every other number is 0. */
const counts = (v: { newJobs?: number; aiTasksWaiting?: number; draftApplications?: number }) => ({
  aiTasksWaiting: v.aiTasksWaiting ?? 0,
  metrics: {
    jobs: { new: v.newJobs ?? 0, new_no_application: 0, no_application: 0, all: 0 },
    applications: { draft: v.draftApplications ?? 0, waiting: 0, sent: 0, active: 0 },
    tasks: { waiting: v.aiTasksWaiting ?? 0, needs_input: 0, failed: 0 },
  },
});


it('shows the version in small text next to the application name', () => {
  app.version = '0.5.0';
  render(Shell, { children: createRawSnippet(() => ({ render: () => '<p>Body</p>' })) });
  const brand = screen.getByText('JobHunters', { exact: false, selector: '.brand' });
  expect(brand).toHaveTextContent('JobHunters');
  const version = screen.getByText('v0.5.0');
  expect(brand).toContainElement(version);
  expect(version).toHaveAttribute('data-ui', 'app.version');
});

it('omits the version while it is not known', () => {
  app.version = '';
  render(Shell, { children: createRawSnippet(() => ({ render: () => '<p>Body</p>' })) });
  expect(document.querySelector('[data-ui="app.version"]')).toBeNull();
});

it('links the Help item last in the navigation', () => {
  render(Shell, { children: createRawSnippet(() => ({ render: () => '<p>Body</p>' })) });
  const links = [...document.querySelectorAll('nav a.item')];
  expect(links.at(-1)).toHaveAttribute('data-ui', 'nav.help');
  expect(links.at(-1)).toHaveAttribute('href', '#/help');
});

it('has a separate green plus link next to Jobs that opens Add job', () => {
  render(Shell, { children: createRawSnippet(() => ({ render: () => '<p>Body</p>' })) });
  const plus = screen.getByRole('link', { name: 'Add job' });
  expect(plus).toHaveAttribute('data-ui', 'nav.add-job');
  expect(plus).toHaveAttribute('href', '#/jobs/new');
  const jobs = document.querySelector('[data-ui="nav.jobs"]')!;
  expect(jobs).not.toContainElement(plus);
  expect(plus.closest('a.item')).toBeNull();
  expect(plus.parentElement).toBe(jobs.parentElement);
  expect(document.querySelectorAll('nav a.item')).toHaveLength(7);
});

describe('menu counts', () => {
  const body = () => createRawSnippet(() => ({ render: () => '<p>Body</p>' }));
  const count = (kind: 'jobs' | 'tasks') => document.querySelector(`[data-ui="nav.count.${kind}"]`);

  it('shows the number of new jobs next to Jobs and no AI tasks number while nothing waits', async () => {
    useDevBackend();
    const expected = (await api.listJobs()).filter((job) => job.status === 'new').length;
    expect(expected).toBeGreaterThan(0);
    render(Shell, { children: body() });
    await waitFor(() => expect(count('jobs')).toHaveTextContent(String(expected)));
    expect(count('tasks')).toBeNull();
    expect(count('jobs')).toHaveAttribute('aria-hidden', 'true');
    expect(count('jobs')).toHaveAttribute('title', `New jobs: ${expected}`);
    expect(screen.getByRole('link', { name: `Jobs, New jobs: ${expected}` })).toHaveAttribute('data-ui', 'nav.jobs');
    expect(count('jobs')!.closest('a.item')).toBeNull();
  });

  it('counts a waiting AI task after a refresh and never counts the awaiting placeholder as a new job', async () => {
    useDevBackend();
    const expected = (await api.listJobs()).filter((job) => job.status === 'new').length;
    render(Shell, { children: body() });
    await waitFor(() => expect(count('jobs')).toHaveTextContent(String(expected)));
    await api.importJob('https://blocked.example/job/1');
    invalidate();
    await waitFor(() => expect(count('tasks')).toHaveTextContent('1'));
    expect(count('tasks')).toHaveAttribute('title', 'AI tasks waiting: 1');
    expect(count('jobs')).toHaveTextContent(String(expected));
    expect(screen.getByRole('link', { name: 'AI tasks, AI tasks waiting: 1' })).toHaveAttribute('data-ui', 'nav.tasks');
  });

  it('renders no element for zero counts', async () => {
    useDevBackend({ seed: false });
    const spy = vi.spyOn(api, 'getMenuCounts');
    render(Shell, { children: body() });
    await waitFor(() => expect(spy).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(count('jobs')).toBeNull();
    expect(count('tasks')).toBeNull();
    expect(screen.getByRole('link', { name: 'Jobs' })).toBeInTheDocument();
    spy.mockRestore();
  });

  it('shows 99+ above 99', async () => {
    const spy = vi.spyOn(api, 'getMenuCounts').mockResolvedValue(counts({ newJobs: 150, aiTasksWaiting: 100, draftApplications: 0 }));
    render(Shell, { children: body() });
    await waitFor(() => expect(count('jobs')).toHaveTextContent('99+'));
    expect(count('tasks')).toHaveTextContent('99+');
    expect(count('jobs')).toHaveAttribute('title', 'New jobs: 150');
    spy.mockRestore();
  });

  it('shows no counts and no error when loading the counts fails', async () => {
    const spy = vi.spyOn(api, 'getMenuCounts').mockRejectedValue(new Error('boom'));
    render(Shell, { children: body() });
    await waitFor(() => expect(spy).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(count('jobs')).toBeNull();
    expect(count('tasks')).toBeNull();
    expect(document.querySelector('[role="alert"]')).toBeNull();
    spy.mockRestore();
  });

  describe('draft applications', () => {
    const draftCount = () => document.querySelector('[data-ui="nav.count.applications"]');
    const zero = { newJobs: 0, aiTasksWaiting: 0, draftApplications: 0 };

    it('shows the number of applications in draft next to Applications', async () => {
      useDevBackend();
      const job = (await api.listJobs()).find((j) => j.application_count === 0)!;
      await api.createApplication({ jobId: job.id });
      const expected = (await api.listApplications()).filter((a) => a.status === 'draft').length;
      expect(expected).toBe(1);
      render(Shell, { children: body() });
      await waitFor(() => expect(draftCount()).toHaveTextContent(String(expected)));
      expect(draftCount()).toHaveAttribute('aria-hidden', 'true');
      expect(draftCount()).toHaveAttribute('title', `Applications in draft: ${expected}`);
      expect(screen.getByRole('link', { name: `Applications, Applications in draft: ${expected}` })).toHaveAttribute('data-ui', 'nav.applications');
      expect(draftCount()!.closest('a.item')).not.toBeNull();
    });

    it('renders no element at zero', async () => {
      const spy = vi.spyOn(api, 'getMenuCounts').mockResolvedValue(counts({ ...zero, newJobs: 3 }));
      render(Shell, { children: body() });
      await waitFor(() => expect(count('jobs')).toHaveTextContent('3'));
      expect(draftCount()).toBeNull();
      expect(screen.getByRole('link', { name: 'Applications' })).toHaveAttribute('data-ui', 'nav.applications');
      spy.mockRestore();
    });

    it('shows 99+ above 99', async () => {
      const spy = vi.spyOn(api, 'getMenuCounts').mockResolvedValue(counts({ ...zero, draftApplications: 120 }));
      render(Shell, { children: body() });
      await waitFor(() => expect(draftCount()).toHaveTextContent('99+'));
      expect(draftCount()).toHaveAttribute('title', 'Applications in draft: 120');
      spy.mockRestore();
    });

    it('shows no number when loading the counts fails', async () => {
      const spy = vi.spyOn(api, 'getMenuCounts').mockRejectedValue(new Error('boom'));
      render(Shell, { children: body() });
      await waitFor(() => expect(spy).toHaveBeenCalled());
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(draftCount()).toBeNull();
      expect(document.querySelector('[role="alert"]')).toBeNull();
      spy.mockRestore();
    });

    it('refreshes after an application is created', async () => {
      useDevBackend();
      render(Shell, { children: body() });
      await waitFor(() => expect(count('jobs')).not.toBeNull());
      expect(draftCount()).toBeNull();
      const job = (await api.listJobs()).find((j) => j.application_count === 0)!;
      await api.createApplication({ jobId: job.id });
      invalidate();
      await waitFor(() => expect(draftCount()).toHaveTextContent('1'));
    });
  });

  describe('chosen numbers', () => {
    const jobsBadge = () => count('jobs');
    const metrics = (jobs: Record<string, number>) => ({
      aiTasksWaiting: 0,
      metrics: { ...counts({}).metrics, jobs: { new: 0, new_no_application: 0, no_application: 0, all: 0, ...jobs } },
    });
    async function choose(numbers: Record<string, string[]>): Promise<void> {
      useDevBackend();
      await api.updateSettings({ menu_numbers: JSON.stringify(numbers) });
      app.settings = (await api.getSettings()).settings;
    }

    it('shows the first and the second number as "first / second", with one line of explanation each on hover', async () => {
      await choose({ jobs: ['new_no_application', 'new'] });
      const spy = vi.spyOn(api, 'getMenuCounts').mockResolvedValue(metrics({ new_no_application: 3, new: 12 }));
      render(Shell, { children: body() });
      await waitFor(() => expect(jobsBadge()).toHaveTextContent('3 / 12'));
      expect(jobsBadge()).toHaveAttribute('title', 'New jobs with no application: 3\nNew jobs: 12');
      expect(screen.getByRole('link', { name: 'Jobs, New jobs with no application: 3, New jobs: 12' })).toHaveAttribute('data-ui', 'nav.jobs');
      spy.mockRestore();
    });

    it('shows a zero next to a number that is not zero, and hides the badge only when every chosen number is zero', async () => {
      await choose({ jobs: ['new_no_application', 'new'] });
      const spy = vi.spyOn(api, 'getMenuCounts').mockResolvedValue(metrics({ new_no_application: 0, new: 12 }));
      render(Shell, { children: body() });
      await waitFor(() => expect(jobsBadge()).toHaveTextContent('0 / 12'));
      spy.mockResolvedValue(metrics({ new_no_application: 0, new: 0, all: 40 }));
      invalidate();
      await waitFor(() => expect(jobsBadge()).toBeNull());
      spy.mockRestore();
    });

    it('shows nothing for an item with no number chosen and the default numbers when nothing was chosen', async () => {
      await choose({ jobs: [] });
      const spy = vi.spyOn(api, 'getMenuCounts').mockResolvedValue(counts({ newJobs: 5, draftApplications: 2 }));
      render(Shell, { children: body() });
      await waitFor(() => expect(document.querySelector('[data-ui="nav.count.applications"]')).toHaveTextContent('2'));
      expect(jobsBadge()).toBeNull();
      spy.mockRestore();
    });
  });

  it('gives the plus link a tooltip', () => {
    render(Shell, { children: body() });
    expect(screen.getByRole('link', { name: 'Add job' })).toHaveAttribute('title', 'Add job');
  });
});

describe('menu counts auto-refresh', () => {
  const body = () => createRawSnippet(() => ({ render: () => '<p>Body</p>' }));
  const count = (kind: 'jobs' | 'tasks') => document.querySelector(`[data-ui="nav.count.${kind}"]`);
  const nums = (newJobs: number, aiTasksWaiting = 0) => counts({ newJobs, aiTasksWaiting });
  let spy: ReturnType<typeof vi.spyOn>;
  let hidden = false;

  async function advance(ms: number) {
    await vi.advanceTimersByTimeAsync(ms);
    await tick();
  }
  async function mount(first = nums(1)) {
    spy = vi.spyOn(api, 'getMenuCounts').mockResolvedValue(first);
    const view = render(Shell, { children: body() });
    await advance(0);
    return view;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    hidden = false;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  });
  afterEach(() => {
    app.settings = undefined;
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('refreshes after 60 s and shows the new numbers', async () => {
    await mount(nums(1));
    expect(count('jobs')).toHaveTextContent('1');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockResolvedValue(nums(5));
    await advance(59_000);
    expect(spy).toHaveBeenCalledTimes(1);
    await advance(1_000);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(count('jobs')).toHaveTextContent('5');
  });

  it('polls every 15 s while AI tasks wait, then back to 60 s', async () => {
    await mount(nums(0, 2));
    expect(count('tasks')).toHaveTextContent('2');
    await advance(15_000);
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockResolvedValue(nums(0, 0));
    await advance(15_000);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(count('tasks')).toBeNull();
    await advance(15_000);
    expect(spy).toHaveBeenCalledTimes(3);
    await advance(45_000);
    expect(spy).toHaveBeenCalledTimes(4);
  });

  it('makes no request while the page is hidden and one when it becomes visible', async () => {
    await mount();
    hidden = true;
    await advance(180_000);
    expect(spy).toHaveBeenCalledTimes(1);
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await advance(0);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('refreshes on window focus but not twice within 2 s', async () => {
    await mount();
    await advance(5_000);
    window.dispatchEvent(new Event('focus'));
    await advance(0);
    expect(spy).toHaveBeenCalledTimes(2);
    await advance(1_000);
    window.dispatchEvent(new Event('focus'));
    await advance(0);
    expect(spy).toHaveBeenCalledTimes(2);
    await advance(1_500);
    window.dispatchEvent(new Event('focus'));
    await advance(0);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('never runs two requests at once', async () => {
    await mount();
    let release!: (value: ReturnType<typeof nums>) => void;
    spy.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    await advance(60_000);
    expect(spy).toHaveBeenCalledTimes(2);
    await advance(10_000);
    window.dispatchEvent(new Event('focus'));
    await advance(120_000);
    expect(spy).toHaveBeenCalledTimes(2);
    release(nums(7));
    await advance(0);
    expect(count('jobs')).toHaveTextContent('7');
    spy.mockResolvedValue(nums(8));
    await advance(60_000);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('keeps the previous numbers when a poll fails and recovers at the next tick', async () => {
    await mount(nums(4));
    spy.mockRejectedValue(new Error('boom'));
    await advance(60_000);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(count('jobs')).toHaveTextContent('4');
    expect(document.querySelector('[role="alert"]')).toBeNull();
    spy.mockResolvedValue(nums(6));
    await advance(60_000);
    expect(count('jobs')).toHaveTextContent('6');
  });

  it('stops all polling and removes the listeners when unmounted', async () => {
    const view = await mount();
    const winRemove = vi.spyOn(window, 'removeEventListener');
    const docRemove = vi.spyOn(document, 'removeEventListener');
    view.unmount();
    expect(winRemove).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(docRemove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    spy.mockClear();
    await advance(300_000);
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    await advance(10_000);
    expect(spy).not.toHaveBeenCalled();
  });

  it('drops a poll result overtaken by invalidate() and never invalidates itself', async () => {
    await mount(nums(1));
    const before = invalidation.version;
    let release!: (value: ReturnType<typeof nums>) => void;
    spy.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    await advance(60_000);
    expect(invalidation.version).toBe(before);
    spy.mockResolvedValue(nums(9));
    invalidate();
    await advance(0);
    expect(count('jobs')).toHaveTextContent('9');
    release(nums(2));
    await advance(0);
    expect(count('jobs')).toHaveTextContent('9');
    expect(invalidation.version).toBe(before + 1);
  });

  it('uses the intervals from the settings without a reload and 0 turns the timer off', async () => {
    await mount(nums(1));
    app.settings = { menu_refresh_seconds: 10, menu_refresh_busy_seconds: 15 } as typeof app.settings;
    await advance(10_000);
    expect(spy).toHaveBeenCalledTimes(2);
    app.settings = { menu_refresh_seconds: 0, menu_refresh_busy_seconds: 15 } as typeof app.settings;
    await advance(600_000);
    expect(spy).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event('focus'));
    await advance(0);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('shows no numbers and no error when the first load fails, and shows them once a poll succeeds', async () => {
    spy = vi.spyOn(api, 'getMenuCounts').mockRejectedValue(new Error('boom'));
    render(Shell, { children: body() });
    await advance(0);
    expect(count('jobs')).toBeNull();
    expect(document.querySelector('[role="alert"]')).toBeNull();
    spy.mockResolvedValue(nums(3));
    await advance(60_000);
    expect(count('jobs')).toHaveTextContent('3');
  });
  it('shows the menu numbers only after the setup check answered, so the red mark is never shown later than them', async () => {
    useDevBackend({ setupNeeded: true });
    const expected = (await api.listJobs()).filter((job) => job.status === 'new').length;
    app.setupChecking = true;
    render(Shell, { children: body() });
    await api.getMenuCounts();
    await tick();
    expect(count('jobs')).toBeNull();
    app.setupNeeded = true;
    app.setupChecking = false;
    await waitFor(() => expect(count('jobs')).toHaveTextContent(String(expected)));
    expect(document.querySelector('[data-ui="nav.action-needed"]')).not.toBeNull();
    app.setupNeeded = false;
  });

  it('keeps the setup check flag on while the question is open and off when it answered or failed', async () => {
    useDevBackend({ setupNeeded: true });
    const pending = reloadSetupStatus();
    expect(app.setupChecking).toBe(true);
    await pending;
    expect(app.setupChecking).toBe(false);
    expect(app.setupNeeded).toBe(true);
    vi.spyOn(api, 'getSetupStatus').mockRejectedValue(new Error('down'));
    await reloadSetupStatus();
    expect(app.setupChecking).toBe(false);
    expect(app.setupNeeded).toBe(false);
  });
});
