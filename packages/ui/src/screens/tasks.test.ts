import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { api } from '../api';
import { loadApp } from '../state/app.svelte';
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
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent?.trim())).toEqual(['Created', 'Type', 'Job', 'Status', 'Processed', 'Detail']);
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
});
