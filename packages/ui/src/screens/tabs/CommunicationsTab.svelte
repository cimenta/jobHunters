<script lang="ts">
  import { api } from '../../api';
  import type { ApplicationDetail, Communication } from '../../api/types';
  import Badge from '../../components/Badge.svelte';
  import Button from '../../components/Button.svelte';
  import ConfirmDialog from '../../components/ConfirmDialog.svelte';
  import Dialog from '../../components/Dialog.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Field from '../../components/Field.svelte';
  import Icon from '../../components/Icon.svelte';
  import { formatDate, shorten } from '../../lib/format';
  import { tr } from '../../lib/i18n.svelte';
  import { channelLabel, directionLabel } from '../../lib/labels';
  import { invalidate } from '../../state/invalidate.svelte';
  import { toast } from '../../state/toast.svelte';

  let { detail }: { detail: ApplicationDetail } = $props();

  const DIRECTIONS = ['incoming', 'outgoing', 'note'] as const;
  const CHANNELS = ['email', 'phone', 'linkedin', 'in_person', 'portal', 'other'] as const;

  let editing = $state<{ id?: string }>();
  let direction = $state('outgoing');
  let channel = $state('email');
  let summary = $state('');
  let details = $state('');
  let when = $state('');
  let removing = $state<string>();

  function openAdd(): void {
    direction = 'outgoing';
    channel = 'email';
    summary = '';
    details = '';
    when = '';
    editing = {};
  }

  function openEdit(entry: Communication): void {
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
      await api.addCommunication(detail.application.id, { direction, channel, summary, details, ...(when === '' ? {} : { datetime: when }) });
    } else {
      await api.updateCommunication(editing.id, { direction, channel, summary, details });
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
    <EmptyState icon="file" title={tr('ui.comm.empty')} />
  {:else}
    <ul class="list">
      {#each detail.communications as entry (entry.id)}
        <li class="list-item entry" data-ui="comm.{entry.id}">
          <div class="head">
            <Badge text={directionLabel(entry.direction)} color="var(--accent-soft)" textColor="var(--text)" />
            <span class="muted small">{channelLabel(entry.channel)} · {formatDate(entry.datetime)}</span>
          </div>
          <p class="summary">{entry.summary}</p>
          {#if entry.details !== ''}<p class="details muted">{entry.details}</p>{/if}
          <div class="row">
            <Button variant="ghost" label={tr('ui.edit')} onclick={() => openEdit(entry)}><Icon name="edit" size={18} /></Button>
            <Button variant="ghost" label={tr('ui.delete')} onclick={() => (removing = entry.id)}><Icon name="trash" size={18} /></Button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<Dialog ui="communication-dialog" open={editing !== undefined} title={editing?.id === undefined ? tr('ui.comm.add') : tr('ui.comm.edit')} onclose={() => (editing = undefined)}>
  <div class="stack">
    <Field label={tr('ui.comm.direction')} for="comm-direction">
      <select id="comm-direction" class="input" bind:value={direction}>
        {#each DIRECTIONS as option (option)}<option value={option}>{directionLabel(option)}</option>{/each}
      </select>
    </Field>
    <Field label={tr('ui.comm.channel')} for="comm-channel">
      <select id="comm-channel" class="input" bind:value={channel}>
        {#each CHANNELS as option (option)}<option value={option}>{channelLabel(option)}</option>{/each}
      </select>
    </Field>
    <Field label={tr('ui.comm.summary')} for="comm-summary"><input id="comm-summary" class="input" bind:value={summary} /></Field>
    <Field label={tr('ui.comm.details')} for="comm-details"><textarea id="comm-details" class="input" rows="4" bind:value={details}></textarea></Field>
    {#if editing?.id === undefined}
      <Field label={tr('ui.comm.when')} for="comm-when"><input id="comm-when" class="input" type="datetime-local" bind:value={when} /></Field>
    {/if}
  </div>
  {#snippet footer()}
    <Button onclick={() => (editing = undefined)}>{tr('ui.cancel')}</Button>
    <Button variant="primary" disabled={summary.trim() === ''} onclick={save}>{tr('ui.save')}</Button>
  {/snippet}
</Dialog>

<ConfirmDialog open={removing !== undefined} text={tr('ui.comm.removeConfirm')} onconfirm={remove} onclose={() => (removing = undefined)} />

<style>
  .entry { flex-direction: column; align-items: stretch; }
  .head { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
  .summary { font-weight: 600; }
  .details { white-space: pre-wrap; }
</style>
