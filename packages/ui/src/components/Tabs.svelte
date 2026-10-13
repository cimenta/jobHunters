<script lang="ts">
  import { tr } from '../lib/i18n.svelte';
  interface Item {
    id: string;
    label: string;
    count?: number;
    /** A red exclamation mark: something on this tab needs the user. */
    alert?: boolean;
  }
  let { items, active = $bindable(), label, ui = 'tabs' }: { items: Item[]; active: string; label: string; ui?: string } = $props();

  function onkeydown(event: KeyboardEvent, index: number): void {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    const next = items[(index + step + items.length) % items.length];
    if (!next) return;
    event.preventDefault();
    active = next.id;
    document.getElementById(`tab-${next.id}`)?.focus();
  }
</script>

<div class="tabs" role="tablist" aria-label={label} data-ui={ui}>
  {#each items as item, index (item.id)}
    <button
      role="tab"
      id="tab-{item.id}"
      data-ui="tab.{item.id}"
      aria-selected={active === item.id}
      aria-controls="panel-{item.id}"
      tabindex={active === item.id ? 0 : -1}
      class:active={active === item.id}
      onclick={() => (active = item.id)}
      onkeydown={(event) => onkeydown(event, index)}
    >
      {item.label}{#if item.count !== undefined}<span class="count">{item.count}</span>{/if}{#if item.alert}<span class="alert" data-ui="tab.{item.id}.alert" role="img" aria-label={tr('ui.settings.tabAlert')}>!</span>{/if}
    </button>
  {/each}
</div>

<style>
  .alert { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; margin-left: var(--space-2); border-radius: 50%; background: var(--danger); color: #fff; font-size: 0.7rem; font-weight: 800; }
  .tabs { display: flex; gap: var(--space-1); overflow-x: auto; border-bottom: 1px solid var(--border); scrollbar-width: thin; }
  button {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--tap);
    padding: 0 var(--space-4);
    font: inherit;
    font-weight: 600;
    color: var(--text-muted);
    white-space: nowrap;
    background: none;
    border: 0;
    border-bottom: 3px solid transparent;
    cursor: pointer;
  }
  button.active { color: var(--accent); border-bottom-color: var(--accent); }
  .count { padding: 0 var(--space-2); font-size: var(--text-s); color: var(--text); background: var(--surface-2); border-radius: 999px; }
</style>
