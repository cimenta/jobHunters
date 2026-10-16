<script lang="ts">
  import { emailSearchText, foldDiacritics } from '@jobhunters/core';
  import { api } from '../api';
  import EmptyState from '../components/EmptyState.svelte';
  import ErrorBlock from '../components/ErrorBlock.svelte';
  import Field from '../components/Field.svelte';
  import Icon from '../components/Icon.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import { formatDate } from '../lib/format';
  import { tr } from '../lib/i18n.svelte';
  import { useResource } from '../lib/resource.svelte';
  import { paths } from '../lib/route';
  import { router } from '../lib/router.svelte';
  import { invalidate } from '../state/invalidate.svelte';

  const emails = useResource(() => api.listEmails());
  let text = $state('');
  let direction = $state('');
  let hideBulk = $state(false);

  const rows = $derived.by(() => {
    const needle = foldDiacritics(text.trim()).toLowerCase();
    return (emails.data ?? []).filter(
      (row) => (direction === '' || row.direction === direction) && !(hideBulk && row.is_bulk) && (needle === '' || emailSearchText(row).includes(needle)),
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
      <select class="input" aria-label={tr('ui.emails.direction')} data-ui="emails.direction" bind:value={direction}>
        <option value="">{tr('ui.emails.dirAll')}</option>
        <option value="incoming">{tr('ui.emails.dirIncoming')}</option>
        <option value="outgoing">{tr('ui.emails.dirOutgoing')}</option>
      </select>
      <label class="check"><input data-ui="emails.hide-bulk" type="checkbox" bind:checked={hideBulk} />{tr('ui.emails.hideBulk')}</label>
    </div>
    {#if rows.length === 0}
      <EmptyState ui="emails.no-match" title={tr('ui.jobs.noMatchTitle')} text={tr('ui.jobs.noMatchText')} />
    {:else}
      <ul class="list" data-ui="emails.list">
        {#each rows as row (row.id)}
          <li>
            <a class="list-item" data-ui="email.{row.id}" href={paths.email(row.id)} aria-current={router.current.id === row.id ? 'true' : undefined}>
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
  .body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .top { display: flex; justify-content: space-between; gap: var(--space-2); }
  .name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .when { white-space: nowrap; }
  .subject { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .marks { display: flex; gap: var(--space-2); align-items: center; }
  .bulk { background: var(--surface-2); border-radius: var(--radius); padding: 0 var(--space-2); }
  .filters { align-items: center; }
  .check { display: flex; align-items: center; gap: var(--space-2); min-height: var(--tap); }
</style>
