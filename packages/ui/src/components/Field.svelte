<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label: string;
    for: string;
    hint?: string;
    error?: string;
    /** Show the hint in the warning colour (for example "not found, please fill in"). */
    warn?: boolean;
    children: Snippet;
  }
  let { label, for: controlId, hint, error, warn = false, children }: Props = $props();
</script>

<div class="field">
  <label for={controlId}>{label}</label>
  {@render children()}
  {#if hint}<p class="hint" class:warn>{hint}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
  .field { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
  label { font-weight: 600; font-size: var(--text-s); }
  .hint { color: var(--text-muted); font-size: var(--text-s); }
  .hint.warn { color: var(--warning); font-weight: 600; }
  .error { color: var(--danger); font-size: var(--text-s); }
</style>
