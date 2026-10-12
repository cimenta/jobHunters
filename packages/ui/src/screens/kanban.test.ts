import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { api } from '../api';
import { loadApp } from '../state/app.svelte';
import { toasts } from '../state/toast.svelte';
import { useDevBackend } from '../test/transport';
import ApplicationsList from './ApplicationsList.svelte';
import Settings from './Settings.svelte';

async function board(): Promise<void> {
  useDevBackend();
  await loadApp();
  render(ApplicationsList);
  await screen.findByLabelText('Kanban');
  await fireEvent.click(screen.getByLabelText('Kanban'));
  await screen.findByRole('group', { name: 'Applications by status' });
}

const column = (status: string): HTMLElement => document.querySelector(`[data-ui="kanban.${status}"]`)!;
const cardOf = (text: RegExp): HTMLElement => screen.getByText(text).closest('article')!;
const statusOf = async (text: string): Promise<string> => (await api.listApplications()).find((a) => a.label.includes(text))!.status;

describe('Kanban', () => {
  it('shows a column per status and remembers that it is on', async () => {
    await board();
    expect(['draft', 'sent', 'waiting', 'interview', 'offer', 'rejected', 'ghosted', 'withdrawn'].every((s) => column(s) !== null)).toBe(true);
    expect(within(column('sent')).getByText(/Android Developer – #1/)).toBeInTheDocument();
    await waitFor(async () => expect((await api.getSettings()).settings.ui_state.applications_kanban).toBe(true));
  });

  it('keeps the selection of statuses apart for the list and for the board', async () => {
    useDevBackend();
    await loadApp();
    render(ApplicationsList);
    await screen.findByLabelText('Kanban');
    await fireEvent.click(within(screen.getByRole('group', { name: 'Status' })).getByLabelText('Sent'));
    await waitFor(async () => expect((await api.getSettings()).settings.ui_state.applications_status_list).toEqual(['sent']));
    await fireEvent.click(screen.getByLabelText('Kanban'));
    await screen.findByRole('group', { name: 'Applications by status' });
    expect(document.querySelectorAll('[data-ui^="kanban."]:not([data-ui^="kanban.card"])').length).toBe(8);
    await fireEvent.click(within(screen.getByRole('group', { name: 'Status' })).getByLabelText('Waiting'));
    await waitFor(() => expect(document.querySelector('[data-ui="kanban.sent"]')).toBeNull());
    expect(column('waiting')).not.toBeNull();
    const saved = (await api.getSettings()).settings.ui_state;
    expect(saved).toMatchObject({ applications_status_list: ['sent'], applications_status_board: ['waiting'] });
    await fireEvent.click(screen.getByLabelText('Kanban'));
    expect(await screen.findByText(/Android Developer – #1/)).toBeInTheDocument();
  });

  it('changes the status when a card is dropped on an allowed column', async () => {
    await board();
    const card = cardOf(/Android Developer – #1/);
    await fireEvent.dragStart(card);
    await fireEvent.dragOver(column('interview'));
    await fireEvent.drop(column('interview'));
    await waitFor(async () => expect(await statusOf('Android Developer')).toBe('interview'));
    expect(toasts.some((t) => t.kind === 'success' && t.text === '"Example s.r.o. – Android Developer – #1 (2026-10)": moved from Sent to Interview')).toBe(true);
  });

  it('sends a card back with a message when the move is not allowed', async () => {
    await board();
    await fireEvent.dragStart(cardOf(/Android Developer – #1/));
    await fireEvent.drop(column('draft'));
    await waitFor(() => expect(toasts.some((t) => t.text === '"Example s.r.o. – Android Developer – #1 (2026-10)" cannot move from Sent to Draft.')).toBe(true));
    expect(await statusOf('Android Developer')).toBe('sent');
  });

  it('asks for a date before a card goes to Waiting', async () => {
    await board();
    await fireEvent.dragStart(cardOf(/Android Developer – #1/));
    await fireEvent.drop(column('waiting'));
    const dialog = await screen.findByRole('dialog', { name: 'Move to Waiting' });
    expect(await statusOf('Android Developer')).toBe('sent');
    await fireEvent.input(within(dialog).getByLabelText(/Remind/), { target: { value: '2099-01-01' } });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Change status' }));
    await waitFor(async () => expect(await statusOf('Android Developer')).toBe('waiting'));
  });

  it('moves a card from its menu', async () => {
    await board();
    const card = cardOf(/Android Developer – #1/);
    await fireEvent.change(within(card).getByLabelText('Move to…'), { target: { value: 'offer' } });
    await waitFor(async () => expect(await statusOf('Android Developer')).toBe('offer'));
  });

  it('hides columns without applications on request and remembers it', async () => {
    await board();
    const empty = ['offer', 'rejected', 'ghosted', 'withdrawn'].filter((s) => column(s)!.querySelectorAll('article').length === 0);
    expect(empty.length).toBeGreaterThan(0);
    await fireEvent.click(screen.getByLabelText('Hide empty columns'));
    for (const s of empty) expect(column(s)).toBeNull();
    expect(column('sent')).not.toBeNull();
    await waitFor(async () => expect((await api.getSettings()).settings.ui_state.applications_hide_empty).toBe(true));
    await fireEvent.click(screen.getByLabelText('Hide empty columns'));
    for (const s of empty) expect(column(s)).not.toBeNull();
  });

  it('says so when every column is hidden by the search', async () => {
    await board();
    await fireEvent.click(screen.getByLabelText('Hide empty columns'));
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'zzzz-no-match' } });
    expect(await screen.findByText('Every column is empty.')).toBeInTheDocument();
  });

  it('shows the checkbox only on the board', async () => {
    useDevBackend();
    await loadApp();
    render(ApplicationsList);
    await screen.findByLabelText('Kanban');
    expect(screen.queryByLabelText('Hide empty columns')).toBeNull();
  });
});

describe('Allowed status changes', () => {
  it('forbids a move for the whole app once it is unticked, and can be reset', async () => {
    useDevBackend();
    await loadApp();
    render(Settings);
    await fireEvent.click(await screen.findByRole('tab', { name: 'Allowed status changes' }));
    const matrix = (await screen.findByRole('heading', { name: 'Allowed status changes' })).closest('section')!;
    const cell = within(matrix).getByLabelText('Allow moving from Sent to Interview');
    expect(cell).toBeChecked();
    expect(within(matrix).getByLabelText('Allow moving from Sent to Sent')).toBeDisabled();
    await fireEvent.click(cell);
    await fireEvent.click(within(matrix).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getSettings()).settings.status_transitions.sent).not.toContain('interview'));
    const application = (await api.listApplications()).find((a) => a.label.includes('Android Developer'))!;
    await expect(api.setApplicationStatus(application.id, 'interview')).rejects.toBeDefined();
    await fireEvent.click(within(matrix).getByRole('button', { name: 'Reset to default' }));
    await fireEvent.click(within(matrix).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getSettings()).settings.status_transitions.sent).toContain('interview'));
  });

  it('warns about a status that can no longer be left', async () => {
    useDevBackend();
    await loadApp();
    render(Settings);
    await fireEvent.click(await screen.findByRole('tab', { name: 'Allowed status changes' }));
    const matrix = (await screen.findByRole('heading', { name: 'Allowed status changes' })).closest('section')!;
    for (const to of ['Waiting', 'Interview', 'Offer', 'Rejected', 'Ghosted', 'Withdrawn']) {
      await fireEvent.click(within(matrix).getByLabelText(`Allow moving from Sent to ${to}`));
    }
    expect(await within(matrix).findByText(/No move out of: Sent/)).toBeInTheDocument();
  });
});
