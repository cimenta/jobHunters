import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { loadApp } from '../state/app.svelte';
import { toasts } from '../state/toast.svelte';
import { useDevBackend } from '../test/transport';
import JobsList from './JobsList.svelte';

// Invented data only (the dev backend).

/** The two sample ads that have an application are put back to New, so every test starts with them in the first column. */
async function fresh(): Promise<void> {
  useDevBackend();
  await loadApp();
  for (const job of await api.listJobs()) {
    if (job.title === 'Android Developer' || job.title === 'Data Analyst (part time)') await api.updateJob(job.id, { status: 'new' });
  }
}

async function board(): Promise<void> {
  await fresh();
  render(JobsList);
  await screen.findByText('Android Developer');
  await fireEvent.click(document.querySelector('[data-ui="jobs.kanban"]')!);
  await screen.findByRole('group', { name: 'Ads by status' });
}

const column = (status: string): HTMLElement => document.querySelector(`[data-ui="jobs.board.col.${status}"]`)!;
const cardOf = (text: string): HTMLElement => screen.getByText(text).closest('article')!;
const statusOf = async (title: string): Promise<string> => (await api.listJobs()).find((job) => job.title === title)!.status;

describe('Kanban board of ads', () => {
  it('shows New, Next, In progress and Done by default, with the ads in the column of their status, and remembers that it is on', async () => {
    await board();
    expect(['new', 'next', 'in_progress', 'done'].every((status) => column(status) !== null)).toBe(true);
    expect(column('applied')).toBeNull();
    expect(within(column('new')).getByText('Android Developer')).toBeInTheDocument();
    await waitFor(async () => expect((await api.getSettings()).settings.ui_state.jobs_kanban).toBe(true));
    expect(document.querySelector('[data-ui="jobs.kanban"]')!.getAttribute('aria-pressed')).toBe('true');
    const bar = document.querySelector('[data-ui="jobs.kanban"]')!.parentElement!;
    const order = [...bar.children].map((el) => el.getAttribute('data-ui'));
    expect(order.indexOf('jobs.kanban')).toBeLessThan(order.indexOf('jobs.add'));
  });

  it('shows the title, the company, the pay and the contact person on a card', async () => {
    await fresh();
    const job = (await api.listJobs()).find((item) => item.title === 'Android Developer')!;
    await api.updateJob(job.id, { contact_person: 'Jana Nováková, recruiter', salary_min: '50000', salary_max: '60000', salary_currency: 'CZK', salary_period: 'month' });
    render(JobsList);
    await screen.findByText('Android Developer');
    await fireEvent.click(document.querySelector('[data-ui="jobs.kanban"]')!);
    await screen.findByRole('group', { name: 'Ads by status' });
    const card = cardOf('Android Developer');
    expect(card.querySelector(`[data-ui="jobs.board.card.${job.id}.company"]`)?.textContent).not.toBe('');
    expect(card.querySelector(`[data-ui="jobs.board.card.${job.id}.pay"]`)?.textContent).toContain('50');
    expect(card.querySelector(`[data-ui="jobs.board.card.${job.id}.contact"]`)?.textContent).toBe('Jana Nováková, recruiter');
  });

  it('moves a card to another column with the Move to menu and says so', async () => {
    await board();
    const select = cardOf('Android Developer').querySelector('select')!;
    await fireEvent.change(select, { target: { value: 'next' } });
    await waitFor(async () => expect(await statusOf('Android Developer')).toBe('next'));
    await waitFor(() => expect(within(column('next')).getByText('Android Developer')).toBeInTheDocument());
    expect(toasts.map((t) => t.text).some((text) => text.includes('Android Developer') && text.includes('Next'))).toBe(true);
  });

  it('remembers the order of the cards inside a column', async () => {
    await fresh();
    const jobs = await api.listJobs();
    const [first, second] = [jobs.find((job) => job.title === 'Android Developer')!, jobs.find((job) => job.title === 'Data Analyst (part time)')!];
    await api.moveJob(first.id, 'next', 0);
    await api.moveJob(second.id, 'next', 1);
    await api.moveJob(second.id, 'next', 0);
    render(JobsList);
    await screen.findByText('Android Developer');
    await fireEvent.click(document.querySelector('[data-ui="jobs.kanban"]')!);
    await screen.findByRole('group', { name: 'Ads by status' });
    const titles = [...column('next').querySelectorAll('article a.title')].map((a) => a.textContent);
    expect(titles).toEqual(['Data Analyst (part time)', 'Android Developer']);
    cleanup();
    render(JobsList);
    await screen.findByRole('group', { name: 'Ads by status' });
    expect([...column('next').querySelectorAll('article a.title')].map((a) => a.textContent)).toEqual(['Data Analyst (part time)', 'Android Developer']);
  });

  it('lets the user choose the columns and remembers the choice apart from the list', async () => {
    await board();
    await fireEvent.click(within(screen.getByRole('group', { name: 'Status' })).getByLabelText('Archived'));
    await waitFor(() => expect(column('archived')).not.toBeNull());
    const saved = (await api.getSettings()).settings.ui_state;
    expect(saved.jobs_status_board).toContain('archived');
    await fireEvent.click(document.querySelector('[data-ui="jobs.kanban"]')!);
    await waitFor(() => expect(document.querySelector('[data-ui="jobs.board"]')).toBeNull());
    expect(await screen.findByText('Android Developer')).toBeInTheDocument();
  });

  it('respects the gig switch', async () => {
    await board();
    await fireEvent.click(document.querySelector('[data-ui="jobs.gig.except"]')!);
    await waitFor(() => expect(screen.queryByText('Data Analyst (part time)')).toBeNull());
    expect(within(column('new')).getByText('Android Developer')).toBeInTheDocument();
  });

  describe('while a move is being saved', () => {
    const slow = () => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const real = api.moveJob;
      const spy = vi.spyOn(api, 'moveJob').mockImplementation(async (...args) => {
        await gate;
        return real(...args);
      });
      return { release, spy };
    };

    it('shows the card at once in the target column with a note of where it goes, then settles', async () => {
      await board();
      const { release, spy } = slow();
      try {
        const select = cardOf('Android Developer').querySelector('select')!;
        await fireEvent.change(select, { target: { value: 'next' } });
        const moving = await within(column('next')).findByRole('status');
        expect(moving.textContent).toBe('Moving: New → Next, place 1…');
        expect(within(column('next')).getByText('Android Developer').closest('article')!.getAttribute('aria-busy')).toBe('true');
        expect(within(column('new')).queryByText('Android Developer')).toBeNull();
        expect(column('next').querySelector('[data-ui="jobs.board.col.next.receiving"]')?.textContent).toBe('A card is moving here…');
        expect(cardOf('Android Developer').querySelector('select')).toBeNull();
        release();
        await waitFor(() => expect(column('next').querySelector('[role="status"]')).toBeNull());
        expect(within(column('next')).getByText('Android Developer')).toBeInTheDocument();
        expect(column('next').querySelector('[data-ui="jobs.board.col.next.receiving"]')).toBeNull();
      } finally {
        spy.mockRestore();
      }
    });

    it('puts the card back and says so when the save fails', async () => {
      await board();
      const spy = vi.spyOn(api, 'moveJob').mockRejectedValue(new Error('no luck'));
      try {
        await fireEvent.change(cardOf('Android Developer').querySelector('select')!, { target: { value: 'done' } });
        await waitFor(() => expect(toasts.map((t) => t.text).some((text) => text.includes('stays in New'))).toBe(true));
        expect(within(column('new')).getByText('Android Developer')).toBeInTheDocument();
        expect(column('done').querySelector('[role="status"]')).toBeNull();
      } finally {
        spy.mockRestore();
      }
    });
  });
});
