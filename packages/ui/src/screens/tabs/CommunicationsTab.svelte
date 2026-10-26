<script lang="ts">
  import { COMMUNICATION_KINDS, DIRECTIONS_BY_KIND, canTransition, communicationKind, isApplicationStatus, type CommunicationKind } from '@jobhunters/core';
  import { api } from '../../api';
  import type { ApplicationDetail, Communication } from '../../api/types';
  import Badge from '../../components/Badge.svelte';
  import Button from '../../components/Button.svelte';
  import ConfirmDialog from '../../components/ConfirmDialog.svelte';
  import Dialog from '../../components/Dialog.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Field from '../../components/Field.svelte';
  import Icon from '../../components/Icon.svelte';
  import { kindIcon } from '../../lib/entry-style';
  import { formatDate, plusDays, shorten, todayLocal } from '../../lib/format';
  import { tr } from '../../lib/i18n.svelte';
  import { channelLabel, commLabel, directionLabelFor, kindLabel } from '../../lib/labels';
  import { app } from '../../state/app.svelte';
  import { invalidate } from '../../state/invalidate.svelte';
  import { toast } from '../../state/toast.svelte';

  let { detail }: { detail: ApplicationDetail } = $props();

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
  // The "Rejection" button fills the form for a rejection and, after the entry is saved, sets the status Rejected.
  let rejecting = $state(false);
  let beforeReject = { kind: 'message' as CommunicationKind, direction: 'outgoing', summary: '' };
  // "After a meeting" may also set the status Waiting; that status needs a reminder date.
  let setWaiting = $state(false);
  let remindAt = $state('');
  // A received homework may also set the status Homework; its deadline is required.
  let setHomework = $state(true);
  let homeworkDue = $state('');
  // A new meeting may also set the status Interview.
  let setInterview = $state(true);
  const today = todayLocal();
  const status = $derived(detail.application.status);
  const canWait = $derived(isApplicationStatus(status) && (status === 'waiting' || canTransition(status, 'waiting', app.settings?.status_transitions)));
  const waitingNeeded = $derived(editing?.id === undefined && kind === 'after_meeting' && canWait);
  const waitingReady = $derived(!(waitingNeeded && setWaiting) || (remindAt !== '' && remindAt >= today));
  const canHomework = $derived(isApplicationStatus(status) && (status === 'homework' || canTransition(status, 'homework', app.settings?.status_transitions)));
  const homeworkNeeded = $derived(editing?.id === undefined && kind === 'homework' && direction === 'incoming' && canHomework);
  const homeworkReady = $derived(!(homeworkNeeded && setHomework) || (homeworkDue !== '' && homeworkDue >= today));
  const canInterview = $derived(isApplicationStatus(status) && status !== 'interview' && canTransition(status, 'interview', app.settings?.status_transitions));
  const interviewNeeded = $derived(editing?.id === undefined && kind === 'meeting' && canInterview);
  const canReject = $derived(isApplicationStatus(status) && canTransition(status, 'rejected', app.settings?.status_transitions));

  function pickKind(next: CommunicationKind): void {
    // Adding starts from the usual direction of the kind; editing keeps the direction while the new kind accepts it.
    direction = editing?.id !== undefined && DIRECTIONS_BY_KIND[next].includes(direction) ? direction : DEFAULT_DIRECTION[next];
    // A kind without a channel leaves it empty in the data; the others need one again.
    if (channel === '') channel = 'email';
    // The rejection fill is a message; any other type is not a rejection.
    if (rejecting && next !== 'message') rejecting = false;
    kind = next;
  }

  function openAdd(): void {
    kind = 'message';
    direction = DEFAULT_DIRECTION.message;
    channel = 'email';
    summary = '';
    details = '';
    when = '';
    rejecting = false;
    setWaiting = false;
    setHomework = true;
    setInterview = true;
    homeworkDue = '';
    remindAt = plusDays(today, 7);
    editing = {};
  }

  function openEdit(entry: Communication): void {
    kind = communicationKind(entry.kind);
    direction = entry.direction;
    channel = entry.channel;
    setWaiting = false;
    summary = entry.summary;
    details = entry.details;
    when = '';
    rejecting = false;
    editing = { id: entry.id };
  }

  function toggleReject(): void {
    if (rejecting) {
      ({ kind, direction, summary } = beforeReject);
      rejecting = false;
      return;
    }
    beforeReject = { kind, direction, summary };
    kind = 'message';
    direction = 'incoming';
    summary = tr('ui.comm.rejectSummary');
    rejecting = true;
  }

  async function save(): Promise<void> {
    if (!editing) return;
    if (editing.id === undefined) {
      await api.addCommunication(detail.application.id, { kind, direction, channel: kind === 'after_meeting' ? '' : channel, summary, details, ...(when === '' ? {} : { datetime: when }) });
      // The status moves only after the entry is saved.
      if (rejecting && canReject) await api.setApplicationStatus(detail.application.id, 'rejected');
      else if (waitingNeeded && setWaiting) await api.setApplicationStatus(detail.application.id, 'waiting', remindAt);
      else if (homeworkNeeded && setHomework) await api.setApplicationStatus(detail.application.id, 'homework', homeworkDue);
      else if (interviewNeeded && setInterview) await api.setApplicationStatus(detail.application.id, 'interview');
    } else {
      await api.updateCommunication(editing.id, { kind, direction, channel: kind === 'after_meeting' ? '' : channel, summary, details });
    }
    toast.success(tr('ui.comm.saved', { summary: shorten(summary === '' ? kindLabel(kind) : summary, 40) }));
    editing = undefined;
    invalidate();
  }

  async function remove(): Promise<void> {
    if (removing === undefined) return;
    const removed = detail.communications.find((item) => item.id === removing);
    await api.removeCommunication(removing);
    toast.success(tr('ui.comm.removed', { summary: shorten(removed === undefined || removed.summary === '' ? kindLabel(removed?.kind ?? 'message') : removed.summary, 40) }));
    invalidate();
  }
</script>

<div class="stack" data-ui="communications">
  <div><Button ui="communications.add" onclick={openAdd}><Icon name="plus" size={18} />{tr('ui.comm.add')}</Button></div>
  {#if detail.communications.length === 0}
    <EmptyState ui="communications.empty" icon="file" title={tr('ui.comm.empty')} />
  {:else}
    <ul class="list">
      {#each detail.communications as entry (entry.id)}
        <li class="list-item entry" data-ui="comm.{entry.id}">
          <div class="head">
            <span class="muted" data-ui="comm.{entry.id}.icon"><Icon name={kindIcon(entry.kind, entry.channel)} size={18} /></span>
            {#if communicationKind(entry.kind) !== 'after_meeting'}<Badge text={directionLabelFor(entry.kind, entry.direction)} color="var(--accent-soft)" textColor="var(--text)" />{/if}
            {#if communicationKind(entry.kind) !== 'message'}<Badge text={kindLabel(entry.kind)} color="var(--surface-2)" textColor="var(--text)" />{/if}
            <span class="muted small">{entry.channel === '' ? '' : `${channelLabel(entry.channel)} · `}{formatDate(entry.datetime)}</span>
          </div>
          {#if entry.summary !== ''}<p class="summary">{entry.summary}</p>{/if}
          {#if entry.details !== ''}<p class="details muted">{entry.details}</p>{/if}
          <div class="row">
            <Button ui="comm.{entry.id}.edit" variant="ghost" label={tr('ui.edit')} onclick={() => openEdit(entry)}><Icon name="edit" size={18} /></Button>
            <Button ui="comm.{entry.id}.remove" variant="ghost" label={tr('ui.delete')} onclick={() => (removing = entry.id)}><Icon name="trash" size={18} /></Button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<Dialog ui="communication-dialog" open={editing !== undefined} title={editing?.id === undefined ? tr('ui.comm.add') : tr('ui.comm.edit')} onclose={() => (editing = undefined)}>
  {#snippet headerExtra()}
    {#if editing?.id === undefined && (canReject || rejecting)}
      <button data-ui="communication.reject" type="button" class="reject" aria-pressed={rejecting} title={tr('ui.comm.rejectTip')} onclick={toggleReject}>{tr('ui.comm.reject')}</button>
    {/if}
  {/snippet}
  <div class="stack">
    <div class="stack" data-ui="communication.kind">
      <span class="label-text">{tr('ui.comm.kind')}</span>
      <div class="row wrap">
        {#each COMMUNICATION_KINDS as option (option)}
          <button data-ui="communication.kind.{option}" type="button" class="kind" aria-pressed={kind === option} onclick={() => pickKind(option)}>
            <Icon name={kindIcon(option, channel)} size={18} />{kindLabel(option)}
          </button>
        {/each}
      </div>
    </div>
    {#if kind !== 'after_meeting'}
      <Field label={commLabel('direction', kind)} for="comm-direction">
        <select data-ui="communication.direction" id="comm-direction" class="input" bind:value={direction} disabled={DIRECTIONS_BY_KIND[kind].length === 1}>
          {#each DIRECTIONS_BY_KIND[kind] as option (option)}<option value={option}>{directionLabelFor(kind, option)}</option>{/each}
        </select>
      </Field>
      <Field label={tr('ui.comm.channel')} for="comm-channel">
        <select data-ui="communication.channel" id="comm-channel" class="input" bind:value={channel}>
          {#each CHANNELS as option (option)}<option value={option}>{channelLabel(option)}</option>{/each}
        </select>
      </Field>
    {/if}
    {#if rejecting}<p class="reject-note small" data-ui="communication.reject-note">{tr('ui.comm.rejectNote')}</p>{/if}
    <Field label={`${commLabel('summary', kind)} (${tr('ui.optional')})`} for="comm-summary"><input data-ui="communication.summary" id="comm-summary" class="input" bind:value={summary} /></Field>
    <Field label={tr('ui.comm.details')} for="comm-details"><textarea data-ui="communication.details" id="comm-details" class="input" rows="4" bind:value={details}></textarea></Field>
    {#if editing?.id === undefined}
      <Field label={commLabel('when', kind)} for="comm-when"><input data-ui="communication.when" id="comm-when" class="input" type="datetime-local" bind:value={when} /></Field>
    {/if}
    {#if waitingNeeded}
      <div class="stack waiting" data-ui="communication.waiting">
        <label class="check"><input data-ui="communication.set-waiting" type="checkbox" bind:checked={setWaiting} />{tr('ui.comm.setWaiting')}</label>
        {#if setWaiting}
          <Field label={tr('ui.comm.remindAt')} for="comm-remind-at"><input data-ui="communication.remind-at" id="comm-remind-at" class="input" type="date" min={today} bind:value={remindAt} /></Field>
        {/if}
      </div>
    {/if}
    {#if homeworkNeeded}
      <div class="stack waiting" data-ui="communication.homework">
        <label class="check"><input data-ui="communication.set-homework" type="checkbox" bind:checked={setHomework} />{tr('ui.comm.setHomework')}</label>
        {#if setHomework}
          <Field label={tr('ui.comm.homeworkDue')} for="comm-homework-due" hint={homeworkDue === '' ? tr('ui.comm.homeworkDueNeeded') : undefined}>
            <input data-ui="communication.homework-due" id="comm-homework-due" class="input" type="date" min={today} bind:value={homeworkDue} required />
          </Field>
        {/if}
      </div>
    {/if}
    {#if interviewNeeded}
      <div class="stack waiting" data-ui="communication.interview">
        <label class="check"><input data-ui="communication.set-interview" type="checkbox" bind:checked={setInterview} />{tr('ui.comm.setInterview')}</label>
      </div>
    {/if}
    {#if kind === 'meeting'}<p class="muted small" data-ui="communication.meeting-hint">{tr('ui.comm.meetingHint')}</p>{/if}
    {#if kind === 'confirmation'}<p class="muted small" data-ui="communication.confirm-note">{tr('ui.comm.confirmNote')}</p>{/if}
  </div>
  {#snippet footer()}
    <Button ui="communication.cancel" onclick={() => (editing = undefined)}>{tr('ui.cancel')}</Button>
    <Button ui="communication.save" variant="primary" disabled={!waitingReady || !homeworkReady} onclick={save}>{tr('ui.save')}</Button>
  {/snippet}
</Dialog>

<ConfirmDialog open={removing !== undefined} text={tr('ui.comm.removeConfirm')} onconfirm={remove} onclose={() => (removing = undefined)} />

<style>
  .entry { flex-direction: column; align-items: stretch; }
  .head { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
  .summary { font-weight: 600; }
  .details { white-space: pre-wrap; }
  .kind { display: inline-flex; align-items: center; gap: var(--space-2); min-height: var(--tap); padding: 0 var(--space-3); font: inherit; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-s); cursor: pointer; }
  .kind[aria-pressed='true'] { border-color: var(--accent); background: var(--accent-soft); font-weight: 600; }
  .label-text { font-weight: 600; font-size: var(--text-s); }
  .waiting { padding-top: var(--space-3); border-top: 1px solid var(--border); }
  .reject { display: inline-flex; align-items: center; padding: 2px 10px; font: inherit; font-size: var(--text-s); color: var(--danger); background: var(--danger-soft); border: 1px solid transparent; border-radius: 999px; cursor: pointer; }
  .reject[aria-pressed='true'] { border-color: var(--danger); font-weight: 600; }
  .reject-note { color: var(--danger); }
</style>
