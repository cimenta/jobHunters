<script lang="ts">
  import { APPLICATION_STATUSES, canTransition, isApplicationStatus, type ApplicationStatus } from '@jobhunters/core';
  import { api } from '../api';
  import type { Application } from '../api/types';
  import Button from '../components/Button.svelte';
  import Field from '../components/Field.svelte';
  import { formatDate, todayLocal } from '../lib/format';
  import { tr } from '../lib/i18n.svelte';
  import { statusStyle } from '../lib/status';
  import { app } from '../state/app.svelte';
  import { invalidate } from '../state/invalidate.svelte';
  import { toast } from '../state/toast.svelte';

  let { application }: { application: Application } = $props();

  let target = $state('');
  let remindAt = $state('');
  const today = todayLocal();

  // Only moves the rules allow: from "waiting" it is also possible to reschedule (waiting -> waiting).
  const options = $derived<ApplicationStatus[]>(
    isApplicationStatus(application.status)
      ? APPLICATION_STATUSES.filter((to) => (application.status === 'waiting' && to === 'waiting') || canTransition(application.status as ApplicationStatus, to, app.settings?.status_transitions))
      : [],
  );
  const needsDate = $derived(target === 'waiting');
  const ready = $derived(target !== '' && (!needsDate || (remindAt !== '' && remindAt >= today)));

  $effect(() => {
    // Reset the form when the application (or its status) changes.
    void application.status;
    target = '';
    remindAt = '';
  });

  async function change(): Promise<void> {
    const from = statusStyle(application.status).text;
    const date = needsDate ? remindAt : '';
    await api.setApplicationStatus(application.id, target, needsDate ? remindAt : undefined);
    toast.success(tr(date === '' ? 'ui.statusChanged' : 'ui.statusChangedRemind', { label: application.label, from, to: statusStyle(target).text, date: formatDate(date) }));
    invalidate();
  }
</script>

{#if options.length === 0}
  <p class="muted">{tr('ui.app.noTransitions')}</p>
{:else}
  <div class="control" data-ui="status-control">
    <Field label={tr('ui.app.newStatus')} for="status-target">
      <select id="status-target" data-ui="status-control.target" class="input" bind:value={target}>
        <option value=""></option>
        {#each options as option (option)}
          <option value={option}>{statusStyle(option).text}</option>
        {/each}
      </select>
    </Field>
    {#if needsDate}
      <Field label={tr('ui.app.remindOn')} for="status-remind">
        <input data-ui="status-control.remind-date" id="status-remind" class="input" type="date" min={today} bind:value={remindAt} />
      </Field>
    {/if}
    <Button variant="primary" ui="status-control.change" disabled={!ready} onclick={change}>{tr('ui.app.changeStatus')}</Button>
  </div>
{/if}

<style>
  .control { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-3); align-items: end; }
</style>
