<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon, { type IconName } from './Icon.svelte';

  let { icon = 'search', title, text, children, ui }: { icon?: IconName; title: string; text?: string; children?: Snippet; ui?: string } = $props();
</script>

<div class="empty" data-ui={ui}>
  <span class="icon"><Icon name={icon} size={28} /></span>
  <h3>{title}</h3>
  {#if text}<p class="muted">{text}</p>{/if}
  {#if children}<div class="action">{@render children()}</div>{/if}
</div>

<style>
  .empty { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-6) var(--space-4); text-align: center; }
  .icon { color: var(--text-muted); }
  .action { margin-top: var(--space-2); }
</style>
