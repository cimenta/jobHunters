<script lang="ts">
  import { COMMUNICATION_KINDS, DIRECTIONS_BY_KIND, communicationKind, type CommunicationKind } from '@jobhunters/core';
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
  import { formatDate, shorten } from '../../lib/format';
  import { tr } from '../../lib/i18n.svelte';
  import { channelLabel, commLabel, directionLabelFor, kindLabel } from '../../lib/labels';
  import { invalidate } from '../../state/invalidate.svelte';
  import { toast } from '../../state/toast.svelte';

  let { detail }: { detail: ApplicationDetail } = $props();

  const CHANNELS = ['email', 'phone', 'video', 'linkedin', 'in_person', 'portal', 'other'] as const;
  const DEFAULT_DIRECTION: Record<CommunicationKind, string> = { message: 'outgoing', meeting: 'incoming', homework: 'incoming', confirmation: 'incoming' };

  let editing = $state<{ id?: string }>();
  let kind = $state<CommunicationKind>('message');
  let direction = $state('outgoing');
  let channel = $state('email');
  let summary = $state('');
  let details = $state('');
  let when = $state('');
  let removing = $state<string>();

  function pickKind(next: CommunicationKind): void {
    // Adding starts from the usual direction of the kind; editing keeps the direction while the new kind accepts it.
    direction = editing?.id !== undefined && DIRECTIONS_BY_KIND[next].includes(direction) ? direction : DEFAULT_DIRECTION[next];
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
    channel = entry.channel;
    summary = entry.summary;
    details = entry.details;
    when = '';
    editing = { id: entry.id };
  }

  async function save(): Promise<void> {
    if (!editing) return;
    if (editing.id === undefined) {
      await api.addCommunication(detail.application.id, { kind, direction, channel, summary, details, ...(when === '' ? {} : { datetime: when }) });
    } else {
      await api.updateCommunication(editing.id, { kind, direction, channel, summary, details });
    }
    toast.success(tr('ui.comm.saved', { summary: shorten(summary, 40) }));
    editing = undefined;
    invalidate();
  }

  async function remove(): Promise<void> {
    if (removing === undefined) return;
    const removed = detail.communications.find((item) => item.id === removing);
    await api.removeCommunication(removing);
    toast.success(tr('ui.comm.removed', { summary: shorten(removed?.summary ?? '', 40) }));
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
            <Badge text={directionLabelFor(entry.kind, entry.direction)} color="var(--accent-soft)" textColor="var(--text)" />
            {#if communicationKind(entry.kind) !== 'message'}<Badge text={kindLabel(entry.kind)} color="var(--surface-2)" textColor="var(--text)" />{/if}
            <span class="muted small">{channelLabel(entry.channel)} · {formatDate(entry.datetime)}</span>
          </div>
          <p class="summary">{entry.summary}</p>
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
    <Field label={commLabel('summary', kind)} for="comm-summary"><input data-ui="communication.summary" id="comm-summary" class="input" bind:value={summary} /></Field>
    <Field label={tr('ui.comm.details')} for="comm-details"><textarea data-ui="communication.details" id="comm-details" class="input" rows="4" bind:value={details}></textarea></Field>
    {#if editing?.id === undefined}
      <Field label={commLabel('when', kind)} for="comm-when"><input data-ui="communication.when" id="comm-when" class="input" type="datetime-local" bind:value={when} /></Field>
    {/if}
    {#if kind === 'meeting'}<p class="muted small" data-ui="communication.meeting-hint">{tr('ui.comm.meetingHint')}</p>{/if}
    {#if kind === 'confirmation'}<p class="muted small" data-ui="communication.confirm-note">{tr('ui.comm.confirmNote')}</p>{/if}
  </div>
  {#snippet footer()}
    <Button ui="communication.cancel" onclick={() => (editing = undefined)}>{tr('ui.cancel')}</Button>
    <Button ui="communication.save" variant="primary" disabled={summary.trim() === ''} onclick={save}>{tr('ui.save')}</Button>
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
</style>
