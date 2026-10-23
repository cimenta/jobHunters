<script lang="ts">
  import { COMMUNICATION_KINDS, DIRECTIONS_BY_KIND, communicationKind, type CommunicationKind } from '@jobhunters/core';
  import { api } from '../../api';
  import type { Communication, JobDetail } from '../../api/types';
  import Badge from '../../components/Badge.svelte';
  import Button from '../../components/Button.svelte';
  import ConfirmDialog from '../../components/ConfirmDialog.svelte';
  import Dialog from '../../components/Dialog.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Field from '../../components/Field.svelte';
  import Icon from '../../components/Icon.svelte';
  import { kindIcon } from '../../lib/entry-style';
  import { formatDate, shorten } from '../../lib/format';
  import { tr } from '../../lib/i18n.svelte';
  import { channelLabel, commLabel, directionLabelFor, kindLabel } from '../../lib/labels';
  import { paths } from '../../lib/route';
  import { invalidate } from '../../state/invalidate.svelte';
  import { toast } from '../../state/toast.svelte';

  /** Entries kept on the job itself (editable here) and the entries of its applications (read only, with a link). */
  let { job }: { job: JobDetail } = $props();

  const CHANNELS = ['email', 'phone', 'video', 'linkedin', 'in_person', 'portal', 'other'] as const;
  const DEFAULT_DIRECTION: Record<CommunicationKind, string> = { message: 'outgoing', meeting: 'incoming', after_meeting: 'note', homework: 'incoming', confirmation: 'incoming' };

  let editing = $state<{ id?: string }>();
  let kind = $state<CommunicationKind>('message');
  let direction = $state('outgoing');
  let channel = $state('email');
  let summary = $state('');
  let details = $state('');
  let when = $state('');
  let removing = $state<string>();

  function pickKind(next: CommunicationKind): void {
    direction = editing?.id !== undefined && DIRECTIONS_BY_KIND[next].includes(direction) ? direction : DEFAULT_DIRECTION[next];
    if (channel === '') channel = 'email';
    kind = next;
  }

  function openAdd(): void {
    kind = 'message';
    direction = DEFAULT_DIRECTION.message;
    channel = 'email';
    summary = '';
    details = '';
    when = '';
    editing = {};
  }

  function openEdit(entry: Communication): void {
    kind = communicationKind(entry.kind);
    direction = entry.direction;
    channel = entry.channel === '' ? 'email' : entry.channel;
    summary = entry.summary;
    details = entry.details;
    when = '';
    editing = { id: entry.id };
  }

  /** The application an entry belongs to, if any: its label and address. */
  function applicationOf(entry: Communication): { label: string; href: string } | undefined {
    if (entry.application_id === '') return undefined;
    const application = job.applications.find((item) => item.id === entry.application_id);
    return { label: application?.label ?? tr('ui.timeline.originApplication', { number: '' }), href: paths.application(entry.application_id) };
  }

  async function save(): Promise<void> {
    if (!editing) return;
    const fields = { kind, direction, channel: kind === 'after_meeting' ? '' : channel, summary, details };
    if (editing.id === undefined) await api.addJobCommunication(job.job.id, { ...fields, ...(when === '' ? {} : { datetime: when }) });
    else await api.updateCommunication(editing.id, fields);
    toast.success(tr('ui.comm.saved', { summary: shorten(summary === '' ? kindLabel(kind) : summary, 40) }));
    editing = undefined;
    invalidate();
  }

  async function remove(): Promise<void> {
    if (removing === undefined) return;
    const removed = job.communications.find((item) => item.id === removing);
    await api.removeCommunication(removing);
    toast.success(tr('ui.comm.removed', { summary: shorten(removed === undefined || removed.summary === '' ? kindLabel(removed?.kind ?? 'message') : removed.summary, 40) }));
    invalidate();
  }
</script>

<div class="stack" data-ui="job-communications">
  <div class="row wrap">
    <Button ui="job-communications.add" onclick={openAdd}><Icon name="plus" size={18} />{tr('ui.comm.add')}</Button>
    <span class="muted small">{tr('ui.jobComm.hint')}</span>
  </div>
  {#if job.communications.length === 0}
    <EmptyState ui="job-communications.empty" icon="file" title={tr('ui.comm.empty')} />
  {:else}
    <ul class="list">
      {#each job.communications as entry (entry.id)}
        {@const application = applicationOf(entry)}
        <li class="list-item entry" data-ui="job-comm.{entry.id}">
          <div class="head">
            <span class="muted" data-ui="job-comm.{entry.id}.icon"><Icon name={kindIcon(entry.kind, entry.channel)} size={18} /></span>
            {#if communicationKind(entry.kind) !== 'after_meeting'}<Badge text={directionLabelFor(entry.kind, entry.direction)} color="var(--accent-soft)" textColor="var(--text)" />{/if}
            {#if communicationKind(entry.kind) !== 'message'}<Badge text={kindLabel(entry.kind)} color="var(--surface-2)" textColor="var(--text)" />{/if}
            <span class="muted small">{entry.channel === '' ? '' : `${channelLabel(entry.channel)} · `}{formatDate(entry.datetime)}</span>
            {#if application}<a class="origin" data-ui="job-comm.{entry.id}.application" href={application.href}>{application.label}</a>{:else}<span class="origin job" data-ui="job-comm.{entry.id}.job">{tr('ui.timeline.originJob')}</span>{/if}
          </div>
          {#if entry.summary !== ''}<p class="summary">{entry.summary}</p>{/if}
          {#if entry.details !== ''}<p class="details muted">{entry.details}</p>{/if}
          {#if application === undefined}
            <div class="row">
              <Button ui="job-comm.{entry.id}.edit" variant="ghost" label={tr('ui.edit')} onclick={() => openEdit(entry)}><Icon name="edit" size={18} /></Button>
              <Button ui="job-comm.{entry.id}.remove" variant="ghost" label={tr('ui.delete')} onclick={() => (removing = entry.id)}><Icon name="trash" size={18} /></Button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<Dialog ui="job-communication-dialog" open={editing !== undefined} title={editing?.id === undefined ? tr('ui.comm.add') : tr('ui.comm.edit')} onclose={() => (editing = undefined)}>
  <div class="stack">
    <div class="stack" data-ui="job-communication.kind">
      <span class="label-text">{tr('ui.comm.kind')}</span>
      <div class="row wrap">
        {#each COMMUNICATION_KINDS as option (option)}
          <button data-ui="job-communication.kind.{option}" type="button" class="kind" aria-pressed={kind === option} onclick={() => pickKind(option)}>
            <Icon name={kindIcon(option, channel)} size={18} />{kindLabel(option)}
          </button>
        {/each}
      </div>
    </div>
    {#if kind !== 'after_meeting'}
      <Field label={commLabel('direction', kind)} for="job-comm-direction">
        <select data-ui="job-communication.direction" id="job-comm-direction" class="input" bind:value={direction} disabled={DIRECTIONS_BY_KIND[kind].length === 1}>
          {#each DIRECTIONS_BY_KIND[kind] as option (option)}<option value={option}>{directionLabelFor(kind, option)}</option>{/each}
        </select>
      </Field>
      <Field label={tr('ui.comm.channel')} for="job-comm-channel">
        <select data-ui="job-communication.channel" id="job-comm-channel" class="input" bind:value={channel}>
          {#each CHANNELS as option (option)}<option value={option}>{channelLabel(option)}</option>{/each}
        </select>
      </Field>
    {/if}
    <Field label={`${commLabel('summary', kind)} (${tr('ui.optional')})`} for="job-comm-summary"><input data-ui="job-communication.summary" id="job-comm-summary" class="input" bind:value={summary} /></Field>
    <Field label={tr('ui.comm.details')} for="job-comm-details"><textarea data-ui="job-communication.details" id="job-comm-details" class="input" rows="4" bind:value={details}></textarea></Field>
    {#if editing?.id === undefined}
      <Field label={commLabel('when', kind)} for="job-comm-when"><input data-ui="job-communication.when" id="job-comm-when" class="input" type="datetime-local" bind:value={when} /></Field>
    {/if}
  </div>
  {#snippet footer()}
    <Button ui="job-communication.cancel" onclick={() => (editing = undefined)}>{tr('ui.cancel')}</Button>
    <Button ui="job-communication.save" variant="primary" onclick={save}>{tr('ui.save')}</Button>
  {/snippet}
</Dialog>

<ConfirmDialog open={removing !== undefined} text={tr('ui.comm.removeConfirm')} onconfirm={remove} onclose={() => (removing = undefined)} />

<style>
  .entry { flex-direction: column; align-items: stretch; }
  .head { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
  .summary { font-weight: 600; }
  .details { white-space: pre-wrap; }
  .origin { padding: 1px 8px; font-size: var(--text-s); color: var(--accent); text-decoration: none; border: 1px solid var(--accent); border-radius: 999px; }
  .origin.job { color: var(--text-muted); border-color: var(--border); }
  .kind { display: inline-flex; align-items: center; gap: var(--space-2); min-height: var(--tap); padding: 0 var(--space-3); font: inherit; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-s); cursor: pointer; }
  .kind[aria-pressed='true'] { border-color: var(--accent); background: var(--accent-soft); font-weight: 600; }
  .label-text { font-weight: 600; font-size: var(--text-s); }
</style>
