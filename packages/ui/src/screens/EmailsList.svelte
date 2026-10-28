<script lang="ts">
  import { emailSearchText, foldDiacritics } from '@jobhunters/core';
  import { api } from '../api';
  import Button from '../components/Button.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import ErrorBlock from '../components/ErrorBlock.svelte';
  import Field from '../components/Field.svelte';
  import Icon from '../components/Icon.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import { emailMark } from '../lib/email-state';
  import { formatDate } from '../lib/format';
  import { tr } from '../lib/i18n.svelte';
  import { useResource } from '../lib/resource.svelte';
  import { paths } from '../lib/route';
  import { router } from '../lib/router.svelte';
  import { invalidate } from '../state/invalidate.svelte';
  import { toast } from '../state/toast.svelte';

  const emails = useResource(() => api.listEmails());
  let text = $state('');
  type Filter = 'all' | 'incoming' | 'outgoing' | 'unprocessed' | 'bulk';
  /** One of the filter buttons is always on; All shows every mail. */
  let filter = $state<Filter>('all');
  const FILTERS: { id: Filter; label: () => string }[] = [
    { id: 'all', label: () => tr('ui.emails.dirAll') },
    { id: 'incoming', label: () => tr('ui.emails.dirIncoming') },
    { id: 'outgoing', label: () => tr('ui.emails.dirOutgoing') },
    { id: 'unprocessed', label: () => tr('ui.emails.filterUnprocessed') },
    { id: 'bulk', label: () => tr('ui.emails.filterBulk') },
  ];
  /** Unprocessed: not saved and not ignored yet, so new and suggested mail. */
  const matches = (row: { direction: string; is_bulk: boolean; state: string }): boolean =>
    filter === 'all' || (filter === 'bulk' ? row.is_bulk : filter === 'unprocessed' ? row.state === '' || row.state === 'suggested' : row.direction === filter);

  const unparsed = $derived((emails.data ?? []).filter((row) => row.state === '').length);

  /** Parses every mail that is new; with automatic saving on (Settings) the clear ones are saved as well. */
  async function parseAll(): Promise<void> {
    if (unparsed === 0) {
      toast.success(tr('ui.emails.parseNothing'));
      return;
    }
    const result = await api.parseEmails();
    toast.success(tr('ui.emails.parsed', { count: result.parsed, suggested: result.suggested, withoutMatch: result.withoutMatch, saved: result.saved, ignored: result.ignored }));
    invalidate();
  }

  const rows = $derived.by(() => {
    const needle = foldDiacritics(text.trim()).toLowerCase();
    return (emails.data ?? []).filter(
      (row) => matches(row) && (needle === '' || emailSearchText(row).includes(needle)),
    );
  });
</script>

<div class="stack" data-ui="emails">
  <div class="page-title"><h1>{tr('ui.emails.title')}</h1></div>

  {#if emails.status === 'loading'}
    <Skeleton lines={5} />
  {:else if emails.status === 'error'}
    <ErrorBlock error={emails.error} onretry={invalidate} />
  {:else if (emails.data ?? []).length === 0}
    <EmptyState ui="emails.empty" icon="mail" title={tr('ui.emails.emptyTitle')} text={tr('ui.emails.emptyText')} />
  {:else}
    <Field label={tr('ui.emails.search')} for="email-search" hint={tr('ui.emails.searchHint')}><input data-ui="emails.search" id="email-search" class="input" type="search" bind:value={text} /></Field>
    <div class="row wrap filters">
      <span class="seg" role="group" data-ui="emails.filter" aria-label={tr('ui.emails.filters')}>
        {#each FILTERS as option (option.id)}
          <button type="button" data-ui="emails.filter.{option.id}" aria-pressed={filter === option.id} onclick={() => (filter = option.id)}>{option.label()}</button>
        {/each}
      </span>
      <Button ui="emails.parse" onclick={parseAll}><Icon name="wand" size={18} />{tr('ui.emails.parse', { count: unparsed })}</Button>
    </div>
    {#if rows.length === 0}
      <EmptyState ui="emails.no-match" title={tr('ui.jobs.noMatchTitle')} text={tr('ui.jobs.noMatchText')} />
    {:else}
      <ul class="list" data-ui="emails.list">
        {#each rows as row (row.id)}
          {@const mark = emailMark(row)}
          <li>
            <a class="list-item" data-ui="email.{row.id}" href={paths.email(row.id)} aria-current={router.current.id === row.id ? 'true' : undefined}>
              <span class="mark {mark.tone}" class:custom={mark.color !== ''} style:--mark-color={mark.color || undefined} data-ui="email.{row.id}.mark" data-tone={mark.tone} data-mark={mark.key} data-icon={mark.icon} title={mark.label} role="img" aria-label={mark.label}><Icon name={mark.icon} size={16} /></span>
              <span class="grow body">
                <span class="top">
                  <span class="name">{row.direction === 'outgoing' ? tr('ui.emails.to', { name: row.counterpart }) : row.counterpart}</span>
                  <span class="muted small when">{formatDate(row.received_at)}</span>
                </span>
                <span class="subject">{row.subject === '' ? tr('ui.emails.noSubject') : row.subject}</span>
                {#if row.attachment_list.length > 0 || row.is_bulk}
                  <span class="marks muted small">
                    {#if row.attachment_list.length > 0}<span data-ui="email.{row.id}.attachments" title={tr('ui.emails.hasAttachments')}><Icon name="file" size={14} /> {row.attachment_list.length}</span>{/if}
                    {#if row.is_bulk}<span class="bulk" data-ui="email.{row.id}.bulk" title={tr('ui.emails.bulkTip')}>{tr('ui.emails.bulk')}</span>{/if}
                  </span>
                {/if}
              </span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<style>
  .mark { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; align-self: flex-start; color: var(--text-muted); background: var(--surface-2); }
  .mark.new { color: var(--warning-text, var(--text)); background: var(--warning-soft, var(--surface-2)); }
  .mark.suggested { color: var(--accent); background: var(--accent-soft); border: 1px dashed var(--accent); }
  .mark.saved { color: var(--success-text, var(--text)); background: var(--success-soft, var(--surface-2)); }
  /* After every state, so the color the user chose wins over the color of the state. */
  .mark.custom { color: var(--mark-color); background: color-mix(in srgb, var(--mark-color) 16%, transparent); }
  .mark.suggested.custom { border-color: var(--mark-color); }
  .body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .top { display: flex; justify-content: space-between; gap: var(--space-2); }
  .name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .when { white-space: nowrap; }
  .subject { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .marks { display: flex; gap: var(--space-2); align-items: center; }
  .bulk { background: var(--surface-2); border-radius: var(--radius); padding: 0 var(--space-2); }
  .filters { align-items: center; }
  .seg { display: inline-flex; border: 1px solid var(--accent); border-radius: var(--radius-s); overflow: hidden; background: var(--surface); }
  .seg button { min-height: var(--tap); padding: 0 var(--space-3); font: inherit; font-size: var(--text-s); color: var(--text); background: var(--surface); border: 0; cursor: pointer; white-space: nowrap; }
  .seg button + button { border-left: 1px solid var(--accent); }
  .seg button:hover { background: var(--accent-soft); }
  .seg button[aria-pressed='true'] { color: var(--on-accent); font-weight: 600; background: var(--accent); }
  .check { display: flex; align-items: center; gap: var(--space-2); min-height: var(--tap); }
</style>
