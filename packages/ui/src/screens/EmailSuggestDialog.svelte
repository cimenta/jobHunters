<script lang="ts">
  import { untrack } from 'svelte';
  import { COMMUNICATION_KINDS, DEFAULT_TRANSITIONS, DIRECTIONS_BY_KIND, suggestStatus, type CommunicationKind } from '@jobhunters/core';
  import { api } from '../api';
  import type { EmailDetail } from '../api/types';
  import Button from '../components/Button.svelte';
  import Dialog from '../components/Dialog.svelte';
  import Field from '../components/Field.svelte';
  import Icon from '../components/Icon.svelte';
  import SearchSelect, { type SearchOption } from '../components/SearchSelect.svelte';
  import { kindIcon } from '../lib/entry-style';
  import { formatDate, shorten, toDateTimeInput, todayLocal } from '../lib/format';
  import { tr } from '../lib/i18n.svelte';
  import { channelLabel, commLabel, directionLabelFor, kindLabel } from '../lib/labels';
  import { useResource } from '../lib/resource.svelte';
  import { statusStyle } from '../lib/status';
  import { app } from '../state/app.svelte';
  import { invalidate } from '../state/invalidate.svelte';
  import { toast } from '../state/toast.svelte';

  /** The popup that suggests what a mail is and where it belongs; every suggestion can be changed before saving. */
  let { detail, onclose }: { detail: EmailDetail; onclose: () => void } = $props();

  const CHANNELS = ['email', 'phone', 'video', 'linkedin', 'in_person', 'portal', 'other'] as const;
  const DEFAULT_DIRECTION: Record<CommunicationKind, string> = { message: 'incoming', meeting: 'incoming', after_meeting: 'note', homework: 'incoming', confirmation: 'incoming' };

  const email = $derived(detail.email);
  const suggestion = $derived(detail.suggestion);
  const applications = useResource(() => api.listApplications());
  const jobs = useResource(() => api.listJobs());
  const today = todayLocal();

  const first = (): { target: string; kind: CommunicationKind; direction: string } => {
    const best = detail.suggestion?.candidates[0];
    return {
      target: best ? (best.applicationId !== '' ? `a:${best.applicationId}` : `j:${best.jobId}`) : '',
      kind: (detail.suggestion?.kind || 'message') as CommunicationKind,
      direction: detail.suggestion?.dir || DEFAULT_DIRECTION[(detail.suggestion?.kind || 'message') as CommunicationKind],
    };
  };
  const start = untrack(first);
  let target = $state(start.target);
  let kind = $state<CommunicationKind>(start.kind);
  let direction = $state(start.direction);
  let channel = $state(start.kind === 'after_meeting' ? '' : 'email');
  let summary = $state(untrack(() => detail.suggestion?.summary ?? ''));
  // The time a meeting names, else the time the mail was received.
  let when = $state(untrack(() => detail.suggestion?.at || toDateTimeInput(detail.email.received_at)));
  let notes = $state('');
  let includeText = $state(true);
  let setStatus = $state(true);
  let statusDate = $state('');
  /** Shows the e-mail in place of the form; the form stays as it is and comes back with its values. */
  let preview = $state(false);
  const attachments = $derived(email.attachments.split('|').map((name) => name.trim()).filter((name) => name !== ''));
  const sender = $derived(email.from_name.trim() === '' ? email.from_email : `${email.from_name.trim()} <${email.from_email}>`);

  const reasons = $derived(new Map((suggestion?.candidates ?? []).map((candidate) => [candidate.applicationId !== '' ? `a:${candidate.applicationId}` : `j:${candidate.jobId}`, candidate.method])));
  const options = $derived.by((): SearchOption[] => {
    const apps = applications.data ?? [];
    const standalone = (jobs.data ?? []).filter((job) => job.application_count === 0);
    const all: SearchOption[] = [
      ...apps.map((row) => ({ value: `a:${row.id}`, label: row.label, hint: `${row.company_name} · ${statusStyle(row.status).text}`, group: tr('ui.emails.applications') })),
      ...standalone.map((job) => ({ value: `j:${job.id}`, label: job.title, hint: job.company_name, group: tr('ui.emails.jobsOnly') })),
    ];
    const suggested = all.filter((option) => reasons.has(option.value)).map((option) => ({ ...option, group: tr('ui.emails.suggested'), mark: tr(`ui.emails.reason.${reasons.get(option.value)}`) }));
    return [...suggested, ...all.filter((option) => !reasons.has(option.value))];
  });

  const application = $derived(target.startsWith('a:') ? applications.data?.find((row) => `a:${row.id}` === target) : undefined);
  const statusFor = $derived(application ? suggestStatus(kind, suggestion?.hint, application.status, app.settings?.status_transitions ?? DEFAULT_TRANSITIONS) : undefined);
  const dated = $derived(statusFor === 'homework');
  // The box follows what the entry implies; a new target or type brings it back ticked.
  $effect(() => {
    void statusFor;
    setStatus = true;
  });
  const dateReady = $derived(!(statusFor && setStatus && dated) || (statusDate !== '' && statusDate >= today));
  const ready = $derived(target !== '' && dateReady);

  function pickKind(next: CommunicationKind): void {
    direction = DIRECTIONS_BY_KIND[next].includes(direction) ? direction : DEFAULT_DIRECTION[next];
    channel = next === 'after_meeting' ? '' : channel === '' ? 'email' : channel;
    kind = next;
  }

  async function save(): Promise<void> {
    if (!ready) return;
    const isApplication = target.startsWith('a:');
    const id = target.slice(2);
    await api.confirmEmail({
      id: email.id,
      ...(isApplication ? { applicationId: id } : { jobId: id }),
      kind,
      direction,
      channel,
      summary,
      ...(when === '' ? {} : { at: when }),
      notes,
      includeText,
      ...(statusFor && setStatus ? { status: statusFor, ...(dated ? { statusDate } : {}) } : {}),
    });
    toast.success(tr('ui.emails.savedEntry', { kind: kindLabel(kind), summary: shorten(summary === '' ? email.subject : summary, 40) }));
    invalidate();
    onclose();
  }

  async function ignore(): Promise<void> {
    await api.ignoreEmail(email.id);
    toast.success(tr('ui.emails.ignored'));
    invalidate();
    onclose();
  }
</script>

<Dialog open={true} title={tr('ui.emails.suggestTitle')} {onclose} ui="email-suggest">
  {#snippet headerExtra()}
    <Button ui="email-suggest.toggle" onclick={() => (preview = !preview)}><Icon name={preview ? 'wand' : 'mail'} size={18} />{preview ? tr('ui.emails.showSuggestion') : tr('ui.emails.showEmail')}</Button>
  {/snippet}
  {#if preview}
    <div class="stack" data-ui="email-suggest.preview">
      <h2 class="preview-subject" data-ui="email-suggest.preview.subject">{email.subject === '' ? tr('ui.emails.noSubject') : email.subject}</h2>
      <dl class="facts">
        <dt class="muted small">{tr('ui.emails.from')}</dt><dd>{sender}</dd>
        <dt class="muted small">{tr('ui.emails.recipients')}</dt><dd>{email.to}</dd>
        {#if email.cc !== ''}<dt class="muted small">{tr('ui.emails.cc')}</dt><dd>{email.cc}</dd>{/if}
        <dt class="muted small">{tr('ui.emails.date')}</dt><dd>{formatDate(email.received_at)}</dd>
      </dl>
      {#if attachments.length > 0}<p class="muted small" data-ui="email-suggest.preview.attachments"><Icon name="file" size={14} /> {attachments.join(', ')}</p>{/if}
      <div class="preview-body" data-ui="email-suggest.preview.body">{email.body === '' ? tr('ui.emails.noBody') : email.body}</div>
    </div>
  {/if}
  <div class="stack" style:display={preview ? "none" : undefined} data-ui="email-suggest.form">
    <p class="mail" data-ui="email-suggest.mail">
      <strong>{email.subject === '' ? tr('ui.emails.noSubject') : email.subject}</strong><br />
      <span class="muted small">{email.from_name === '' ? email.from_email : email.from_name} · {formatDate(email.received_at)}</span>
    </p>

    <SearchSelect
      label={tr('ui.emails.belongsTo')}
      ui="email-suggest.target"
      {options}
      value={target}
      onchange={(next) => (target = next)}
      placeholder={applications.status === 'loading' || jobs.status === 'loading' ? tr('ui.emails.loadingTargets') : tr('ui.emails.targetPlaceholder')}
      emptyText={tr('ui.emails.targetEmpty')}
    />
    {#if target === ''}<p class="hint muted small" data-ui="email-suggest.no-target">{tr('ui.emails.noTarget')}</p>{/if}

    <div class="stack" data-ui="email-suggest.kind">
      <span class="label-text">{tr('ui.comm.kind')}</span>
      <div class="row wrap">
        {#each COMMUNICATION_KINDS as option (option)}
          <button data-ui="email-suggest.kind.{option}" type="button" class="kind" aria-pressed={kind === option} onclick={() => pickKind(option)}>
            <Icon name={kindIcon(option, option === 'message' ? channel || 'email' : '')} size={18} />{kindLabel(option)}
          </button>
        {/each}
      </div>
      {#if suggestion && suggestion.rule !== ''}<p class="muted small" data-ui="email-suggest.rule">{tr('ui.emails.rule', { rule: suggestion.rule, confidence: suggestion.confidence === 'high' ? tr('ui.emails.high') : tr('ui.emails.low') })}</p>{/if}
    </div>

    {#if kind !== 'after_meeting'}
      <div class="row wrap">
        <Field label={commLabel('direction', kind)} for="es-direction">
          <select data-ui="email-suggest.direction" id="es-direction" class="input" bind:value={direction} disabled={DIRECTIONS_BY_KIND[kind].length === 1}>
            {#each DIRECTIONS_BY_KIND[kind] as option (option)}<option value={option}>{directionLabelFor(kind, option)}</option>{/each}
          </select>
        </Field>
        <Field label={tr('ui.comm.channel')} for="es-channel">
          <select data-ui="email-suggest.channel" id="es-channel" class="input" bind:value={channel}>
            {#each CHANNELS as option (option)}<option value={option}>{channelLabel(option)}</option>{/each}
          </select>
        </Field>
      </div>
    {/if}

    <Field label={commLabel('summary', kind)} for="es-summary"><input data-ui="email-suggest.summary" id="es-summary" class="input" bind:value={summary} /></Field>
    <Field label={tr('ui.emails.when')} for="es-when" hint={when === '' ? tr('ui.emails.whenDefault', { date: formatDate(email.received_at) }) : suggestion?.at ? tr('ui.emails.whenFromText') : tr('ui.emails.whenFromMail')}>
      <input data-ui="email-suggest.when" id="es-when" class="input" type="datetime-local" bind:value={when} />
    </Field>
    <Field label={tr('ui.emails.notes')} for="es-notes"><textarea data-ui="email-suggest.notes" id="es-notes" class="input" rows="3" bind:value={notes}></textarea></Field>
    <label class="check"><input data-ui="email-suggest.include-text" type="checkbox" bind:checked={includeText} />{tr('ui.emails.includeText')}</label>

    {#if statusFor}
      <div class="stack status" data-ui="email-suggest.status">
        <label class="check"><input data-ui="email-suggest.set-status" type="checkbox" bind:checked={setStatus} />{tr('ui.emails.setStatus', { status: statusStyle(statusFor).text })}</label>
        {#if dated && setStatus}
          <Field label={tr('ui.comm.homeworkDue')} for="es-status-date" hint={statusDate === '' ? tr('ui.comm.homeworkDueNeeded') : undefined}>
            <input data-ui="email-suggest.status-date" id="es-status-date" class="input" type="date" min={today} bind:value={statusDate} required />
          </Field>
        {/if}
      </div>
    {/if}
  </div>
  {#snippet footer()}
    <Button ui="email-suggest.cancel" onclick={onclose}>{tr('ui.cancel')}</Button>
    <Button ui="email-suggest.ignore" onclick={ignore}><Icon name="eye-off" size={18} />{tr('ui.emails.ignore')}</Button>
    <Button ui="email-suggest.save" variant="primary" disabled={!ready} onclick={save}>{tr('ui.save')}</Button>
  {/snippet}
</Dialog>

<style>
  .facts { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: var(--space-1) var(--space-3); margin: 0; }
  .facts dd { margin: 0; overflow-wrap: anywhere; }
  .preview-subject { margin: 0; font-size: var(--text-l); }
  .preview-body { white-space: pre-wrap; overflow-wrap: anywhere; padding-top: var(--space-3); border-top: 1px solid var(--border); }
  .mail { margin: 0; padding-left: var(--space-2); border-left: 2px solid var(--border); }
  .label-text { font-size: var(--text-s); font-weight: 600; }
  .kind { display: inline-flex; align-items: center; gap: var(--space-1); min-height: 32px; padding: 0 var(--space-3); font: inherit; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-m); cursor: pointer; }
  .kind[aria-pressed='true'] { color: var(--on-accent); background: var(--accent); border-color: var(--accent); }
  .status { padding: var(--space-2) var(--space-3); background: var(--accent-soft); border-radius: var(--radius-m); }
  .check { display: flex; align-items: center; gap: var(--space-2); min-height: var(--tap); }
  .hint { margin: 0; }
</style>
