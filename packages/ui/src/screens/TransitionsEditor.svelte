<script lang="ts">
  import { APPLICATION_STATUSES, DEFAULT_TRANSITIONS, serializeStatusTransitions, type ApplicationStatus, type StatusTransitions } from '@jobhunters/core';
  import { api } from '../api';
  import Button from '../components/Button.svelte';
  import { tr } from '../lib/i18n.svelte';
  import { statusStyle } from '../lib/status';
  import { app, reloadSettings } from '../state/app.svelte';
  import { toast } from '../state/toast.svelte';

  let matrix = $state<Record<ApplicationStatus, ApplicationStatus[]>>(copy(DEFAULT_TRANSITIONS));

  function copy(source: StatusTransitions): Record<ApplicationStatus, ApplicationStatus[]> {
    return Object.fromEntries(APPLICATION_STATUSES.map((status) => [status, [...source[status]]])) as Record<ApplicationStatus, ApplicationStatus[]>;
  }

  // Follows the saved settings, so a saved change refreshes the form.
  $effect(() => {
    matrix = copy(app.settings?.status_transitions ?? DEFAULT_TRANSITIONS);
  });

  /** Statuses that can be left by default but no longer can. */
  const stuck = $derived(APPLICATION_STATUSES.filter((status) => DEFAULT_TRANSITIONS[status].length > 0 && matrix[status].length === 0));

  function toggle(from: ApplicationStatus, to: ApplicationStatus, checked: boolean): void {
    matrix[from] = checked ? [...matrix[from].filter((item) => item !== to), to] : matrix[from].filter((item) => item !== to);
  }

  async function save(): Promise<void> {
    await api.updateSettings({ status_transitions: serializeStatusTransitions(matrix) });
    await reloadSettings();
    toast.success(tr('ui.status.savedTransitions'));
  }
</script>

<div class="stack">
  <div class="scroll">
    <table class="matrix" data-ui="transitions">
      <thead>
        <tr>
          <th scope="col">{tr('ui.transitions.from')}</th>
          {#each APPLICATION_STATUSES as to (to)}<th scope="col">{statusStyle(to).text}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each APPLICATION_STATUSES as from (from)}
          <tr>
            <th scope="row">{statusStyle(from).text}</th>
            {#each APPLICATION_STATUSES as to (to)}
              <td>
                <input
                  type="checkbox"
                  disabled={from === to}
                  checked={matrix[from].includes(to)}
                  aria-label={tr('ui.transitions.cell', { from: statusStyle(from).text, to: statusStyle(to).text })}
                  onchange={(event) => toggle(from, to, event.currentTarget.checked)}
                />
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if stuck.length > 0}
    <p class="warn small" data-ui="transitions.stuck">{tr('ui.transitions.stuck', { statuses: stuck.map((status) => statusStyle(status).text).join(', ') })}</p>
  {/if}
  <div class="row wrap">
    <Button variant="primary" ui="transitions.save" onclick={save}>{tr('ui.save')}</Button>
    <Button variant="ghost" ui="transitions.reset" onclick={() => (matrix = copy(DEFAULT_TRANSITIONS))}>{tr('ui.status.reset')}</Button>
  </div>
</div>

<style>
  .scroll { overflow-x: auto; }
  .matrix { border-collapse: collapse; font-size: var(--text-s); }
  th, td { padding: var(--space-1) var(--space-2); text-align: center; border-bottom: 1px solid var(--border); }
  th[scope='row'] { text-align: start; white-space: nowrap; }
  td input { width: 20px; height: 20px; }
</style>
