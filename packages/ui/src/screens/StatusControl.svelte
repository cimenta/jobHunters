<script lang="ts">
  import { APPLICATION_STATUSES, canTransition, isApplicationStatus, isDatedStatus, type ApplicationStatus } from '@jobhunters/core';
  import { api } from '../api';
  import type { Application } from '../api/types';
  import Button from '../components/Button.svelte';
  import Icon from '../components/Icon.svelte';
  import { formatDate, todayLocal } from '../lib/format';
  import { tr } from '../lib/i18n.svelte';
  import { statusStyle } from '../lib/status';
  import { app } from '../state/app.svelte';
  import { invalidate } from '../state/invalidate.svelte';
  import { toast } from '../state/toast.svelte';

  /** `onchanged` is told the status that was just set, so the screen can ask for what belongs to it (the reason of a withdrawal). */
  let { application, onchanged }: { application: Application; onchanged?: (to: string) => void } = $props();

  let target = $state('');
  let remindAt = $state('');
  const today = todayLocal();

  // Only moves the rules allow: from "waiting" it is also possible to reschedule (waiting -> waiting).
  const options = $derived<ApplicationStatus[]>(
    isApplicationStatus(application.status)
      ? APPLICATION_STATUSES.filter((to) => (isDatedStatus(application.status) && to === application.status) || canTransition(application.status as ApplicationStatus, to, app.settings?.status_transitions))
      : [],
  );
  const needsDate = $derived(isDatedStatus(target));
  const dateLabel = $derived(tr(target === 'homework' ? 'ui.app.homeworkDue' : 'ui.app.remindOn'));
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
    const to = target;
    await api.setApplicationStatus(application.id, target, needsDate ? remindAt : undefined);
    onchanged?.(to);
    toast.success(tr(date === '' ? 'ui.statusChanged' : 'ui.statusChangedRemind', { label: application.label, from, to: statusStyle(target).text, date: formatDate(date) }));
    invalidate();
  }
</script>

{#if options.length === 0}
  <p class="muted small" data-ui="status-control.none">{tr('ui.app.noTransitions')}</p>
{:else}
  <div class="control" data-ui="status-control">
    <select id="status-target" data-ui="status-control.target" class="input" aria-label={tr('ui.app.newStatus')} title={tr('ui.app.newStatus')} bind:value={target}>
      <option value="">{tr('ui.app.newStatusPlaceholder')}</option>
      {#each options as option (option)}
        <option value={option}>{statusStyle(option).text}</option>
      {/each}
    </select>
    {#if target !== ''}
      {#if needsDate}
        <input data-ui="status-control.remind-date" id="status-remind" class="input" type="date" min={today} aria-label={dateLabel} title={dateLabel} bind:value={remindAt} />
      {/if}
      <div class="buttons">
        <Button variant="primary" label={tr('ui.app.changeStatus')} ui="status-control.change" disabled={!ready} onclick={change}><Icon name="check" size={18} /></Button>
        <Button label={tr('ui.cancel')} ui="status-control.cancel" onclick={() => { target = ''; remindAt = ''; }}><Icon name="close" size={18} /></Button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .control { display: flex; flex-direction: column; gap: var(--space-2); }
  .control select, .control input { width: var(--icons-w, 96px); max-width: 100%; }
  .buttons { display: grid; grid-template-columns: repeat(2, var(--tap)); gap: var(--space-2); }
  .buttons :global(.btn) { min-width: var(--tap); width: var(--tap); padding: 0; }
</style>
