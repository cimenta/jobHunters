<script lang="ts">
  import { untrack } from 'svelte';
  import { jobStatusOf, sortJobBoard, type JobRow } from '@jobhunters/core';
  import { api } from '../api';
  import Badge from '../components/Badge.svelte';
  import MovingTag from '../components/MovingTag.svelte';
  import { formatSalary } from '../lib/format';
  import { tr } from '../lib/i18n.svelte';
  import { jobStatus, jobStyles } from '../lib/job-status';
  import { createMoves } from '../lib/moves.svelte';
  import { notifyError } from '../lib/notify';
  import { paths } from '../lib/route';
  import { toast } from '../state/toast.svelte';

  interface Props {
    rows: JobRow[];
    /** The columns shown, in order (codes of job statuses). */
    statuses: string[];
    onmoved: () => void;
  }
  let { rows, statuses, onmoved }: Props = $props();

  let dragging = $state<JobRow>();
  let over = $state<string>();

  const textOf = (code: string): string => jobStatus({ status: code, match_percent: null }).text;
  /** Cards that were dropped and are being saved: shown in their new place at once, with a note that the save is running. */
  const moves = createMoves();
  // A reload of the rows brings the saved moves in.
  $effect(() => {
    void rows;
    untrack(() => moves.settle());
  });
  const columns = $derived(
    statuses.map((status) => {
      const cards = sortJobBoard(rows.filter((row) => !(row.id in moves.all) && jobStatusOf(jobStyles(), row.status) === status));
      for (const [id, move] of Object.entries(moves.all)) {
        const card = rows.find((row) => row.id === id);
        if (card !== undefined && move.to === status) cards.splice(Math.min(move.index, cards.length), 0, card);
      }
      return { status, cards };
    }),
  );
  const target = $derived(new Set(Object.values(moves.all).filter((move) => !move.done).map((move) => move.to)));

  function movingText(card: JobRow, column: string, cards: JobRow[]): string {
    const move = moves.all[card.id]!;
    const n = cards.findIndex((other) => other.id === card.id) + 1;
    return move.from === move.to ? tr('ui.moving.reorder', { status: textOf(column), n }) : tr('ui.moving.fromTo', { from: textOf(move.from), to: textOf(move.to), n });
  }

  /** An ad that waits for the AI is being filled in and stays where it is. */
  const movable = (card: JobRow): boolean => card.status !== 'awaiting' && !(card.id in moves.all);

  async function place(card: JobRow, to: string, index: number): Promise<void> {
    if (!movable(card)) {
      toast.warning(tr('ui.jobsBoard.notAllowed', { title: card.title }));
      return;
    }
    const from = jobStatusOf(jobStyles(), card.status);
    moves.start(card.id, { from, to, index });
    try {
      await api.moveJob(card.id, to, index);
      moves.finish(card.id);
      toast.success(from === to ? tr('ui.jobsBoard.reordered', { title: card.title, status: textOf(to) }) : tr('ui.jobsBoard.moved', { title: card.title, from: textOf(from), to: textOf(to) }));
      onmoved();
    } catch (error) {
      moves.fail(card.id);
      notifyError(error);
      toast.warning(tr('ui.moving.failed', { label: card.title, status: textOf(from) }));
    }
  }

  /** Place among the other cards of the column: before the card dropped on, or after it in its lower half. */
  function indexAt(cards: JobRow[], card: JobRow, targetId: string | undefined, after: boolean): number {
    const others = cards.filter((other) => other.id !== card.id);
    if (targetId === undefined) return others.length;
    const at = others.findIndex((other) => other.id === targetId);
    return at < 0 ? others.length : at + (after ? 1 : 0);
  }

  function dropOn(event: DragEvent, status: string, cards: JobRow[], targetId?: string): void {
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

<div class="board" data-ui="jobs.board" role="group" aria-label={tr('ui.jobsBoard.label')}>
  {#each columns as column (column.status)}
    <section
      class="column"
      class:allowed={dragging !== undefined && movable(dragging)}
      class:over={over === column.status}
      class:receiving={target.has(column.status)}
      data-ui="jobs.board.col.{column.status}"
      aria-label={textOf(column.status)}
      ondragover={(event) => {
        if (dragging && movable(dragging)) event.preventDefault();
        over = column.status;
      }}
      ondrop={(event) => dropOn(event, column.status, column.cards)}
    >
      <header class="head">
        <Badge text={textOf(column.status)} color={jobStatus({ status: column.status, match_percent: null }).color} textColor={jobStatus({ status: column.status, match_percent: null }).textColor} />
        <span class="muted small" data-ui="jobs.board.col.{column.status}.count">{column.cards.length}</span>
        {#if target.has(column.status)}<span class="receiving-text small" data-ui="jobs.board.col.{column.status}.receiving">{tr('ui.moving.into')}</span>{/if}
      </header>
      {#each column.cards as card (card.id)}
        {@const pay = formatSalary(card)}
        <article
          class="card"
          class:dragging={dragging?.id === card.id}
          class:moving={card.id in moves.all}
          aria-busy={card.id in moves.all}
          draggable={movable(card)}
          data-ui="jobs.board.card.{card.id}"
          ondragstart={(event) => {
            dragging = card;
            event.dataTransfer?.setData('text/plain', card.id);
          }}
          ondragend={() => {
            dragging = undefined;
            over = undefined;
          }}
          ondragover={(event) => {
            if (dragging && movable(dragging)) event.preventDefault();
          }}
          ondrop={(event) => dropOn(event, column.status, column.cards, card.id)}
        >
          <a data-ui="jobs.board.card.{card.id}.link" class="title" draggable="false" href={paths.job(card.id)}>{card.title}</a>
          {#if card.company_name !== ''}<span class="muted small" data-ui="jobs.board.card.{card.id}.company">{card.company_name}</span>{/if}
          {#if pay !== ''}<span class="small" data-ui="jobs.board.card.{card.id}.pay">{pay}</span>{/if}
          {#if card.contact_person !== ''}<span class="muted small" data-ui="jobs.board.card.{card.id}.contact">{card.contact_person}</span>{/if}
          {#if card.id in moves.all}
            <MovingTag text={movingText(card, column.status, column.cards)} ui="jobs.board.card.{card.id}.moving" />
          {:else if movable(card)}
            <select
              data-ui="jobs.board.card.{card.id}.move"
              class="input move"
              aria-label={tr('ui.kanban.moveTo')}
              value=""
              onchange={(event) => {
                const to = event.currentTarget.value;
                event.currentTarget.value = '';
                if (to !== '') void place(card, to, 0);
              }}
            >
              <option value="">{tr('ui.kanban.moveTo')}</option>
              {#each statuses.filter((to) => to !== column.status) as to (to)}<option value={to}>{textOf(to)}</option>{/each}
            </select>
          {/if}
        </article>
      {:else}
        <p class="muted small empty">{tr('ui.jobsBoard.empty')}</p>
      {/each}
    </section>
  {/each}
</div>
{#if columns.length === 0}<p class="muted" data-ui="jobs.board.no-columns">{tr('ui.jobsBoard.noColumns')}</p>{/if}

<style>
  .board { display: flex; gap: var(--space-3); overflow-x: auto; align-items: flex-start; padding-bottom: var(--space-2); }
  .column { flex: 0 0 260px; display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-2); min-height: 120px; background: var(--surface-2); border: 2px solid transparent; border-radius: var(--radius-m); }
  .column.allowed { border-color: var(--accent); }
  .column.over.allowed { background: var(--accent-soft); }
  .head { display: flex; align-items: center; gap: var(--space-2); }
  .card { display: flex; flex-direction: column; gap: var(--space-1); padding: var(--space-3); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-m); cursor: grab; overflow-wrap: anywhere; }
  .card.dragging { opacity: 0.4; }
  .card.moving { border-color: var(--accent); background: var(--accent-soft); cursor: progress; }
  .column.receiving { border-color: var(--accent); }
  .receiving-text { color: var(--accent); font-weight: 600; }
  .title { font-weight: 600; }
  .move { min-width: 0; margin-top: var(--space-1); }
  .empty { margin: 0; padding: var(--space-2); }
</style>
