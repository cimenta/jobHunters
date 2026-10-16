<script lang="ts">
  import { api } from '../api';
  import Badge from '../components/Badge.svelte';
  import Button from '../components/Button.svelte';
  import Card from '../components/Card.svelte';
  import ErrorBlock from '../components/ErrorBlock.svelte';
  import Icon from '../components/Icon.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import { formatDate } from '../lib/format';
  import { tr } from '../lib/i18n.svelte';
  import { useResource } from '../lib/resource.svelte';
  import { paths } from '../lib/route';
  import { navigate } from '../lib/router.svelte';
  import { invalidate } from '../state/invalidate.svelte';

  let { id }: { id: string } = $props();

  const detail = useResource(() => api.getEmail(id), () => id);
  const names = $derived((detail.data?.attachments ?? '').split('|').map((name) => name.trim()).filter((name) => name !== ''));
  const sender = $derived(detail.data === undefined ? '' : detail.data.from_name.trim() === '' ? detail.data.from_email : `${detail.data.from_name} <${detail.data.from_email}>`);
</script>

<div class="stack" data-ui="email-detail">
  <div class="only-narrow">
    <Button ui="email-detail.back" variant="ghost" onclick={() => navigate(paths.emails)}><Icon name="back" size={18} />{tr('ui.back')}</Button>
  </div>

  {#if detail.status === 'loading'}
    <Skeleton lines={6} />
  {:else if detail.status === 'error'}
    <ErrorBlock error={detail.error} onretry={invalidate} />
  {:else if detail.data}
    {@const email = detail.data}
    <Card ui="email-detail.card">
      <h1 data-ui="email-detail.subject">{email.subject === '' ? tr('ui.emails.noSubject') : email.subject}</h1>
      {#if email.is_bulk}<div><Badge ui="email-detail.bulk" text={tr('ui.emails.bulk')} color="var(--surface-2)" textColor="var(--text)" title={tr('ui.emails.bulkTip')} /></div>{/if}
      <dl class="facts" data-ui="email-detail.headers">
        <dt class="muted small">{tr('ui.emails.from')}</dt><dd data-ui="email-detail.from">{sender}</dd>
        <dt class="muted small">{tr('ui.emails.recipients')}</dt><dd data-ui="email-detail.to">{email.to}</dd>
        {#if email.cc !== ''}<dt class="muted small">{tr('ui.emails.cc')}</dt><dd data-ui="email-detail.cc">{email.cc}</dd>{/if}
        <dt class="muted small">{tr('ui.emails.date')}</dt><dd data-ui="email-detail.date">{formatDate(email.received_at)}</dd>
      </dl>
      {#if names.length > 0}
        <ul class="attachments" data-ui="email-detail.attachments" aria-label={tr('ui.emails.attachments')}>
          {#each names as name, index (index)}<li data-ui="email-detail.attachment.{index}"><Icon name="file" size={14} /> {name}</li>{/each}
        </ul>
      {/if}
      <div class="text" data-ui="email-detail.body">{email.body === '' ? tr('ui.emails.noBody') : email.body}</div>
    </Card>
  {/if}
</div>

<style>
  .facts { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: var(--space-1) var(--space-3); margin: 0; }
  .facts dd { margin: 0; overflow-wrap: anywhere; }
  .attachments { display: flex; flex-wrap: wrap; gap: var(--space-2); padding: 0; margin: 0; list-style: none; }
  .attachments li { background: var(--surface-2); border-radius: var(--radius); padding: var(--space-1) var(--space-2); font-size: var(--text-s); overflow-wrap: anywhere; }
  .text { white-space: pre-wrap; overflow-wrap: anywhere; border-top: 1px solid var(--border); padding-top: var(--space-3); }
</style>
