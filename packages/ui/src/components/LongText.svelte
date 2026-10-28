<script lang="ts">
  import { tr } from '../lib/i18n.svelte';

  /**
   * A text that keeps its line breaks and is cut to a few lines while it is long (the text of an e-mail kept in an entry);
   * a button shows all of it or folds it again.
   */
  let { text, ui, limit = 600, lines = 8 }: { text: string; ui?: string; limit?: number; lines?: number } = $props();

  const long = $derived(text.length > limit || text.split('\n').length > lines);
  let open = $state(false);
</script>

<div class="long" data-ui={ui}>
  <p class="text muted" class:folded={long && !open} style:--lines={lines} data-ui={ui ? `${ui}.text` : undefined}>{text}</p>
  {#if long}
    <button type="button" class="more" data-ui={ui ? `${ui}.toggle` : undefined} aria-expanded={open} onclick={() => (open = !open)}>{open ? tr('ui.longText.less') : tr('ui.longText.more')}</button>
  {/if}
</div>

<style>
  .long { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-1); min-width: 0; }
  .text { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .text.folded { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: var(--lines); line-clamp: var(--lines); overflow: hidden; }
  .more { padding: 0; font: inherit; font-size: var(--text-s); color: var(--accent); background: none; border: 0; cursor: pointer; }
</style>
