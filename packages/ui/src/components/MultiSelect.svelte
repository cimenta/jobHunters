<script lang="ts">
  import { tr } from '../lib/i18n.svelte';

  interface Option {
    value: string;
    text: string;
  }
  interface Props {
    options: Option[];
    selected: string[];
    label: string;
    /** Shown while nothing is selected, which means everything. */
    allLabel: string;
    onchange: (next: string[]) => void;
    ui?: string;
  }
  let { options, selected, label, allLabel, onchange, ui }: Props = $props();

  const summary = $derived(selected.length === 0 ? allLabel : options.filter((option) => selected.includes(option.value)).map((option) => option.text).join(', '));

  function toggle(value: string, checked: boolean): void {
    const rest = selected.filter((item) => item !== value);
    onchange(checked ? options.map((option) => option.value).filter((item) => item === value || rest.includes(item)) : rest);
  }
</script>

<div class="field">
  <span class="label">{label}</span>
  <details class="multi" data-ui={ui}>
    <summary class="input" data-ui={ui ? `${ui}.summary` : undefined}>{summary}</summary>
    <div class="panel" role="group" aria-label={label}>
      {#each options as option (option.value)}
        <label class="check"><input data-ui={ui ? `${ui}.option.${option.value}` : undefined} type="checkbox" checked={selected.includes(option.value)} onchange={(event) => toggle(option.value, event.currentTarget.checked)} />{option.text}</label>
      {/each}
      {#if selected.length > 0}
        <button data-ui={ui ? `${ui}.clear` : undefined} type="button" class="clear" onclick={() => onchange([])}>{tr('ui.multi.clear')}</button>
      {/if}
    </div>
  </details>
</div>

<style>
  .field { display: flex; flex-direction: column; gap: var(--space-1); }
  .label { font-size: var(--text-s); font-weight: 600; }
  .multi { position: relative; }
  summary { cursor: pointer; min-height: var(--tap); display: flex; align-items: center; list-style: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .panel { position: absolute; z-index: 5; inset-inline: 0; margin-top: var(--space-1); padding: var(--space-2); display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-m); box-shadow: var(--shadow-2, 0 4px 16px rgb(0 0 0 / 0.15)); }
  .check { display: flex; align-items: center; gap: var(--space-2); min-height: var(--tap); }
  .clear { align-self: flex-start; margin-top: var(--space-1); background: none; border: 0; color: var(--accent); cursor: pointer; padding: var(--space-1) 0; min-height: var(--tap); }
</style>
