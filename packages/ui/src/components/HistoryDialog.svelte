<script lang="ts">
  import { api } from '../api';
  import type { HistoryEntry, HistoryList } from '../api/types';
  import { formatDate } from '../lib/format';
  import { tr } from '../lib/i18n.svelte';
  import { notifyError } from '../lib/notify';
  import { toast } from '../state/toast.svelte';
  import Button from './Button.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import Dialog from './Dialog.svelte';

  interface Props {
    open: boolean;
    historyKey: string;
    /** The human name of the text, shown in the title. */
    name: string;
    list: HistoryList | undefined;
    /** Base identifier; everything inside adds a suffix. */
    ui: string;
    onclose: () => void;
    /** Called after every change so the owner reloads the list; `restored` is true after Use This. */
    onchange: (restored: boolean) => Promise<unknown> | unknown;
  }
  let { open, historyKey, name, list, ui, onclose, onchange }: Props = $props();

  let selectedId = $state('');
  let comment = $state('');
  let confirmUse = $state(false);
  let confirmDelete = $state(false);

  const entries = $derived(list?.entries ?? []);
  const selected = $derived<HistoryEntry | undefined>(entries.find((entry) => entry.id === selectedId) ?? entries[0]);
  /** The newest version whose text is the live text; none when the live text was edited outside the app. */
  const liveId = $derived(entries.find((entry) => entry.text === list?.live)?.id);
  const isCurrent = $derived(selected !== undefined && selected.id === liveId);
  const isNewest = $derived(selected !== undefined && selected.id === entries[0]?.id);
  const isInitial = $derived(selected?.source === 'initial');

  $effect(() => {
    comment = selected?.comment ?? '';
  });

  const sourceLabel = (entry: HistoryEntry): string => tr(`ui.history.source.${entry.source}`, { from: entry.restored_from });

  async function saveComment(): Promise<void> {
    if (!selected) return;
    await api.updateHistoryEntry(selected.id, { comment });
    await onchange(false);
    toast.success(tr('ui.history.commentSaved'));
  }

  async function setPinned(pinned: boolean): Promise<void> {
    if (!selected) return;
    await api.updateHistoryEntry(selected.id, { pinned });
    await onchange(false);
  }

  async function useSelected(): Promise<void> {
    if (!selected) return;
    const version = selected.version;
    try {
      await api.restoreHistory(historyKey, selected.id);
    } finally {
      confirmUse = false;
    }
    selectedId = '';
    await onchange(true);
    toast.success(tr('ui.history.used', { version }));
  }

  async function deleteSelected(): Promise<void> {
    if (!selected) return;
    await api.deleteHistoryEntry(selected.id);
    selectedId = '';
    await onchange(false);
    toast.success(tr('ui.history.deleted'));
  }
</script>

<Dialog {open} title={tr('ui.history.title', { name })} {onclose} ui="{ui}.dialog" wide>
  {#if list && entries.length > 0 && selected}
    <p class="muted small" data-ui="{ui}.dialog.usage">{tr('ui.history.usage', { used: list.used, max: list.max })}</p>
    <div class="columns">
      <div class="meta" data-ui="{ui}.dialog.meta">
        <ul class="list" aria-label={tr('ui.history.list')} data-ui="{ui}.dialog.list">
          {#each entries as entry (entry.id)}
            <li>
              <button type="button" class="item" class:sel={entry.id === selected.id} data-ui="{ui}.dialog.item.{entry.version}" aria-current={entry.id === selected.id} onclick={() => (selectedId = entry.id)}>
                <span class="top">
                  <strong>#{entry.version}</strong>
                  <span class="muted small">{formatDate(entry.saved_at)}</span>
                  {#if entry.pinned}<span class="tag">{tr('ui.history.pinnedShort')}</span>{/if}
                  {#if entry.id === liveId}<span class="tag current">{tr('ui.history.current')}</span>{/if}
                </span>
                <span class="muted small">{sourceLabel(entry)}{entry.comment ? ` · ${entry.comment}` : ''}</span>
              </button>
            </li>
          {/each}
        </ul>
        <div class="detail" data-ui="{ui}.dialog.detail">
          <strong>{tr('ui.history.version', { version: selected.version })}</strong>
          <label class="field">
            <span class="label">{tr('ui.history.comment')}</span>
            <input class="input" type="text" maxlength="500" placeholder={tr('ui.history.commentPlaceholder')} bind:value={comment} data-ui="{ui}.dialog.comment" />
          </label>
          <div><Button ui="{ui}.dialog.comment-save" onclick={saveComment}>{tr('ui.history.commentSave')}</Button></div>
          <label class="check">
            <input type="checkbox" checked={selected.pinned} disabled={isInitial} data-ui="{ui}.dialog.pin" onchange={(event) => setPinned(event.currentTarget.checked).catch(notifyError)} />
            <span>{tr('ui.history.pin')}{isInitial ? ` ${tr('ui.history.pinLocked')}` : ''}</span>
          </label>
          <div class="actions">
            <Button variant="primary" ui="{ui}.dialog.use" disabled={isCurrent} onclick={() => (confirmUse = true)}>{tr('ui.history.use')}</Button>
            <Button variant="danger" ui="{ui}.dialog.delete" disabled={isCurrent || isNewest || selected.pinned} onclick={() => (confirmDelete = true)}>{tr('ui.history.delete')}</Button>
          </div>
          {#if isCurrent}<p class="muted small">{tr('ui.history.hintCurrent')}</p>{:else if selected.pinned}<p class="muted small">{tr('ui.history.hintPinned')}</p>{/if}
        </div>
      </div>
      <div class="text-pane" data-ui="{ui}.dialog.text-pane">
        <strong>{tr('ui.history.textOf', { version: selected.version })}</strong>
        <div class="text" data-ui="{ui}.dialog.text">{selected.text}</div>
      </div>
    </div>
  {:else}
    <p class="muted" data-ui="{ui}.dialog.empty">{tr('ui.history.empty')}</p>
  {/if}
</Dialog>

{#if selected}
  <Dialog open={confirmUse} title={tr('ui.history.useTitle')} onclose={() => (confirmUse = false)} ui="{ui}.dialog.use-confirm">
    <p>{tr('ui.history.useConfirm', { version: selected.version })}</p>
    {#snippet footer()}
      <Button ui="{ui}.dialog.use-confirm.cancel" onclick={() => (confirmUse = false)}>{tr('ui.cancel')}</Button>
      <Button variant="primary" ui="{ui}.dialog.use-confirm.confirm" onclick={useSelected}>{tr('ui.history.useConfirmYes')}</Button>
    {/snippet}
  </Dialog>
  <ConfirmDialog open={confirmDelete} text={tr('ui.history.deleteConfirm', { version: selected.version })} onconfirm={deleteSelected} onclose={() => (confirmDelete = false)} ui="{ui}.dialog.delete-confirm" />
{/if}

<style>
  .columns { display: grid; grid-template-columns: minmax(0, 340px) minmax(0, 1fr); gap: var(--space-4); }
  .meta { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }
  .list { list-style: none; margin: 0; padding: 0; max-height: 240px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-s); }
  .item { display: flex; flex-direction: column; gap: 2px; width: 100%; padding: var(--space-2) var(--space-3); text-align: left; font: inherit; color: var(--text); background: transparent; border: 0; border-bottom: 1px solid var(--border); cursor: pointer; }
  .item.sel { background: var(--accent-soft); }
  .top { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
  .tag { font-size: var(--text-s); padding: 0 var(--space-2); border: 1px solid var(--border); border-radius: 999px; color: var(--text-muted); }
  .tag.current { color: var(--accent); border-color: var(--accent); }
  .detail { display: flex; flex-direction: column; gap: var(--space-3); }
  .field { display: flex; flex-direction: column; gap: var(--space-1); }
  .label { font-weight: 600; font-size: var(--text-s); }
  .check { display: flex; gap: var(--space-2); align-items: flex-start; }
  .actions { display: flex; gap: var(--space-3); flex-wrap: wrap; }
  .text-pane { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
  .text { white-space: pre-wrap; overflow-wrap: anywhere; min-height: 300px; max-height: 60dvh; overflow-y: auto; padding: var(--space-3); background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-s); }
  @media (max-width: 760px) { .columns { grid-template-columns: 1fr; } }
</style>
