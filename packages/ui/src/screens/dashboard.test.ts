import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { api } from '../api';
import { router } from '../lib/router.svelte';
import { loadApp } from '../state/app.svelte';
import { toasts } from '../state/toast.svelte';
import { useDevBackend } from '../test/transport';
import Dashboard from './Dashboard.svelte';

describe('Dashboard', () => {
  it('shows reminders in groups and the application counts', async () => {
    useDevBackend();
    render(Dashboard);
    expect(await screen.findByText('Send the portfolio')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Overdue' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Next 7 days' })).toBeInTheDocument();
    expect(screen.getByText('Ask about the status')).toBeInTheDocument();
    const sent = screen.getByRole('link', { name: /Sent/ });
    expect(sent).toHaveAttribute('href', '#/applications?status=sent');
  });

  it('completes a reminder and removes it from the list', async () => {
    useDevBackend();
    render(Dashboard);
    const item = (await screen.findByText('Send the portfolio')).closest('li')!;
    await fireEvent.click(within(item).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByText('Send the portfolio')).toBeNull());
    expect(toasts.map((t) => t.text)).toContain('Reminder completed: "Send the portfolio"');
  });

  it('postpones a reminder to a chosen date', async () => {
    useDevBackend();
    render(Dashboard);
    const item = (await screen.findByText('Send the portfolio')).closest('li')!;
    await fireEvent.click(within(item).getByRole('button', { name: 'Postpone' }));
    const dialog = screen.getByRole('dialog', { name: 'Postpone reminder' });
    await fireEvent.input(within(dialog).getByLabelText('New date'), { target: { value: '2026-10-20' } });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Postpone' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(toasts.some((t) => t.text === 'Reminder postponed to Oct 20, 2026: "Send the portfolio"')).toBe(true);
  });

  it('opens the application of a reminder', async () => {
    useDevBackend();
    render(Dashboard);
    const item = (await screen.findByText('Ask about the status')).closest('li')!;
    await fireEvent.click(within(item).getByRole('button', { name: 'Open application' }));
    expect(router.current.name).toBe('application');
  });

  it('shows friendly empty states for a fresh installation and leads to adding a job', async () => {
    useDevBackend({ seed: false });
    render(Dashboard);
    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument();
    expect(screen.getByText('You have no applications yet.')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Add a job' }));
    expect(router.current.name).toBe('job-new');
  });
});

describe('Dashboard gig switch and total', () => {
  const total = () => Number(document.querySelector('[data-ui="dashboard.total"] strong')!.textContent);
  const press = (id: 'only' | 'except') => fireEvent.click(document.querySelector(`[data-ui="dashboard.gig.${id}"]`)!);

  it('splits the total into gigs and the rest, and remembers the choice', async () => {
    useDevBackend();
    await loadApp();
    render(Dashboard);
    await screen.findByText('Send the portfolio');
    const all = total();
    expect(all).toBeGreaterThan(0);
    await press('only');
    const gigs = total();
    expect(document.querySelector('[data-ui="dashboard.gig.only"]')!.getAttribute('aria-pressed')).toBe('true');
    await waitFor(async () => expect((await api.getSettings()).settings.ui_state.dashboard_gig).toBe('only'));
    await press('except');
    expect(gigs + total()).toBe(all);
    await press('except');
    expect(document.querySelector('[data-ui="dashboard.gig.except"]')!.getAttribute('aria-pressed')).toBe('false');
    expect(total()).toBe(all);
  });
});

describe('Dashboard AI tasks', () => {
  it('says nothing waits for the AI when there are no tasks', async () => {
    useDevBackend();
    render(Dashboard);
    const card = (await screen.findByRole('heading', { name: 'AI tasks waiting' })).closest('[data-ui="dashboard.ai-tasks"]') as HTMLElement;
    expect(within(card).getByText('Nothing is waiting for the AI')).toBeInTheDocument();
  });

  it('shows the total and a linked row per type', async () => {
    useDevBackend();
    await api.importJob('https://blocked.example/job/1');
    render(Dashboard);
    const card = (await screen.findByRole('heading', { name: 'AI tasks waiting' })).closest('[data-ui="dashboard.ai-tasks"]') as HTMLElement;
    await waitFor(() => expect(within(card).getByRole('link', { name: 'Job import – 1' })).toHaveAttribute('href', '#/tasks'));
    expect(within(card).getByText('Tell Claude: run the pending tasks.')).toBeInTheDocument();
    expect(within(card).queryByText('Nothing is waiting for the AI')).toBeNull();
  });
});
