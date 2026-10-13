<script lang="ts">
  import { collapseDiff, diffTexts } from '@jobhunters/core';
  import { api } from '../api';
  import type { HistoryEntry, HistoryList } from '../api/types';
  import { formatDate } from '../lib/format';
  import { tr } from '../lib/i18n.svelte';
  import { notifyError } from '../lib/notify';
  import { toast } from '../state/toast.svelte';
  import Button from './Button.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import Dialog from './Dialog.svelte';
  import Tabs from './Tabs.svelte';

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
  let view = $state('history-changes');
  let showAllLines = $state(false);

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

  // Another version opens on its changes against the live text; the live text itself has nothing to compare with.
  const selectedKey = $derived(selected?.id ?? '');
  $effect(() => {
    void selectedKey;
    view = isCurrent ? 'history-text' : 'history-changes';
    showAllLines = false;
  });

  const diff = $derived(selected && list ? diffTexts(list.live, selected.text) : undefined);
  const diffItems = $derived(diff ? collapseDiff(diff, { all: showAllLines }) : []);
  const hasFolds = $derived(diff !== undefined && collapseDiff(diff).some((item) => item.type === 'fold'));
  const diffSign = { added: '+', removed: '−', same: ' ' } as const;

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
        {#if !isCurrent}
          <Tabs
            items={[
              { id: 'history-changes', label: tr('ui.history.tab.changes') },
              { id: 'history-text', label: tr('ui.history.tab.text') },
            ]}
            bind:active={view}
            label={tr('ui.history.tabs')}
            ui="{ui}.dialog.view"
          />
        {/if}
        {#if !isCurrent && view === 'history-changes' && diff}
          <div role="tabpanel" id="panel-history-changes" aria-labelledby="tab-history-changes" class="diff-pane">
            <p class="legend small">
              <span class="chip removed">{tr('ui.history.diffRemoved')}</span>
              <span class="chip added">{tr('ui.history.diffAdded')}</span>
            </p>
            {#if diff.added === 0 && diff.removed === 0}
              <p class="muted" data-ui="{ui}.dialog.diff.none">{tr('ui.history.diffNone')}</p>
            {:else}
              <p class="summary" data-ui="{ui}.dialog.diff.summary">{tr('ui.history.diffSummary', { added: diff.added, removed: diff.removed })}</p>
              {#if hasFolds}
                <div><Button ui="{ui}.dialog.diff.show-all" onclick={() => (showAllLines = !showAllLines)}>{tr(showAllLines ? 'ui.history.diffHideEqual' : 'ui.history.diffShowAll')}</Button></div>
              {/if}
              <div class="diff" data-ui="{ui}.dialog.diff">
                {#each diffItems as item, index (index)}
                  {#if item.type === 'fold'}
                    <div class="line fold">{tr('ui.history.diffFold', { count: item.count })}</div>
                  {:else}
                    <div class="line {item.row.kind}" data-kind={item.row.kind}>
                      <span class="sign" aria-hidden="true">{diffSign[item.row.kind]}</span>
                      <span class="words">{#each item.row.segments as segment, at (at)}{#if segment.changed}{#if item.row.kind === 'added'}<ins>{segment.text}</ins>{:else}<del>{segment.text}</del>{/if}{:else}{segment.text}{/if}{/each}</span>
                    </div>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        {:else}
          <strong>{tr('ui.history.textOf', { version: selected.version })}</strong>
          <div class="text" data-ui="{ui}.dialog.text" role={isCurrent ? undefined : 'tabpanel'} id={isCurrent ? undefined : 'panel-history-text'} aria-labelledby={isCurrent ? undefined : 'tab-history-text'}>{selected.text}</div>
        {/if}
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
  .diff-pane { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
  .legend { display: flex; flex-wrap: wrap; gap: var(--space-3); margin: 0; }
  .chip { padding: 0 var(--space-2); border-radius: var(--radius-s); }
  .chip.removed { background: var(--danger-soft); text-decoration: line-through; }
  .chip.added { background: var(--success-soft); }
  .summary { margin: 0; font-weight: 600; }
  .diff { border: 1px solid var(--border); border-radius: var(--radius-s); max-height: 60dvh; overflow: auto; font-family: ui-monospace, Consolas, monospace; font-size: var(--text-s); }
  .line { display: flex; gap: var(--space-2); padding: 2px var(--space-2); white-space: pre-wrap; overflow-wrap: anywhere; }
  .line.removed { background: var(--danger-soft); }
  .line.added { background: var(--success-soft); }
  .line.fold { justify-content: center; color: var(--text-muted); background: var(--surface-2); font-family: inherit; }
  .sign { flex: none; width: 1ch; color: var(--text-muted); }
  ins { background: var(--success); color: var(--on-accent); text-decoration: none; border-radius: 2px; }
  del { background: var(--danger); color: var(--on-accent); border-radius: 2px; }
  @media (max-width: 760px) { .columns { grid-template-columns: 1fr; } }
</style>
