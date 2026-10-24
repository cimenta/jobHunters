<script lang="ts">
  import { canTransition, isApplicationStatus, isDatedStatus, sortApplications, sortBoard, sortKeysFor, type ApplicationSortKey, type ApplicationStatus, type SortChoice, type StatusTransitions } from '@jobhunters/core';
  import { api } from '../api';
  import type { ApplicationRow } from '../api/types';
  import ApplicationFacts from '../components/ApplicationFacts.svelte';
  import Button from '../components/Button.svelte';
  import Dialog from '../components/Dialog.svelte';
  import Field from '../components/Field.svelte';
  import Icon from '../components/Icon.svelte';
  import StatusBadge from '../components/StatusBadge.svelte';
  import { formatDate, todayLocal } from '../lib/format';
  import { channelLabel } from '../lib/labels';
  import { tr } from '../lib/i18n.svelte';
  import { sortLabel } from '../lib/labels';
  import { notifyError } from '../lib/notify';
  import { paths } from '../lib/route';
  import { statusStyle } from '../lib/status';
  import { toast } from '../state/toast.svelte';
  import { uiState } from '../state/ui-state';

  interface Props {
    rows: ApplicationRow[];
    /** The columns shown, in order. */
    statuses: ApplicationStatus[];
    /** Whether columns without cards are left out. */
    hideEmpty: boolean;
    transitions: StatusTransitions;
    /** How each column is ordered; a status without an entry is ordered by hand. */
    sorts: Record<string, SortChoice>;
    onsort: (status: ApplicationStatus, choice: SortChoice) => void;
    onmoved: () => void;
  }
  let { rows, statuses, hideEmpty, transitions, sorts, onsort, onmoved }: Props = $props();

  let dragging = $state<ApplicationRow>();
  let over = $state<string>();
  let pending = $state<{ card: ApplicationRow; index: number; to: ApplicationStatus }>();
  let remindAt = $state('');
  const today = todayLocal();

  const now = Date.now();
  const choiceOf = (status: string): SortChoice => sorts[status] ?? { by: 'manual', up: false };

  const columns = $derived(
    statuses.map((status) => {
      const choice = choiceOf(status);
      const own = rows.filter((row) => row.status === status);
      return { status, choice, cards: choice.by === 'manual' ? sortBoard(own) : sortApplications(own, choice.by, choice.up) };
    }),
  );
  const shown = $derived(hideEmpty ? columns.filter((column) => column.cards.length > 0) : columns);

  /** Whether a card may be put into the column: the same column (a reorder) or a move the rules allow. */
  function allows(card: ApplicationRow, to: ApplicationStatus): boolean {
    return card.status === to || (isApplicationStatus(card.status) && canTransition(card.status, to, transitions));
  }

  /** The moves a card has an icon for: one click puts the application in that status, whether or not its column is shown. */
  const QUICK = [{ to: 'ghosted', icon: 'ghost' }, { to: 'withdrawn', icon: 'undo' }] as const;
  const quick = (card: ApplicationRow) => QUICK.filter((item) => isApplicationStatus(card.status) && card.status !== item.to && allows(card, item.to));

  /** The Rejected icon: only when the setting is on and the rules let the card move to Rejected. */
  const canReject = (card: ApplicationRow): boolean => uiState().kanban_reject_icon && isApplicationStatus(card.status) && card.status !== 'rejected' && allows(card, 'rejected');

  const CHANNELS = ['email', 'phone', 'video', 'linkedin', 'in_person', 'portal', 'other'] as const;
  let rejecting = $state<ApplicationRow>();
  let rejectChannel = $state('email');
  let rejectWhen = $state('');
  let rejectNote = $state('');

  /** Now as the value of a datetime-local field (the browser's clock, like the field itself). */
  function nowLocal(): string {
    const date = new Date();
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function askReject(card: ApplicationRow): void {
    rejectChannel = 'email';
    rejectWhen = nowLocal();
    rejectNote = '';
    rejecting = card;
  }

  /** The entry is saved first, then the status moves (which also archives a new or applied job). */
  async function confirmReject(): Promise<void> {
    const card = rejecting;
    if (!card) return;
    rejecting = undefined;
    try {
      await api.addCommunication(card.id, {
        kind: 'message', direction: 'incoming', channel: rejectChannel, summary: tr('ui.comm.rejectSummary'), details: rejectNote.trim(),
        ...(rejectWhen === '' ? {} : { datetime: rejectWhen }),
      });
      await api.setApplicationStatus(card.id, 'rejected');
      toast.success(tr('ui.kanban.rejectDone', { label: card.label }));
      onmoved();
    } catch (error) {
      notifyError(error);
    }
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
    // A column ordered by a field has no hand-placed order: a drop inside it changes nothing.
    if (card.status === to && choiceOf(to).by !== 'manual') return;
    if (!allows(card, to)) {
      toast.warning(tr('ui.kanban.notAllowed', { label: card.label, from: statusStyle(card.status).text, to: statusStyle(to).text }));
      return;
    }
    if (isDatedStatus(to) && card.status !== to) {
      remindAt = '';
      pending = { card, index, to };
      return;
    }
    await run(card, to, () => api.moveApplication(card.id, to, index));
  }

  async function confirmWaiting(): Promise<void> {
    const current = pending;
    if (!current) return;
    pending = undefined;
    await run(current.card, current.to, () => api.moveApplication(current.card.id, current.to, current.index, remindAt), remindAt);
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
    const sorted = choiceOf(status).by !== 'manual';
    void place(card, status, sorted ? 0 : indexAt(cards, card, targetId, after));
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
        <span class="sortbar">
          <select
            data-ui="kanban.{column.status}.sort"
            class="input sort"
            aria-label={tr('ui.sort.by', { status: statusStyle(column.status).text })}
            title={column.choice.by === 'manual' ? tr('ui.sort.tipManual') : tr('ui.kanban.sortedHint')}
            value={column.choice.by}
            onchange={(event) => onsort(column.status, { by: event.currentTarget.value as ApplicationSortKey, up: false })}
          >
            {#each sortKeysFor(column.status) as key (key)}<option value={key}>{sortLabel(key)}</option>{/each}
          </select>
          <button
            data-ui="kanban.{column.status}.sort-dir"
            type="button"
            class="dir"
            disabled={column.choice.by === 'manual'}
            aria-label={tr('ui.sort.direction')}
            title={tr('ui.sort.direction')}
            onclick={() => onsort(column.status, { ...column.choice, up: !column.choice.up })}
          >{column.choice.up ? '↑' : '↓'}</button>
        </span>
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
          <ApplicationFacts row={card} by={column.choice.by} ui="kanban.card.{card.id}" {now} />
          {#if card.last_activity_at !== ''}<span class="muted small">{formatDate(card.last_activity_at)}</span>{/if}
          {#if targets(card).length > 0 || quick(card).length > 0 || canReject(card)}
            <div class="moves">
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
            {#if canReject(card)}
              <Button variant="ghost" label={tr('ui.kanban.quickMove', { status: statusStyle('rejected').text })} ui="kanban.card.{card.id}.rejected" onclick={() => askReject(card)}><span class="reject"><Icon name="reject" size={18} /></span></Button>
            {/if}
            {#each quick(card) as item (item.to)}
              <Button variant="ghost" label={tr('ui.kanban.quickMove', { status: statusStyle(item.to).text })} ui="kanban.card.{card.id}.{item.to}" onclick={() => place(card, item.to, 0)}><Icon name={item.icon} size={18} /></Button>
            {/each}
            </div>
          {/if}
        </article>
      {:else}
        <p class="muted small empty">{tr('ui.kanban.empty')}</p>
      {/each}
    </section>
  {/each}
</div>
{#if shown.length === 0}<p class="muted" data-ui="kanban.all-hidden">{tr('ui.kanban.allHidden')}</p>{/if}

<Dialog open={pending !== undefined} title={tr(pending?.to === 'homework' ? 'ui.kanban.homeworkTitle' : 'ui.kanban.waitingTitle')} onclose={() => (pending = undefined)} ui="kanban.waiting">
  <Field label={tr(pending?.to === 'homework' ? 'ui.app.homeworkDue' : 'ui.app.remindOn')} for="kanban-remind">
    <input data-ui="kanban.remind-date" id="kanban-remind" class="input" type="date" min={today} bind:value={remindAt} />
  </Field>
  {#snippet footer()}
    <Button variant="primary" ui="kanban.waiting.confirm" disabled={remindAt === '' || remindAt < today} onclick={confirmWaiting}>{tr('ui.app.changeStatus')}</Button>
  {/snippet}
</Dialog>

<Dialog open={rejecting !== undefined} title={tr('ui.kanban.rejectTitle', { label: rejecting?.label ?? '' })} onclose={() => (rejecting = undefined)} ui="kanban.reject">
  <div class="stack">
    <Field label={tr('ui.kanban.rejectChannel')} for="kanban-reject-channel">
      <select data-ui="kanban.reject.channel" id="kanban-reject-channel" class="input" bind:value={rejectChannel}>
        {#each CHANNELS as option (option)}<option value={option}>{channelLabel(option)}</option>{/each}
      </select>
    </Field>
    <Field label={tr('ui.kanban.rejectWhen')} for="kanban-reject-when">
      <input data-ui="kanban.reject.when" id="kanban-reject-when" class="input" type="datetime-local" bind:value={rejectWhen} />
    </Field>
    <Field label={tr('ui.kanban.rejectNote')} for="kanban-reject-note">
      <textarea data-ui="kanban.reject.note" id="kanban-reject-note" class="input" rows="3" bind:value={rejectNote}></textarea>
    </Field>
    <p class="muted small">{tr('ui.kanban.rejectHint')}</p>
  </div>
  {#snippet footer()}
    <Button ui="kanban.reject.cancel" onclick={() => (rejecting = undefined)}>{tr('ui.cancel')}</Button>
    <Button variant="danger" ui="kanban.reject.confirm" onclick={confirmReject}>{tr('ui.kanban.rejectConfirm')}</Button>
  {/snippet}
</Dialog>

<style>
  .reject { display: inline-flex; color: var(--danger); }
  .board { display: flex; gap: var(--space-3); overflow-x: auto; align-items: flex-start; padding-bottom: var(--space-2); }
  .column { flex: 0 0 260px; display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-2); min-height: 120px; background: var(--surface-2); border: 2px solid transparent; border-radius: var(--radius-m); }
  .column.allowed { border-color: var(--accent); }
  .column.blocked { opacity: 0.45; }
  .column.over.allowed { background: var(--accent-soft); }
  .head { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
  .sortbar { display: flex; gap: var(--space-1); align-items: center; margin-left: auto; }
  .sort { min-height: 32px; max-width: 130px; padding: 0 var(--space-1); font-size: var(--text-s); }
  .dir { width: 32px; min-height: 32px; padding: 0; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-s); cursor: pointer; }
  .dir:disabled { opacity: 0.45; cursor: default; }
  .card { display: flex; flex-direction: column; gap: var(--space-1); padding: var(--space-3); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-m); cursor: grab; }
  .card.dragging { opacity: 0.4; }
  .title { font-weight: 600; }
  .moves { display: flex; align-items: center; gap: var(--space-1); margin-top: var(--space-1); }
  .moves :global(.btn) { flex: none; min-width: var(--tap); padding: 0; }
  .move { flex: 1 1 0; min-width: 0; }
  .empty { margin: 0; padding: var(--space-2); }
</style>
