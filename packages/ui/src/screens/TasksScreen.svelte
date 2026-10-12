<script lang="ts">
  import type { AiTaskRow } from '@jobhunters/core';
  import { api } from '../api';
  import Button from '../components/Button.svelte';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';
  import Dialog from '../components/Dialog.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import ErrorBlock from '../components/ErrorBlock.svelte';
  import Icon from '../components/Icon.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import { formatDate } from '../lib/format';
  import { tr } from '../lib/i18n.svelte';
  import { aiTaskTypeLabel } from '../lib/labels';
  import { useResource } from '../lib/resource.svelte';
  import { paths } from '../lib/route';
  import { invalidate } from '../state/invalidate.svelte';
  import { toast } from '../state/toast.svelte';

  const tasks = useResource(() => api.listAiTasks());
  let openId = $state<string | undefined>();

  /** Newest first; the backend sorts too, but the table must not depend on that. */
  const rows = $derived([...(tasks.data ?? [])].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0)));
  const selected = $derived<AiTaskRow | undefined>(rows.find((task) => task.id === openId));

  function statusLabel(status: string): string {
    switch (status) {
      case 'pending':
        return tr('ui.tasks.status.pending');
      case 'in_progress':
        return tr('ui.tasks.status.in_progress');
      case 'done':
        return tr('ui.tasks.status.done');
      case 'needs_input':
        return tr('ui.tasks.status.needs_input');
      case 'failed':
        return tr('ui.tasks.status.failed');
      default:
        return status;
    }
  }

  let confirming = $state<string | undefined>();

  /** An import task whose job still waits for the AI takes the job with it, so ask first. */
  async function askRemove(id: string): Promise<void> {
    const task = rows.find((row) => row.id === id);
    if (task?.type === 'import_job' && task.job_id !== '') {
      const detail = await api.getJob(task.job_id).catch(() => undefined);
      if (detail?.job.status === 'awaiting') {
        confirming = id;
        return;
      }
    }
    await remove(id);
  }

  async function remove(id: string): Promise<void> {
    const task = rows.find((row) => row.id === id);
    const what = task ? [task.company_name, task.job_title].filter((part) => part !== '').join(' – ') : '';
    await api.removeAiTask(id);
    openId = undefined;
    toast.success(tr('ui.tasks.removed', { type: task ? aiTaskTypeLabel(task.type) : '', what }));
    invalidate();
  }
</script>

<div class="stack" data-ui="tasks">
  <div class="page-title">
    <h1>{tr('ui.tasks.title')}</h1>
    <Button variant="ghost" ui="tasks.refresh" onclick={invalidate}><Icon name="refresh" size={18} />{tr('ui.match.refresh')}</Button>
  </div>
  <p class="muted small">{tr('ui.tasks.hint')}</p>

  {#if tasks.status === 'loading'}
    <Skeleton lines={5} />
  {:else if tasks.status === 'error'}
    <ErrorBlock error={tasks.error} onretry={invalidate} />
  {:else if rows.length === 0}
    <EmptyState ui="tasks.empty" icon="sparkle" title={tr('ui.tasks.emptyTitle')} text={tr('ui.tasks.emptyText')} />
  {:else}
    <div class="scroll" data-ui="tasks.list">
      <table data-ui="tasks.table">
        <thead>
          <tr>
            <th>{tr('ui.tasks.col.created')}</th>
            <th>{tr('ui.tasks.col.type')}</th>
            <th>{tr('ui.tasks.col.company')}</th>
            <th>{tr('ui.tasks.col.job')}</th>
            <th>{tr('ui.tasks.col.status')}</th>
            <th>{tr('ui.tasks.col.processed')}</th>
            <th><span class="sr-only">{tr('ui.tasks.detail')}</span></th>
          </tr>
        </thead>
        <tbody>
          {#each rows as task (task.id)}
            <tr data-ui="task.{task.id}">
              <td class="nowrap">{formatDate(task.created_at)}</td>
              <td>{aiTaskTypeLabel(task.type)}</td>
              <td class="job">{task.company_name}</td>
              <td class="job">{task.job_title}</td>
              <td><span class="badge" data-status={task.status}>{statusLabel(task.status)}</span></td>
              <td class="nowrap">{formatDate(task.completed_at)}</td>
              <td><Button ui="task.detail.{task.id}" onclick={() => (openId = task.id)}>{tr('ui.tasks.detail')}</Button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<Dialog open={selected !== undefined} title={selected ? aiTaskTypeLabel(selected.type) : ''} onclose={() => (openId = undefined)} ui="task-dialog">
  {#if selected}
    <div class="stack">
      <div class="row wrap">
        <span class="badge" data-status={selected.status}>{statusLabel(selected.status)}</span>
        <span class="muted small">{tr('ui.tasks.col.created')}: {formatDate(selected.created_at)}</span>
        {#if selected.completed_at !== ''}<span class="muted small">{tr('ui.tasks.col.processed')}: {formatDate(selected.completed_at)}</span>{/if}
      </div>
      {#if selected.company_name !== ''}<span class="muted small">{selected.company_name}</span>{/if}
      {#if selected.job_title !== ''}<a data-ui="tasks.job-link" href={paths.job(selected.job_id)} onclick={() => (openId = undefined)}>{selected.job_title}</a>{/if}
      <div>
        <h3>{tr('ui.tasks.instructions')}</h3>
        <p class="text">{selected.instructions}</p>
      </div>
      <div>
        <h3>{tr('ui.tasks.result')}</h3>
        <p class="text" data-ui="task-dialog.result">{selected.ai_note === '' ? tr('ui.tasks.noResult') : selected.ai_note}</p>
      </div>
    </div>
  {/if}
  {#snippet footer()}
    {#if selected}<Button variant="danger" ui="task-dialog.remove" onclick={() => selected && askRemove(selected.id)}><Icon name="trash" size={18} />{tr('ui.tasks.remove')}</Button>{/if}
  {/snippet}
</Dialog>

<ConfirmDialog
  open={confirming !== undefined}
  text={tr('ui.tasks.removeImportConfirm', { title: rows.find((row) => row.id === confirming)?.job_title ?? '' })}
  onconfirm={() => confirming && remove(confirming)}
  onclose={() => (confirming = undefined)}
/>

<style>
  .scroll { overflow-x: auto; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-m); }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: var(--space-2) var(--space-3); text-align: left; vertical-align: middle; border-bottom: 1px solid var(--border); }
  th { font-size: var(--text-s); color: var(--text-muted); white-space: nowrap; }
  tbody tr:last-child td { border-bottom: 0; }
  .nowrap { white-space: nowrap; }
  .job { min-width: 10rem; overflow-wrap: anywhere; }
  .text { white-space: pre-wrap; overflow-wrap: anywhere; }
  h3 { margin: 0 0 var(--space-1); font-size: var(--text-s); color: var(--text-muted); }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .badge { padding: 2px var(--space-2); font-size: var(--text-s); font-weight: 600; white-space: nowrap; background: var(--surface-2); border-radius: var(--radius-s); }
  .badge[data-status='done'] { background: var(--success-soft); }
  .badge[data-status='failed'] { background: var(--danger-soft); }
  .badge[data-status='needs_input'] { background: var(--warning-soft); }
</style>
