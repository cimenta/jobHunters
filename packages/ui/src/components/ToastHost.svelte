<script lang="ts">
  import { tr } from '../lib/i18n.svelte';
  import { dismissToast, toasts } from '../state/toast.svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
</script>

<div class="host" aria-live="polite" data-ui="toasts">
  {#each toasts as item (item.id)}
    <div class="toast {item.kind}" role={item.kind === 'error' ? 'alert' : 'status'}>
      <Icon name={item.kind === 'success' ? 'check' : 'alert'} size={18} />
      <span class="grow">{item.text}</span>
      <Button variant="ghost" label={tr('ui.close')} onclick={() => dismissToast(item.id)}><Icon name="close" size={16} /></Button>
    </div>
  {/each}
</div>

<style>
  .host { position: fixed; left: var(--space-4); right: var(--space-4); bottom: calc(var(--space-4) + 64px); z-index: 60; display: flex; flex-direction: column; gap: var(--space-2); pointer-events: none; }
  .toast { display: flex; align-items: center; gap: var(--space-3); max-width: 480px; margin: 0 auto; width: 100%; padding: var(--space-2) var(--space-3); color: var(--text); background: var(--surface); border: 1px solid var(--border); border-left: 4px solid var(--success); border-radius: var(--radius-s); box-shadow: var(--shadow-2); pointer-events: auto; }
  .toast.error { border-left-color: var(--danger); }
  .toast.warning { border-left-color: var(--warning); }
  @media (min-width: 640px) { .host { left: auto; right: var(--space-4); bottom: var(--space-4); width: 380px; } }
</style>
