<script lang="ts">
  import { api } from '../api';
  import type { Job } from '@jobhunters/core';
  import { formatSalary } from '../lib/format';
  import { tr } from '../lib/i18n.svelte';
  import { notifyError } from '../lib/notify';
  import { invalidate } from '../state/invalidate.svelte';
  import Icon from './Icon.svelte';

  /**
   * The salary of the ad as one cell of the facts grid (put it inside the `dl`); it is shown even when empty. A
   * double-click, the pencil or Enter on the text turns it into four fields (from, to, currency, per); Enter in a field
   * or Save stores them, Escape or Cancel leaves everything as it was. Empty from and to clear the salary.
   */
  let { job, ui }: { job: Pick<Job, 'id' | 'salary_min' | 'salary_max' | 'salary_currency' | 'salary_period'>; ui: string } = $props();

  const PERIODS = ['hour', 'day', 'week', 'month', 'year'] as const;
  const shown = $derived(formatSalary(job));

  let editing = $state(false);
  let saving = $state(false);
  let min = $state('');
  let max = $state('');
  let currency = $state('');
  let period = $state('');

  function edit(): void {
    min = job.salary_min == null ? '' : String(job.salary_min);
    max = job.salary_max == null ? '' : String(job.salary_max);
    currency = job.salary_currency ?? '';
    period = job.salary_period ?? '';
    editing = true;
  }

  function focusOnMount(node: HTMLInputElement): void {
    node.focus();
    node.select();
  }

  async function save(): Promise<void> {
    if (saving) return;
    saving = true;
    try {
      await api.updateJob(job.id, { salary_min: min, salary_max: max, salary_currency: currency, salary_period: period });
      editing = false;
    } catch (error) {
      notifyError(error);
    } finally {
      saving = false;
      invalidate();
    }
  }

  function key(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      void save();
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      editing = false;
    }
  }
</script>

<div class="fact" class:editing data-ui={ui}>
  <dt class="muted small">{tr('ui.job.info.salary')}{#if !editing}
    <button type="button" class="pencil" data-ui="{ui}.edit" aria-label={tr('ui.job.salaryEdit')} title={tr('ui.job.salaryEdit')} onclick={edit}><Icon name="edit" size={14} /></button>
  {/if}</dt>
  <dd>
    {#if editing}
      <div class="fields" role="group" aria-label={tr('ui.job.info.salary')}>
        <label class="f">{tr('ui.job.salaryMin')}<input class="input" data-ui="{ui}.min" inputmode="decimal" bind:value={min} use:focusOnMount onkeydown={key} /></label>
        <label class="f">{tr('ui.job.salaryMax')}<input class="input" data-ui="{ui}.max" inputmode="decimal" bind:value={max} onkeydown={key} /></label>
        <label class="f narrow">{tr('ui.job.currency')}<input class="input" data-ui="{ui}.currency" maxlength="3" bind:value={currency} onkeydown={key} /></label>
        <label class="f">{tr('ui.job.period')}
          <select class="input" data-ui="{ui}.period" bind:value={period} onkeydown={key}>
            <option value=""></option>
            {#each PERIODS as option (option)}<option value={option}>{tr(`ui.period.${option}`)}</option>{/each}
          </select>
        </label>
      </div>
      <div class="buttons">
        <button type="button" class="btn" data-ui="{ui}.save" disabled={saving} onclick={save}>{tr('ui.save')}</button>
        <button type="button" class="btn" data-ui="{ui}.cancel" onclick={() => (editing = false)}>{tr('ui.cancel')}</button>
      </div>
    {:else}
      <span
        class="text"
        class:empty={shown === ''}
        role="button"
        tabindex="0"
        data-ui="{ui}.text"
        title={shown === '' ? tr('ui.inline.add') : tr('ui.inline.edit')}
        ondblclick={edit}
        onkeydown={(event) => {
          if (event.key === 'Enter') edit();
        }}
      >{shown === '' ? tr('ui.inline.add') : shown}</span>
    {/if}
  </dd>
</div>

<style>
  .fact { min-width: 0; overflow-wrap: anywhere; }
  .fact.editing { grid-column: 1 / -1; }
  dd { margin: 0; }
  .text { cursor: text; display: inline-block; min-width: 4rem; }
  .text.empty { color: var(--text-muted); }
  .pencil { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; padding: 0; margin-left: var(--space-1); color: var(--text-muted); background: none; border: 0; border-radius: var(--radius-s); cursor: pointer; vertical-align: middle; }
  .pencil:hover { color: var(--text); background: var(--accent-soft); }
  .fields { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .f { display: flex; flex-direction: column; gap: 2px; font-size: var(--text-s); color: var(--text-muted); }
  .f .input { width: 7rem; }
  .f.narrow .input { width: 4.5rem; }
  .buttons { display: flex; gap: var(--space-2); margin-top: var(--space-2); }
</style>
