<script lang="ts">
  import { api } from '../../api';
  import type { ApplicationDetail, Reminder } from '../../api/types';
  import Badge from '../../components/Badge.svelte';
  import Button from '../../components/Button.svelte';
  import Dialog from '../../components/Dialog.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Field from '../../components/Field.svelte';
  import Icon from '../../components/Icon.svelte';
  import PostponeDialog from '../../components/PostponeDialog.svelte';
  import { formatDate, shorten, todayLocal } from '../../lib/format';
  import { tr } from '../../lib/i18n.svelte';
  import { invalidate } from '../../state/invalidate.svelte';
  import { toast } from '../../state/toast.svelte';

  let { detail }: { detail: ApplicationDetail } = $props();

  let adding = $state(false);
  let date = $state('');
  let text = $state('');
  let postponing = $state<Reminder>();
  const today = todayLocal();
  const valid = $derived(date !== '' && date >= today && text.trim() !== '');

  const ordered = $derived([...detail.reminders].sort((a, b) => Number(a.status !== 'open') - Number(b.status !== 'open') || (a.due_at < b.due_at ? -1 : 1)));

  function statusText(status: string): string {
    return status === 'open' ? tr('ui.reminders.statusOpen') : status === 'done' ? tr('ui.reminders.statusDone') : tr('ui.reminders.statusDismissed');
  }

  function openAdd(): void {
    date = '';
    text = '';
    adding = true;
  }

  async function add(): Promise<void> {
    await api.addReminder(detail.application.id, date, text);
    toast.success(tr('ui.reminders.added', { date: formatDate(date), text: shorten(text, 40) }));
    adding = false;
    invalidate();
  }

  async function complete(reminder: Reminder): Promise<void> {
    await api.completeReminder(reminder.id);
    toast.success(tr('ui.reminder.completed', { text: shorten(reminder.text, 40) }));
    invalidate();
  }

  async function dismiss(reminder: Reminder): Promise<void> {
    await api.dismissReminder(reminder.id);
    toast.success(tr('ui.reminders.dismissed', { text: shorten(reminder.text, 40) }));
    invalidate();
  }

  async function postpone(newDate: string): Promise<void> {
    if (!postponing) return;
    const target = postponing;
    await api.postponeReminder(target.id, newDate);
    toast.success(tr('ui.reminder.postponed', { date: formatDate(newDate), text: shorten(target.text, 40) }));
    invalidate();
  }
</script>

<div class="stack" data-ui="reminders">
  <div><Button ui="reminders.add" onclick={openAdd}><Icon name="plus" size={18} />{tr('ui.reminders.add')}</Button></div>
  {#if ordered.length === 0}
    <EmptyState ui="reminders.empty" icon="clock" title={tr('ui.reminders.empty')} />
  {:else}
    <ul class="list">
      {#each ordered as reminder (reminder.id)}
        <li class="list-item" data-ui="reminder.{reminder.id}">
          <div class="grow">
            <p class="text" class:finished={reminder.status !== 'open'}>{reminder.text}</p>
            <p class="muted small">{formatDate(reminder.due_at)}</p>
          </div>
          {#if reminder.status === 'open'}
            <Button ui="reminder.{reminder.id}.done" variant="ghost" label={tr('ui.reminder.done')} onclick={() => complete(reminder)}><Icon name="check" size={18} /></Button>
            <Button ui="reminder.{reminder.id}.postpone" variant="ghost" label={tr('ui.reminder.postpone')} onclick={() => (postponing = reminder)}><Icon name="clock" size={18} /></Button>
            <Button ui="reminder.{reminder.id}.dismiss" variant="ghost" label={tr('ui.reminder.dismiss')} onclick={() => dismiss(reminder)}><Icon name="trash" size={18} /></Button>
          {:else}
            <Badge text={statusText(reminder.status)} color="var(--surface-2)" textColor="var(--text)" />
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<Dialog open={adding} title={tr('ui.reminders.add')} onclose={() => (adding = false)} ui="add-reminder-dialog">
  <div class="stack">
    <Field label={tr('ui.reminders.date')} for="reminder-date"><input data-ui="add-reminder.date" id="reminder-date" class="input" type="date" min={today} bind:value={date} /></Field>
    <Field label={tr('ui.reminders.text')} for="reminder-text"><input data-ui="add-reminder.text" id="reminder-text" class="input" bind:value={text} /></Field>
  </div>
  {#snippet footer()}
    <Button ui="add-reminder.cancel" onclick={() => (adding = false)}>{tr('ui.cancel')}</Button>
    <Button ui="add-reminder.save" variant="primary" disabled={!valid} onclick={add}>{tr('ui.add')}</Button>
  {/snippet}
</Dialog>

<PostponeDialog open={postponing !== undefined} onclose={() => (postponing = undefined)} onconfirm={postpone} />

<style>
  .text { font-weight: 600; }
  .finished { text-decoration: line-through; color: var(--text-muted); }
</style>
