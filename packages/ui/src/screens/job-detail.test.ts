import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { api } from '../api';
import { loadApp } from '../state/app.svelte';
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
    await fireEvent.click(screen.getByRole('tab', { name: 'Description' }));
    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
  });

  it('saves notes and the gig flag', async () => {
    useDevBackend();
    const id = await idOf('Android Developer');
    render(JobDetail, { id });
    await fireEvent.click(await screen.findByRole('tab', { name: 'Notes' }));
    await fireEvent.input(await screen.findByRole('textbox', { name: 'Notes' }), { target: { value: 'Call on Monday' } });
    await fireEvent.click(screen.getByLabelText('Gig (short-term work)'));
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toasts.map((t) => t.text)).toContain('Saved'));
    const saved = await api.getJob(id);
    expect(saved.job).toMatchObject({ notes: 'Call on Monday', is_gig: true });
  });

  it('queues an AI evaluation of the match and shows its result', async () => {
    useDevBackend();
    const id = await idOf('Android Developer');
    render(JobDetail, { id });
    await fireEvent.click(await screen.findByRole('tab', { name: 'Match' }));
    expect(await screen.findByText(/describe your experience first/)).toBeInTheDocument();

    await api.updateSettings({ candidate_experience: 'Ten years of Kotlin' });
    await loadApp();
    const box = await screen.findByLabelText('Evaluate my match with AI');
    expect(box).not.toBeChecked();
    await fireEvent.click(box);
    await waitFor(() => expect(screen.getByLabelText('Evaluate my match with AI')).toBeChecked());
    expect(await screen.findByText(/Waiting for the AI/)).toBeInTheDocument();

    const task = (await api.getJob(id)).match!;
    expect(task).toMatchObject({ type: 'match_job', status: 'pending' });
    await fireEvent.click(screen.getByLabelText('Evaluate my match with AI'));
    await waitFor(() => expect(screen.getByLabelText('Evaluate my match with AI')).not.toBeChecked());
    expect((await api.getJob(id)).match).toBeUndefined();
  });

  it('lets the match be requested when the backend sends null for a missing task', async () => {
    useDevBackend();
    await api.updateSettings({ candidate_experience: 'Ten years of Kotlin' });
    await loadApp();
    const { default: MatchTab } = await import('./tabs/MatchTab.svelte');
    render(MatchTab, { jobId: 'j1', match: null });
    expect(await screen.findByLabelText('Evaluate my match with AI')).toBeEnabled();
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

describe('JobDetail availability', () => {
  it('checks the availability on demand and explains the result', async () => {
    useDevBackend();
    await loadApp();
    const id = await idOf('Android Developer');
    render(JobDetail, { id });
    await screen.findByRole('heading', { name: 'Android Developer' });
    await fireEvent.click(screen.getByRole('button', { name: 'Availability' }));
    await waitFor(() => expect(toasts.some((t) => /may be gone/.test(t.text))).toBe(true));
    expect(await screen.findByText(/suspected: page not found \(answer 404\)/)).toBeInTheDocument();
    expect(screen.getByText(/^Checked /)).toBeInTheDocument();
  });
});
