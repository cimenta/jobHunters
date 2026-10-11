<script lang="ts">
  interface Item {
    id: string;
    label: string;
    count?: number;
  }
  let { items, active = $bindable(), label }: { items: Item[]; active: string; label: string } = $props();

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

<div class="tabs" role="tablist" aria-label={label} data-ui="tabs">
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
      {item.label}{#if item.count !== undefined}<span class="count">{item.count}</span>{/if}
    </button>
  {/each}
</div>

<style>
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
