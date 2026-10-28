<script lang="ts">
  import { api } from '../api';
  import Badge from '../components/Badge.svelte';
  import Button from '../components/Button.svelte';
  import Card from '../components/Card.svelte';
  import ErrorBlock from '../components/ErrorBlock.svelte';
  import Icon from '../components/Icon.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import { emailMark } from '../lib/email-state';
  import { formatDate } from '../lib/format';
  import { tr } from '../lib/i18n.svelte';
  import { useResource } from '../lib/resource.svelte';
  import { paths } from '../lib/route';
  import { navigate } from '../lib/router.svelte';
  import { invalidate } from '../state/invalidate.svelte';
  import { toast } from '../state/toast.svelte';
  import EmailSuggestDialog from './EmailSuggestDialog.svelte';

  let { id }: { id: string } = $props();

  const detail = useResource(() => api.getEmailDetail(id), () => id);
  const names = $derived((detail.data?.email.attachments ?? '').split('|').map((name) => name.trim()).filter((name) => name !== ''));
  const sender = $derived(detail.data === undefined ? '' : detail.data.email.from_name.trim() === '' ? detail.data.email.from_email : `${detail.data.email.from_name.trim()} <${detail.data.email.from_email}>`);

  let suggesting = $state(false);
  /** True while the mail is being read; a notice says that the window with the suggestion will open. */
  let parsing = $state(false);
  /** The mail the popup was last offered for: clicking a mail opens it once, Cancel keeps it closed while the mail stays open. */
  let offered = '';

  // Opening a mail that is not saved parses it (when it is new) and offers the suggestion.
  $effect(() => {
    const data = detail.data;
    if (!data || offered === id || data.email.id !== id) return;
    offered = id;
    if (data.email.state === '') void parseThenOffer();
    else if (data.email.state === 'suggested') suggesting = true;
  });

  async function parseThenOffer(): Promise<void> {
    parsing = true;
    try {
      await api.parseEmail(id);
      invalidate();
      suggesting = true;
    } finally {
      parsing = false;
    }
  }

  async function openSuggestion(): Promise<void> {
    if (detail.data?.email.state === '') await parseThenOffer();
    else suggesting = true;
  }

  /** Reads the mail again, for example after the rules were changed. */
  async function reparse(): Promise<void> {
    await api.restoreEmail(id);
    await parseThenOffer();
  }

  async function restore(): Promise<void> {
    await api.restoreEmail(id);
    toast.success(tr('ui.emails.restored'));
    offered = '';
    invalidate();
  }
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
    {@const email = detail.data.email}
    {@const mark = emailMark(email)}
    <Card ui="email-detail.card">
      <h1 data-ui="email-detail.subject">{email.subject === '' ? tr('ui.emails.noSubject') : email.subject}</h1>
      <div class="row wrap">
        <span class="state {mark.tone}" class:custom={mark.color !== ''} style:--mark-color={mark.color || undefined} data-ui="email-detail.state" data-tone={mark.tone} data-mark={mark.key}><Icon name={mark.icon} size={16} />{mark.label}</span>
        {#if email.is_bulk}<Badge ui="email-detail.bulk" text={tr('ui.emails.bulk')} color="var(--surface-2)" textColor="var(--text)" title={tr('ui.emails.bulkTip')} />{/if}
        {#if email.state !== 'confirmed' && email.state !== 'ignored'}
          <Button ui="email-detail.add-entry" loading={parsing} onclick={openSuggestion}><Icon name="plus" size={18} />{tr('ui.emails.addEntry')}</Button>
        {/if}
        {#if email.state === 'suggested'}
          <Button ui="email-detail.reparse" loading={parsing} onclick={reparse}><Icon name="refresh" size={18} />{tr('ui.emails.reparse')}</Button>
        {/if}
        {#if email.state === 'ignored'}
          <Button ui="email-detail.restore" onclick={restore}><Icon name="undo" size={18} />{tr('ui.emails.restore')}</Button>
        {/if}
        {#if email.state === 'confirmed'}
          {#if email.application_id !== ''}
            <a data-ui="email-detail.entry-link" href={paths.application(email.application_id)}>{tr('ui.emails.openApplication')}</a>
          {:else if email.job_id !== ''}
            <a data-ui="email-detail.entry-link" href={paths.job(email.job_id)}>{tr('ui.emails.openJob')}</a>
          {/if}
        {/if}
      </div>
      {#if parsing}
        <p class="parsing" role="status" data-ui="email-detail.parsing"><Icon name="wand" size={16} />{tr('ui.emails.parsing')}</p>
      {/if}
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
    {#if suggesting && detail.data.suggestion}
      <EmailSuggestDialog detail={detail.data} onclose={() => (suggesting = false)} />
    {/if}
  {/if}
</div>

<style>
  .facts { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: var(--space-1) var(--space-3); margin: 0; }
  .facts dd { margin: 0; overflow-wrap: anywhere; }
  .attachments { display: flex; flex-wrap: wrap; gap: var(--space-2); padding: 0; margin: 0; list-style: none; }
  .attachments li { background: var(--surface-2); border-radius: var(--radius); padding: var(--space-1) var(--space-2); font-size: var(--text-s); overflow-wrap: anywhere; }
  .text { white-space: pre-wrap; overflow-wrap: anywhere; border-top: 1px solid var(--border); padding-top: var(--space-3); }
  .parsing { display: flex; align-items: center; gap: var(--space-2); margin: 0; padding: var(--space-2) var(--space-3); background: var(--accent-soft); border: 1px solid var(--accent); border-radius: var(--radius-m); }
  .state { display: inline-flex; align-items: center; gap: var(--space-1); padding: 2px var(--space-2); font-size: var(--text-s); border-radius: var(--radius-m); background: var(--surface-2); }
  .state.new { background: var(--warning-soft, var(--surface-2)); }
  .state.suggested { background: var(--accent-soft); border: 1px dashed var(--accent); }
  .state.saved { background: var(--success-soft, var(--surface-2)); }
  /* After every state, so the color the user chose wins over the color of the state. */
  .state.custom { background: color-mix(in srgb, var(--mark-color) 16%, transparent); }
  .state.suggested.custom { border-color: var(--mark-color); }
</style>
