<script lang="ts">
  import { canTransition, isApplicationStatus, sortBoard, type ApplicationStatus, type StatusTransitions } from '@jobhunters/core';
  import { api } from '../api';
  import type { ApplicationRow } from '../api/types';
  import Button from '../components/Button.svelte';
  import Dialog from '../components/Dialog.svelte';
  import Field from '../components/Field.svelte';
  import StatusBadge from '../components/StatusBadge.svelte';
  import { formatDate, todayLocal } from '../lib/format';
  import { tr } from '../lib/i18n.svelte';
  import { notifyError } from '../lib/notify';
  import { paths } from '../lib/route';
  import { statusStyle } from '../lib/status';
  import { toast } from '../state/toast.svelte';

  interface Props {
    rows: ApplicationRow[];
    /** The columns shown, in order. */
    statuses: ApplicationStatus[];
    /** Whether columns without cards are left out. */
    hideEmpty: boolean;
    transitions: StatusTransitions;
    onmoved: () => void;
  }
  let { rows, statuses, hideEmpty, transitions, onmoved }: Props = $props();

  let dragging = $state<ApplicationRow>();
  let over = $state<string>();
  let pending = $state<{ card: ApplicationRow; index: number }>();
  let remindAt = $state('');
  const today = todayLocal();

  const columns = $derived(statuses.map((status) => ({ status, cards: sortBoard(rows.filter((row) => row.status === status)) })));
  const shown = $derived(hideEmpty ? columns.filter((column) => column.cards.length > 0) : columns);

  /** Whether a card may be put into the column: the same column (a reorder) or a move the rules allow. */
  function allows(card: ApplicationRow, to: ApplicationStatus): boolean {
    return card.status === to || (isApplicationStatus(card.status) && canTransition(card.status, to, transitions));
  }

  const targets = (card: ApplicationRow): ApplicationStatus[] => (isApplicationStatus(card.status) ? statuses.filter((to) => to !== card.status && allows(card, to)) : []);

  async function run(card: ApplicationRow, to: ApplicationStatus, action: () => Promise<unknown>, remindOn = ''): Promise<void> {
    const reorder = card.status === to;
    try {
      await action();
      const label = card.label;
      if (reorder) toast.success(tr('ui.kanban.reordered', { label, status: statusStyle(to).text }));
      else toast.success(tr(remindOn === '' ? 'ui.kanban.moved' : 'ui.kanban.movedRemind', { label, from: statusStyle(card.status).text, to: statusStyle(to).text, date: formatDate(remindOn) }));
      onmoved();
    } catch (error) {
      notifyError(error);
    }
  }

  async function place(card: ApplicationRow, to: ApplicationStatus, index: number): Promise<void> {
    if (!allows(card, to)) {
      toast.warning(tr('ui.kanban.notAllowed', { label: card.label, from: statusStyle(card.status).text, to: statusStyle(to).text }));
      return;
    }
    if (to === 'waiting' && card.status !== 'waiting') {
      remindAt = '';
      pending = { card, index };
      return;
    }
    await run(card, to, () => api.moveApplication(card.id, to, index));
  }

  async function confirmWaiting(): Promise<void> {
    const current = pending;
    if (!current) return;
    pending = undefined;
    await run(current.card, 'waiting', () => api.moveApplication(current.card.id, 'waiting', current.index, remindAt), remindAt);
  }

  /** Place among the other cards of the column: before the card dropped on, or after it in its lower half. */
  function indexAt(cards: ApplicationRow[], card: ApplicationRow, targetId: string | undefined, after: boolean): number {
    const others = cards.filter((other) => other.id !== card.id);
    if (targetId === undefined) return others.length;
    const at = others.findIndex((other) => other.id === targetId);
    return at < 0 ? others.length : at + (after ? 1 : 0);
  }

  function dropOn(event: DragEvent, status: ApplicationStatus, cards: ApplicationRow[], targetId?: string): void {
    event.preventDefault();
    event.stopPropagation();
    const card = dragging;
    dragging = undefined;
    over = undefined;
    if (!card) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const after = targetId !== undefined && rect.height > 0 && event.clientY > rect.top + rect.height / 2;
    void place(card, status, indexAt(cards, card, targetId, after));
  }
</script>

<div class="board" data-ui="kanban" role="group" aria-label={tr('ui.kanban.board')}>
  {#each shown as column (column.status)}
    <section
      class="column"
      class:allowed={dragging !== undefined && allows(dragging, column.status)}
      class:blocked={dragging !== undefined && !allows(dragging, column.status)}
      class:over={over === column.status}
      data-ui="kanban.{column.status}"
      aria-label={statusStyle(column.status).text}
      ondragover={(event) => {
        if (dragging && allows(dragging, column.status)) event.preventDefault();
        over = column.status;
      }}
      ondrop={(event) => dropOn(event, column.status, column.cards)}
    >
      <header class="head">
        <StatusBadge status={column.status} />
        <span class="muted small">{column.cards.length}</span>
      </header>
      {#each column.cards as card (card.id)}
        <article
          class="card"
          class:dragging={dragging?.id === card.id}
          draggable="true"
          data-ui="kanban.card.{card.id}"
          ondragstart={(event) => {
            dragging = card;
            event.dataTransfer?.setData('text/plain', card.id);
          }}
          ondragend={() => {
            dragging = undefined;
            over = undefined;
          }}
          ondragover={(event) => {
            if (dragging && allows(dragging, column.status)) event.preventDefault();
          }}
          ondrop={(event) => dropOn(event, column.status, column.cards, card.id)}
        >
          <a data-ui="kanban.card.{card.id}.link" class="title" draggable="false" href={paths.application(card.id)}>{card.label}</a>
          <span class="muted small">{[card.job_title, card.company_name].filter((part) => part !== '').join(' · ')}</span>
          {#if card.last_activity_at !== ''}<span class="muted small">{formatDate(card.last_activity_at)}</span>{/if}
          {#if targets(card).length > 0}
            <select data-ui="kanban.card.{card.id}.move"
              class="input move"
              aria-label={tr('ui.kanban.moveTo')}
              value=""
              onchange={(event) => {
                const to = event.currentTarget.value as ApplicationStatus;
                event.currentTarget.value = '';
                if (to !== ('' as string)) void place(card, to, 0);
              }}
            >
              <option value="">{tr('ui.kanban.moveTo')}</option>
              {#each targets(card) as to (to)}<option value={to}>{statusStyle(to).text}</option>{/each}
            </select>
          {/if}
        </article>
      {:else}
        <p class="muted small empty">{tr('ui.kanban.empty')}</p>
      {/each}
    </section>
  {/each}
</div>
{#if shown.length === 0}<p class="muted" data-ui="kanban.all-hidden">{tr('ui.kanban.allHidden')}</p>{/if}

<Dialog open={pending !== undefined} title={tr('ui.kanban.waitingTitle')} onclose={() => (pending = undefined)} ui="kanban.waiting">
  <Field label={tr('ui.app.remindOn')} for="kanban-remind">
    <input data-ui="kanban.remind-date" id="kanban-remind" class="input" type="date" min={today} bind:value={remindAt} />
  </Field>
  {#snippet footer()}
    <Button variant="primary" ui="kanban.waiting.confirm" disabled={remindAt === '' || remindAt < today} onclick={confirmWaiting}>{tr('ui.app.changeStatus')}</Button>
  {/snippet}
</Dialog>

<style>
  .board { display: flex; gap: var(--space-3); overflow-x: auto; align-items: flex-start; padding-bottom: var(--space-2); }
  .column { flex: 0 0 260px; display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-2); min-height: 120px; background: var(--surface-2); border: 2px solid transparent; border-radius: var(--radius-m); }
  .column.allowed { border-color: var(--accent); }
  .column.blocked { opacity: 0.45; }
  .column.over.allowed { background: var(--accent-soft); }
  .head { display: flex; align-items: center; justify-content: space-between; }
  .card { display: flex; flex-direction: column; gap: var(--space-1); padding: var(--space-3); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-m); cursor: grab; }
  .card.dragging { opacity: 0.4; }
  .title { font-weight: 600; }
  .move { margin-top: var(--space-1); }
  .empty { margin: 0; padding: var(--space-2); }
</style>
