import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { api } from '../api';
import { router } from '../lib/router.svelte';
import { toasts } from '../state/toast.svelte';
import { useDevBackend } from '../test/transport';
import JobDetail from './JobDetail.svelte';

async function idOf(title: string): Promise<string> {
  const jobs = await api.listJobs();
  return jobs.find((job) => job.title === title)!.id;
}

describe('JobDetail', () => {
  it('shows the facts, the applications of the job and safe links', async () => {
    useDevBackend();
    const id = await idOf('Android Developer');
    render(JobDetail, { id });
    expect(await screen.findByRole('heading', { name: 'Android Developer' })).toBeInTheDocument();
    expect(screen.getByText(/Example s\.r\.o\. · Praha · 60,000 – 80,000 CZK .* month/)).toBeInTheDocument();
    const original = screen.getByRole('link', { name: /Open the ad/ });
    expect(original).toHaveAttribute('target', '_blank');
    expect(original).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: /Sent/ })).toHaveAttribute('href', expect.stringMatching(/^#\/applications\//));
  });

  it('shows hostile text as text', async () => {
    useDevBackend();
    const id = await idOf('<img src=x onerror=alert(1)>');
    render(JobDetail, { id });
    expect(await screen.findByRole('heading', { name: '<img src=x onerror=alert(1)>' })).toBeInTheDocument();
    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
  });

  it('saves notes and the gig flag', async () => {
    useDevBackend();
    const id = await idOf('Android Developer');
    render(JobDetail, { id });
    await fireEvent.input(await screen.findByLabelText('Notes'), { target: { value: 'Call on Monday' } });
    await fireEvent.click(screen.getByLabelText('Gig (short-term work)'));
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toasts.map((t) => t.text)).toContain('Saved'));
    const saved = await api.getJob(id);
    expect(saved.job).toMatchObject({ notes: 'Call on Monday', is_gig: true });
  });

  it('creates an application and opens it, warning about an active one', async () => {
    useDevBackend();
    const id = await idOf('Android Developer');
    render(JobDetail, { id });
    await fireEvent.click(await screen.findByRole('button', { name: 'Create application' }));
    const dialog = screen.getByRole('dialog', { name: 'Create application' });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(router.current.name).toBe('application'));
    expect(toasts.some((t) => /already has an active application/.test(t.text))).toBe(true);
    expect((await api.getJob(id)).applications).toHaveLength(2);
  });

  it('can start from an earlier application', async () => {
    useDevBackend();
    const id = await idOf('Android Developer');
    const earlier = (await api.getJob(id)).applications[0]!;
    render(JobDetail, { id });
    await fireEvent.click(await screen.findByRole('button', { name: 'Create application' }));
    const dialog = screen.getByRole('dialog', { name: 'Create application' });
    await fireEvent.change(within(dialog).getByLabelText('Start from'), { target: { value: earlier.id } });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(router.current.name).toBe('application'));
    const created = (await api.getJob(id)).applications.find((a) => a.id !== earlier.id)!;
    expect((await api.getApplication(created.id)).documents.length).toBe((await api.getApplication(earlier.id)).documents.length);
  });

  it('shows an error block for a job that does not exist', async () => {
    useDevBackend();
    render(JobDetail, { id: 'ghost' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Job ghost was not found.');
  });
});
