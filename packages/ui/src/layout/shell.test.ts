import { CATALOGS } from '@jobhunters/core';
import { describe, expect, it, vi } from 'vitest';

it('has a navigation label for every section in both languages', () => {
  for (const locale of ['en', 'cs'] as const) {
    for (const section of ['dashboard', 'jobs', 'applications', 'companies', 'settings', 'help']) {
      expect(CATALOGS[locale], `${locale}:${section}`).toHaveProperty(`ui.nav.${section}`);
    }
  }
});

import { render, screen, waitFor } from '@testing-library/svelte';
import { api } from '../api';
import { invalidate } from '../state/invalidate.svelte';
import { useDevBackend } from '../test/transport';
import { createRawSnippet } from 'svelte';
import { app } from '../state/app.svelte';
import Shell from './Shell.svelte';

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
    expect(screen.getByRole('link', { name: `Jobs, ${expected} new` })).toHaveAttribute('data-ui', 'nav.jobs');
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
    expect(screen.getByRole('link', { name: 'AI tasks, 1 waiting' })).toHaveAttribute('data-ui', 'nav.tasks');
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
    const spy = vi.spyOn(api, 'getMenuCounts').mockResolvedValue({ newJobs: 150, aiTasksWaiting: 100 });
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

  it('gives the plus link a tooltip', () => {
    render(Shell, { children: body() });
    expect(screen.getByRole('link', { name: 'Add job' })).toHaveAttribute('title', 'Add job');
  });
});
