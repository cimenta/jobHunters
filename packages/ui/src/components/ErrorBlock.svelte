<script lang="ts">
  import { describeError } from '../lib/errors';
  import { tr } from '../lib/i18n.svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  let { error, onretry }: { error: unknown; onretry?: () => unknown } = $props();
</script>

<div class="error" role="alert">
  <Icon name="alert" size={24} />
  <p>{describeError(error)}</p>
  {#if onretry}<Button onclick={onretry}><Icon name="refresh" size={16} />{tr('ui.retry')}</Button>{/if}
</div>

<style>
  .error { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); padding: var(--space-5); text-align: center; color: var(--danger); background: var(--danger-soft); border-radius: var(--radius-m); }
  .error p { color: var(--text); }
</style>
