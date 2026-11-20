<script lang="ts">
  import { api } from '../api';
  import Badge from '../components/Badge.svelte';
  import Button from '../components/Button.svelte';
  import Card from '../components/Card.svelte';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';
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
  import { statusStyle } from '../lib/status';
  import EmailRelinkDialog from './EmailRelinkDialog.svelte';
  import EmailSuggestDialog from './EmailSuggestDialog.svelte';

  let { id }: { id: string } = $props();

  const detail = useResource(() => api.getEmailDetail(id), () => id);
  const names = $derived((detail.data?.email.attachments ?? '').split('|').map((name) => name.trim()).filter((name) => name !== ''));
  const sender = $derived(detail.data === undefined ? '' : detail.data.email.from_name.trim() === '' ? detail.data.email.from_email : `${detail.data.email.from_name.trim()} <${detail.data.email.from_email}>`);

  const applications = useResource(() => api.listApplications());
  const jobs = useResource(() => api.listJobs());
  /** What the mail belongs to (a saved mail) or is suggested for (the best candidate), named for the line under the state. */
  const assignment = $derived.by(() => {
    const email = detail.data?.email;
    if (email === undefined) return undefined;
    const saved = email.state === 'confirmed';
    const best = detail.data?.suggestion?.candidates[0];
    const applicationId = saved ? email.application_id : (best?.applicationId ?? '');
    const jobId = saved ? email.job_id : (best?.jobId ?? '');
    if (applicationId !== '') {
      const row = applications.data?.find((item) => item.id === applicationId);
      return { saved, href: paths.application(applicationId), name: row?.label ?? tr('ui.emails.openApplication'), hint: row === undefined ? '' : `${row.company_name} · ${statusStyle(row.status).text}` };
    }
    if (jobId !== '') {
      const row = jobs.data?.find((item) => item.id === jobId);
      return { saved, href: paths.job(jobId), name: row?.title ?? tr('ui.emails.openJob'), hint: row?.company_name ?? '' };
    }
    return undefined;
  });
  let relinking = $state(false);

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

  let deleting = $state(false);

  async function archive(): Promise<void> {
    await api.archiveEmail(id);
    toast.success(tr('ui.emails.archived'));
    invalidate();
  }

  async function unarchive(): Promise<void> {
    await api.unarchiveEmail(id);
    toast.success(tr('ui.emails.unarchived'));
    offered = '';
    invalidate();
  }

  async function remove(): Promise<void> {
    await api.deleteEmail(id);
    toast.success(tr('ui.emails.deleted'));
    invalidate();
    navigate(paths.emails);
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
        {#if detail.data.suggestion?.fwd}<Badge ui="email-detail.forwarded" text={tr('ui.emails.forwarded')} color="var(--warning-soft)" textColor="var(--warning)" title={tr('ui.emails.forwardedTip')} />{/if}
        {#if email.is_bulk}<Badge ui="email-detail.bulk" text={tr('ui.emails.bulk')} color="var(--surface-2)" textColor="var(--text)" title={tr('ui.emails.bulkTip')} />{/if}
        {#if email.state !== 'confirmed' && email.state !== 'ignored' && email.state !== 'archived'}
          <Button ui="email-detail.add-entry" loading={parsing} onclick={openSuggestion}><Icon name="plus" size={18} />{tr('ui.emails.addEntry')}</Button>
        {/if}
        {#if email.state === 'suggested'}
          <Button ui="email-detail.reparse" loading={parsing} onclick={reparse}><Icon name="refresh" size={18} />{tr('ui.emails.reparse')}</Button>
        {/if}
        {#if email.state === '' || email.state === 'suggested' || email.state === 'ignored'}
          <Button ui="email-detail.archive" onclick={archive}><Icon name="archive" size={18} />{tr('ui.emails.archive')}</Button>
        {/if}
        {#if email.state === 'archived'}
          <Button ui="email-detail.unarchive" onclick={unarchive}><Icon name="undo" size={18} />{tr('ui.emails.unarchive')}</Button>
        {/if}
        <Button variant="danger" ui="email-detail.delete" onclick={() => (deleting = true)}><Icon name="trash" size={18} />{tr('ui.emails.delete')}</Button>
        {#if email.state === 'ignored'}
          <Button ui="email-detail.restore" onclick={restore}><Icon name="undo" size={18} />{tr('ui.emails.restore')}</Button>
        {/if}
      </div>
      {#if assignment !== undefined}
        <div class="assign" class:suggested={!assignment.saved} data-ui="email-detail.assignment">
          <span class="muted small">{assignment.saved ? tr('ui.emails.assigned') : tr('ui.emails.suggestedFor')}</span>
          <a data-ui="email-detail.assignment.link" class="name" href={assignment.href}>{assignment.name}</a>
          {#if assignment.hint !== ''}<span class="muted small" data-ui="email-detail.assignment.hint">{assignment.hint}</span>{/if}
          {#if assignment.saved}<span class="grow"></span><Button ui="email-detail.assignment.change" onclick={() => (relinking = true)}>{tr('ui.emails.change')}</Button>{/if}
        </div>
      {/if}
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
    <ConfirmDialog open={deleting} ui="email-delete" text={tr('ui.emails.deleteTitle') + ' ' + (email.subject === '' ? tr('ui.emails.noSubject') : email.subject) + '. ' + tr('ui.emails.deleteWarn')} onconfirm={remove} onclose={() => (deleting = false)} />
    {#if relinking}
      <EmailRelinkDialog detail={detail.data} from={assignment?.name ?? ''} onclose={() => (relinking = false)} />
    {/if}
    {#if suggesting && detail.data.suggestion}
      <EmailSuggestDialog detail={detail.data} onclose={() => (suggesting = false)} />
    {/if}
  {/if}
</div>

<style>
  .facts { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: var(--space-1) var(--space-3); margin: 0; }
  .facts dd { margin: 0; overflow-wrap: anywhere; }
  .assign { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: var(--accent-soft); border: 1px solid var(--accent); border-radius: var(--radius-m); }
  .assign.suggested { background: transparent; border-style: dashed; }
  .assign .name { font-weight: 600; }
  .assign .grow { flex: 1; }
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
