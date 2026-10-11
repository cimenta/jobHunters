<script lang="ts">
  import type { Snippet } from 'svelte';

  let { hasDetail, list, detail }: { hasDetail: boolean; list: Snippet; detail?: Snippet } = $props();
</script>

<div class="md" class:has-detail={hasDetail}>
  <div class="list-pane">{@render list()}</div>
  {#if hasDetail}<div class="detail-pane">{@render detail?.()}</div>{/if}
</div>

<style>
  .md { min-width: 0; }
  .has-detail .list-pane { display: none; }
  .list-pane, .detail-pane { min-width: 0; }
  @media (min-width: 1024px) {
    .md.has-detail { display: grid; grid-template-columns: minmax(300px, 380px) minmax(0, 1fr); gap: var(--space-5); align-items: start; }
    .has-detail .list-pane { display: block; }
  }
</style>
