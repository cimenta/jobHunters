<script lang="ts">
  import { onMount } from 'svelte';
  import ErrorBlock from './components/ErrorBlock.svelte';
  import Skeleton from './components/Skeleton.svelte';
  import IdOverlay from './components/IdOverlay.svelte';
  import ToastHost from './components/ToastHost.svelte';
  import Shell from './layout/Shell.svelte';
  import Router from './screens/Router.svelte';
  import { app, loadApp } from './state/app.svelte';
  import { ids, setIdsVisible } from './state/ids.svelte';

  onMount(() => {
    void loadApp();
  });

  // Alt+Shift+I shows or hides the identifier labels.
  function onkeydown(event: KeyboardEvent): void {
    if (event.altKey && event.shiftKey && event.code === 'KeyI') setIdsVisible(!ids.visible);
  }
</script>

<svelte:window {onkeydown} />

{#if app.phase === 'ready'}
  <Shell><Router /></Shell>
{:else if app.phase === 'error'}
  <main class="startup"><ErrorBlock error={app.error} onretry={loadApp} /></main>
{:else}
  <main class="startup"><Skeleton lines={4} /></main>
{/if}
<ToastHost />
<IdOverlay />

<style>
  .startup { max-width: 480px; margin: 0 auto; padding: var(--space-6) var(--space-4); }
</style>
