<script lang="ts">
  import type { AppWarning } from '@jobhunters/core';
  import { describeWarning } from '../lib/errors';
  import Icon from './Icon.svelte';

  let { warnings }: { warnings: AppWarning[] } = $props();
</script>

{#if warnings.length > 0}
  <ul class="warnings">
    {#each warnings as warning, index (index)}
      <li><Icon name="alert" size={18} /><span>{describeWarning(warning)}</span></li>
    {/each}
  </ul>
{/if}

<style>
  .warnings { display: flex; flex-direction: column; gap: var(--space-2); padding: 0; margin: 0; list-style: none; }
  li { display: flex; gap: var(--space-2); padding: var(--space-3); color: var(--warning); background: var(--warning-soft); border-radius: var(--radius-s); }
  span { color: var(--text); }
</style>
