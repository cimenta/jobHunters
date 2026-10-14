<script lang="ts">
  import type { ApplicationRow } from '../api/types';
  import { matchOf, sortExtra } from '../lib/application-facts';
  import { formatSalary } from '../lib/format';
  import { tr } from '../lib/i18n.svelte';
  import Badge from './Badge.svelte';

  let { row, by, ui, now }: { row: ApplicationRow; by: string; ui: string; now: number } = $props();

  const match = $derived(matchOf(row));
  const salary = $derived(formatSalary(row));
  const extra = $derived(sortExtra(row, by, now));
</script>

<span class="facts" data-ui="{ui}.facts">
  <span data-ui="{ui}.match">
    {#if match === undefined}
      <Badge text={tr('ui.apps.noMatch')} color="var(--surface-2)" textColor="var(--text-muted)" />
    {:else if match >= 70}
      <Badge text={tr('jobStatus.match', { percent: String(match) })} color="var(--success-soft)" textColor="var(--success)" />
    {:else}
      <Badge text={tr('jobStatus.match', { percent: String(match) })} color="var(--warning-soft)" textColor="var(--warning)" />
    {/if}
  </span>
  <span class="small" class:muted={salary === ''} data-ui="{ui}.salary">{salary === '' ? tr('ui.apps.noSalary') : salary}</span>
</span>
{#if extra !== ''}<span class="small extra" data-ui="{ui}.extra">{extra}</span>{/if}

<style>
  .facts { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
  .extra { color: var(--accent); font-weight: 600; }
</style>
