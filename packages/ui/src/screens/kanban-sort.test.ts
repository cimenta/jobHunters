import type { ApplicationRow } from '@jobhunters/core';
import { DEFAULT_TRANSITIONS } from '@jobhunters/core';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import KanbanBoard from './KanbanBoard.svelte';

const row = (id: string, over: Partial<ApplicationRow> = {}): ApplicationRow => ({
  id, job_id: `j${id}`, attempt: 1, label: `Card ${id}`, language: 'en', status: 'draft', applied_at: '', last_activity_at: '2026-10-01T00:00:00.000Z', snapshot_used: '', folder_url: '', notes: '',
  board_position: null, job_title: 'Job', company_name: 'Co', location: '', is_remote: false, is_hybrid: false, match_percent: null, salary_min: null, salary_max: null, salary_currency: 'CZK', salary_period: 'month', created_at: '', waiting_since: '', ...over,
});
const ROWS = [
  row('1', { board_position: 1, match_percent: 40, salary_max: 50000, created_at: '2026-10-01T10:00:00.000Z' }),
  row('2', { board_position: 2, match_percent: 90, salary_max: 90000, created_at: '2026-10-05T10:00:00.000Z' }),
  row('3', { board_position: 3 }),
];
const titles = (status: string): string[] => [...document.querySelectorAll(`[data-ui="kanban.${status}"] article .title`)].map((el) => el.textContent ?? '');

function mount(sorts = {}, onsort = vi.fn(), onmoved = vi.fn()) {
  render(KanbanBoard, { rows: ROWS, statuses: ['draft', 'sent'], hideEmpty: false, transitions: DEFAULT_TRANSITIONS, sorts, onsort, onmoved });
  return { onsort, onmoved };
}

describe('Kanban sort per column', () => {
  it('keeps the manual order by default and offers the options of the status', () => {
    mount();
    expect(titles('draft')).toEqual(['Card 1', 'Card 2', 'Card 3']);
    const select = document.querySelector('[data-ui="kanban.draft.sort"]') as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(['manual', 'match', 'created', 'salary']);
    const sent = document.querySelector('[data-ui="kanban.sent.sort"]') as HTMLSelectElement;
    expect([...sent.options].map((o) => o.value)).toEqual(['manual', 'match', 'created', 'salary', 'sent']);
    expect((document.querySelector('[data-ui="kanban.draft.sort-dir"]') as HTMLButtonElement).disabled).toBe(true);
    expect(select.title).toMatch(/^Manual: the order you set by dragging/);
    expect((document.querySelector('[data-ui="kanban.draft.sort-dir"]') as HTMLButtonElement).title).toBe('Reverse the order');
    expect(document.querySelector('[data-ui="kanban.draft.sort-hint"]')).toBeNull();
  });

  it('reports a choice and a reversal', async () => {
    const { onsort } = mount();
    await fireEvent.change(document.querySelector('[data-ui="kanban.draft.sort"]')!, { target: { value: 'match' } });
    expect(onsort).toHaveBeenCalledWith('draft', { by: 'match', up: false });
  });

  it('orders a sorted column by the field, puts cards without a value last and shows the hint', () => {
    mount({ draft: { by: 'match', up: false } });
    expect(titles('draft')).toEqual(['Card 2', 'Card 1', 'Card 3']);
    expect((document.querySelector('[data-ui="kanban.draft.sort"]') as HTMLSelectElement).title).toBe('Ordered by the field. Dragging inside this column is off; choose Manual to get your own order back.');
    expect(document.querySelector('[data-ui="kanban.draft.sort-hint"]')).toBeNull();
    expect((document.querySelector('[data-ui="kanban.draft.sort-dir"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('reverses the order with the arrow button', async () => {
    const { onsort } = mount({ draft: { by: 'match', up: false } });
    await fireEvent.click(document.querySelector('[data-ui="kanban.draft.sort-dir"]')!);
    expect(onsort).toHaveBeenCalledWith('draft', { by: 'match', up: true });
  });

  it('shows the match and the salary on every card, and the sorted date as an extra line', () => {
    mount({ draft: { by: 'created', up: false } });
    const card = document.querySelector('[data-ui="kanban.card.2"]') as HTMLElement;
    expect(within(card).getByText('Match 90 %')).toBeInTheDocument();
    expect(within(card).getByText(/90,000/)).toBeInTheDocument();
    expect(within(card).getByText(/^Created /)).toBeInTheDocument();
    const empty = document.querySelector('[data-ui="kanban.card.3"]') as HTMLElement;
    expect(within(empty).getByText('No match yet')).toBeInTheDocument();
    expect(within(empty).getByText('No salary')).toBeInTheDocument();
    expect(within(empty).queryByText(/^Created /)).toBeNull();
  });

  it('does nothing when a card is dropped inside a column that is sorted by a field', async () => {
    const move = vi.spyOn(api, 'moveApplication').mockResolvedValue(undefined as never);
    const { onmoved } = mount({ draft: { by: 'match', up: false } });
    const card = document.querySelector('[data-ui="kanban.card.1"]') as HTMLElement;
    await fireEvent.dragStart(card);
    await fireEvent.drop(document.querySelector('[data-ui="kanban.card.2"]')!);
    expect(move).not.toHaveBeenCalled();
    expect(onmoved).not.toHaveBeenCalled();
    expect(screen.queryByText(/cannot move/)).toBeNull();
    move.mockRestore();
  });
});
