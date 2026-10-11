<script lang="ts">
  import { tr } from '../lib/i18n.svelte';

  let { lines = 3 }: { lines?: number } = $props();
</script>

<div class="skeleton" role="status" aria-label={tr('ui.loading')}>
  {#each Array.from({ length: lines }) as _line, index (index)}
    <div class="line" style:width="{index === lines - 1 ? 60 : 100}%"></div>
  {/each}
</div>

<style>
  .skeleton { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-3) 0; }
  .line { height: 16px; background: linear-gradient(90deg, var(--surface-2), var(--border), var(--surface-2)); background-size: 200% 100%; border-radius: var(--radius-s); animation: shimmer 1.4s linear infinite; }
  @keyframes shimmer { to { background-position: -200% 0; } }
</style>
