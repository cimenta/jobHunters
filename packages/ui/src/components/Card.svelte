<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children, class: extra = '', ui }: { children?: Snippet; class?: string; ui?: string } = $props();
</script>

<section class="card {extra}" data-ui={ui}>{@render children?.()}</section>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
    padding: var(--space-4);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-m);
    box-shadow: var(--shadow-1);
  }
</style>
