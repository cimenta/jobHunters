import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { router } from '../lib/router.svelte';
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
