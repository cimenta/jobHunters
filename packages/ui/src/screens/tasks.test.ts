import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { api } from '../api';
import { loadApp } from '../state/app.svelte';
import { toasts } from '../state/toast.svelte';
import { useDevBackend } from '../test/transport';
import TasksScreen from './TasksScreen.svelte';

describe('TasksScreen', () => {
  it('lists the tasks in a table and shows the details of one in a dialog', async () => {
    useDevBackend();
    await api.updateSettings({ candidate_experience: 'Ten years of Kotlin' });
    await loadApp();
    const jobId = (await api.listJobs())[0]!.id;
    await api.requestJobMatch(jobId);
    render(TasksScreen);
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent?.trim())).toEqual(['Created', 'Type', 'Company', 'Job', 'Status', 'Processed', 'Detail']);
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText('Match evaluation')).toBeInTheDocument();

    await fireEvent.click(within(table).getByRole('button', { name: 'Detail' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Evaluate whether the candidate/)).toBeInTheDocument();
    expect(within(dialog).getByText('No result yet.')).toBeInTheDocument();

    await fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.queryByRole('table')).toBeNull());
    expect(await api.listAiTasks()).toEqual([]);
  });

  async function awaitingJob() {
    await api.importJob('https://blocked.example/job/1');
    return (await api.listJobs()).find((job) => job.status === 'awaiting')!;
  }

  it('asks before removing an import task and deletes the awaiting job with it', async () => {
    useDevBackend();
    const job = await awaitingJob();
    render(TasksScreen);
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Job import')).toBeInTheDocument();
    await fireEvent.click(within(table).getByRole('button', { name: 'Detail' }));
    const dialog = await screen.findByRole('dialog', { name: 'Job import' });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    const confirm = await screen.findByRole('dialog', { name: 'Are you sure?' });
    expect(within(confirm).getByText(/will be deleted too/)).toBeInTheDocument();
    expect(await api.listAiTasks()).toHaveLength(1);
    await fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect(await api.listAiTasks()).toEqual([]));
    expect((await api.listJobs()).some((j) => j.id === job.id)).toBe(false);
    expect(toasts.some((t) => t.text.includes('AI task removed') && t.text.includes(job.title))).toBe(true);
  });

  it('keeps a job that was already filled in when its import task is removed', async () => {
    useDevBackend();
    const job = await awaitingJob();
    await api.updateJob(job.id, { status: 'new' });
    render(TasksScreen);
    await fireEvent.click(await screen.findByRole('button', { name: 'Detail' }));
    const dialog = await screen.findByRole('dialog', { name: 'Job import' });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(async () => expect(await api.listAiTasks()).toEqual([]));
    expect(screen.queryByRole('dialog', { name: 'Are you sure?' })).toBeNull();
    expect((await api.listJobs()).some((j) => j.id === job.id)).toBe(true);
  });
});
