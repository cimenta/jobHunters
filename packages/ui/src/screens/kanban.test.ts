import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
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
    expect(document.querySelectorAll('[data-ui^="kanban."]:not([data-ui^="kanban.card"]):not([data-ui*=".sort"])').length).toBe(9);
    await fireEvent.click(within(screen.getByRole('group', { name: 'Status' })).getByLabelText('Waiting'));
    await waitFor(() => expect(document.querySelector('[data-ui="kanban.sent"]')).toBeNull());
    expect(column('waiting')).not.toBeNull();
    const saved = (await api.getSettings()).settings.ui_state;
    expect(saved).toMatchObject({ applications_status_list: ['sent'], applications_status_board: ['waiting'] });
    await fireEvent.click(screen.getByLabelText('Kanban'));
    expect(await screen.findByText(/Android Developer – #1/)).toBeInTheDocument();
  });

  it('has icons next to the Move to menu that put a card in Ghosted or Withdrawn with one click, only where the rules allow it', async () => {
    await board();
    const sent = cardOf(/Android Developer – #1/);
    const ids = (card: HTMLElement) => [...card.querySelectorAll('button[data-ui]')].map((el) => el.getAttribute('data-ui')!.split('.').pop());
    expect(ids(sent)).toEqual(expect.arrayContaining(['ghosted', 'withdrawn']));
    expect(sent.querySelector('select')).not.toBeNull();
    await fireEvent.click(sent.querySelector('button[data-ui$=".ghosted"]')!);
    await waitFor(async () => expect(await statusOf('Android Developer')).toBe('ghosted'));
    expect(toasts.map((t) => t.text).some((text) => text.includes('Ghosted'))).toBe(true);
    await waitFor(() => expect(within(column('ghosted')).getByText(/Android Developer – #1/)).toBeInTheDocument());
    const ghosted = cardOf(/Android Developer – #1/);
    expect(ids(ghosted)).not.toContain('ghosted');
    expect(ids(ghosted)).toContain('withdrawn');
    await fireEvent.click(ghosted.querySelector('button[data-ui$=".withdrawn"]')!);
    await waitFor(async () => expect(await statusOf('Android Developer')).toBe('withdrawn'));
    await waitFor(() => expect(within(column('withdrawn')).getByText(/Android Developer – #1/)).toBeInTheDocument());
    expect(ids(cardOf(/Android Developer – #1/))).toEqual([]);
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

describe('Applications clear filters button', () => {
  const button = (): HTMLElement | null => document.querySelector('[data-ui="applications.clear-filters"]');
  const statusGroup = () => within(screen.getByRole('group', { name: 'Status' }));

  async function list(): Promise<void> {
    useDevBackend();
    await loadApp();
    render(ApplicationsList);
    await screen.findByLabelText('Kanban');
  }

  it('is not shown while nothing is filtered', async () => {
    await list();
    expect(button()).toBeNull();
  });

  it('gives every filter control a data-ui hook', async () => {
    await list();
    await fireEvent.click(screen.getByLabelText('Kanban'));
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'zzzz' } });
    for (const id of ['search', 'kanban', 'hide-empty', 'status', 'clear-filters']) {
      expect(document.querySelector(`[data-ui="applications.${id}"]`), id).not.toBeNull();
    }
  });

  it('looks like a button (secondary style, not ghost)', async () => {
    await list();
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'zzzz' } });
    expect(button()!.classList.contains('secondary')).toBe(true);
    expect(button()!.classList.contains('ghost')).toBe(false);
  });

  it('appears with a search text, clears it and focuses the search', async () => {
    await list();
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'zzzz' } });
    expect(button()).not.toBeNull();
    expect(button()).toHaveTextContent('Clear filters');
    await fireEvent.click(button()!);
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('');
    expect(button()).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('searchbox'));
  });

  it('appears with a status selection alone and clears it, also in the saved state', async () => {
    await list();
    await fireEvent.click(statusGroup().getByLabelText('Sent'));
    expect(button()).not.toBeNull();
    await waitFor(async () => expect((await api.getSettings()).settings.ui_state.applications_status_list).toEqual(['sent']));
    await fireEvent.click(button()!);
    expect(button()).toBeNull();
    expect(statusGroup().getByLabelText('Sent')).not.toBeChecked();
    await waitFor(async () => expect((await api.getSettings()).settings.ui_state.applications_status_list).toEqual([]));
  });

  it('clears both the search and the statuses at once', async () => {
    await list();
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'android' } });
    await fireEvent.click(statusGroup().getByLabelText('Sent'));
    await fireEvent.click(button()!);
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('');
    expect(statusGroup().getByLabelText('Sent')).not.toBeChecked();
    expect(button()).toBeNull();
  });

  it('on the board clears the board selection, keeps Kanban on and leaves hide-empty and the list selection alone', async () => {
    await list();
    await fireEvent.click(statusGroup().getByLabelText('Sent'));
    await waitFor(async () => expect((await api.getSettings()).settings.ui_state.applications_status_list).toEqual(['sent']));
    await fireEvent.click(screen.getByLabelText('Kanban'));
    await screen.findByRole('group', { name: 'Applications by status' });
    expect(button()).toBeNull();
    await fireEvent.click(screen.getByLabelText('Hide empty columns'));
    await fireEvent.click(statusGroup().getByLabelText('Waiting'));
    expect(button()).not.toBeNull();
    await fireEvent.click(button()!);
    expect(button()).toBeNull();
    expect(screen.getByLabelText('Kanban')).toBeChecked();
    expect(screen.getByLabelText('Hide empty columns')).toBeChecked();
    expect(screen.getByRole('group', { name: 'Applications by status' })).toBeInTheDocument();
    await waitFor(async () => {
      const state = (await api.getSettings()).settings.ui_state;
      expect(state.applications_status_board).toEqual([]);
      expect(state.applications_status_list).toEqual(['sent']);
      expect(state.applications_kanban).toBe(true);
      expect(state.applications_hide_empty).toBe(true);
    });
  });
});

describe('Allowed status changes', () => {
  it('forbids a move for the whole app once it is unticked, and can be reset', async () => {
    useDevBackend();
    await loadApp();
    render(Settings);
    await fireEvent.click(await screen.findByRole('tab', { name: 'Statuses' }));
    await fireEvent.click(await screen.findByRole('tab', { name: 'Application statuses' }));
    await fireEvent.click(await screen.findByRole('tab', { name: 'Allowed changes' }));
    const matrix = (await screen.findByRole('heading', { name: 'Allowed status changes of applications' })).closest('section')!;
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
    await fireEvent.click(await screen.findByRole('tab', { name: 'Statuses' }));
    await fireEvent.click(await screen.findByRole('tab', { name: 'Application statuses' }));
    await fireEvent.click(await screen.findByRole('tab', { name: 'Allowed changes' }));
    const matrix = (await screen.findByRole('heading', { name: 'Allowed status changes of applications' })).closest('section')!;
    for (const to of ['Waiting', 'Interview', 'Homework', 'Offer', 'Rejected', 'Ghosted', 'Withdrawn']) {
      await fireEvent.click(within(matrix).getByLabelText(`Allow moving from Sent to ${to}`));
    }
    expect(await within(matrix).findByText(/No move out of: Sent/)).toBeInTheDocument();
  });
});

describe('List sort', () => {
  async function list(): Promise<void> {
    useDevBackend();
    await loadApp();
    render(ApplicationsList);
    await screen.findByLabelText('Sort by');
  }

  it('offers all sort options, keeps the default order and remembers a choice', async () => {
    await list();
    const select = screen.getByLabelText('Sort by') as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(['default', 'match', 'created', 'salary', 'sent', 'waiting']);
    expect(select.value).toBe('default');
    expect(select.title).toMatch(/^Default order is the order of the list as it was/);
    expect((document.querySelector('[data-ui="applications.sort-dir"]') as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.change(select, { target: { value: 'match' } });
    await waitFor(async () => expect((await api.getSettings()).settings.ui_state.applications_list_sort).toEqual({ by: 'match', up: false }));
    await fireEvent.click(document.querySelector('[data-ui="applications.sort-dir"]')!);
    await waitFor(async () => expect((await api.getSettings()).settings.ui_state.applications_list_sort).toEqual({ by: 'match', up: true }));
  });

  it('shows the match and the salary on every row and orders the rows by the chosen field', async () => {
    await list();
    expect(document.querySelectorAll('[data-ui^="application."][data-ui$=".match"]').length).toBeGreaterThan(0);
    await fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'match' } });
    const matches = [...document.querySelectorAll('[data-ui^="application."][data-ui$=".match"]')].map((el) => Number(/(\d+) %/.exec(el.textContent ?? '')?.[1] ?? -1));
    const sorted = [...matches].sort((a, b) => (a === -1 ? 1 : b === -1 ? -1 : b - a));
    expect(matches).toEqual(sorted);
  });

  it('keeps the board choices apart from the list choice', async () => {
    await list();
    await fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'salary' } });
    await fireEvent.click(screen.getByLabelText('Kanban'));
    await screen.findByRole('group', { name: 'Applications by status' });
    await fireEvent.change(document.querySelector('[data-ui="kanban.draft.sort"]')!, { target: { value: 'created' } });
    await waitFor(async () => {
      const saved = (await api.getSettings()).settings.ui_state;
      expect(saved.applications_list_sort).toEqual({ by: 'salary', up: false });
      expect(saved.applications_board_sort).toEqual({ draft: { by: 'created', up: false } });
    });
  });
});

describe('Kanban Homework column', () => {
  it('has a column between Interview and Offer and asks for the deadline when a card is moved there', async () => {
    await board();
    const order = [...document.querySelectorAll('[data-ui^="kanban."]')].map((el) => el.getAttribute('data-ui')!).filter((id) => /^kanban\.[a-z]+$/.test(id));
    expect(order.indexOf('kanban.homework')).toBe(order.indexOf('kanban.interview') + 1);
    expect(order.indexOf('kanban.offer')).toBe(order.indexOf('kanban.homework') + 1);
    const target = (await api.listApplications()).find((a) => a.label.includes('Android Developer – #1'))!;
    await fireEvent.change(document.querySelector(`[data-ui="kanban.card.${target.id}.move"]`)!, { target: { value: 'homework' } });
    const date = await screen.findByLabelText('Homework due');
    await fireEvent.input(date, { target: { value: '2099-02-02' } });
    await fireEvent.click(document.querySelector('[data-ui="kanban.waiting.confirm"]')!);
    await waitFor(async () => expect(await statusOf('Android Developer – #1')).toBe('homework'));
  });
});

describe('Kanban Rejected icon', () => {
  const icon = (id: string): HTMLElement | null => document.querySelector(`[data-ui="kanban.card.${id}.rejected"]`);
  const field = (name: string): HTMLElement => document.querySelector(`[data-ui="kanban.reject.${name}"]`)!;

  it('is hidden until the setting is on, and the setting is saved from Settings', async () => {
    await board();
    const target = (await api.listApplications()).find((a) => a.label.includes('Android Developer – #1'))!;
    expect(icon(target.id)).toBeNull();
    cleanup();
    render(Settings);
    await screen.findByRole('heading', { name: 'Settings' });
    await fireEvent.click(document.querySelector('[data-ui="settings.kanban.reject-icon"]')!);
    await fireEvent.click(document.querySelector('[data-ui="settings.kanban.save"]')!);
    await waitFor(async () => expect((await api.getSettings()).settings.ui_state.kanban_reject_icon).toBe(true));
  });

  it('records the rejection: a message in the communication, the status Rejected and the archived job', async () => {
    useDevBackend();
    await api.updateSettings({ ui_state: JSON.stringify({ applications_kanban: true, kanban_reject_icon: true }) });
    await loadApp();
    render(ApplicationsList);
    await screen.findByRole('group', { name: 'Applications by status' });
    const target = (await api.listApplications()).find((a) => a.label.includes('Android Developer – #1'))!;
    expect(target.status).toBe('sent');
    await fireEvent.click(icon(target.id)!);
    await fireEvent.change(field('channel'), { target: { value: 'phone' } });
    await fireEvent.input(field('note'), { target: { value: 'Chose another candidate' } });
    await fireEvent.click(field('confirm'));
    await waitFor(async () => expect(await statusOf('Android Developer – #1')).toBe('rejected'));
    const entries = (await api.getApplication(target.id)).communications;
    expect(entries).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'message', direction: 'incoming', channel: 'phone', details: 'Chose another candidate' })]));
    expect((await api.getJob(target.job_id)).job.status).toBe('archived');
  });

  it('is not offered on a card that cannot move to Rejected', async () => {
    useDevBackend();
    await api.updateSettings({ ui_state: JSON.stringify({ applications_kanban: true, kanban_reject_icon: true }) });
    const rows = await api.listApplications();
    const withdrawn = rows.find((a) => a.status === 'sent')!;
    await api.setApplicationStatus(withdrawn.id, 'withdrawn');
    const other = rows.find((a) => ['waiting', 'interview', 'offer'].includes(a.status))!;
    await loadApp();
    render(ApplicationsList);
    await screen.findByRole('group', { name: 'Applications by status' });
    expect(icon(withdrawn.id)).toBeNull();
    expect(icon(other.id)).not.toBeNull();
  });
});
