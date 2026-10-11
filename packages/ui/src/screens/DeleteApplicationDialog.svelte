<script lang="ts">
  import { api } from '../api';
  import type { Application } from '../api/types';
  import Button from '../components/Button.svelte';
  import Dialog from '../components/Dialog.svelte';
  import { describeWarning } from '../lib/errors';
  import { tr } from '../lib/i18n.svelte';
  import { paths } from '../lib/route';
  import { navigate } from '../lib/router.svelte';
  import { invalidate } from '../state/invalidate.svelte';
  import { toast } from '../state/toast.svelte';

  interface Props {
    open: boolean;
    application: Application;
    onclose: () => void;
  }
  let { open, application, onclose }: Props = $props();

  let trashFolder = $state(true);

  $effect(() => {
    if (open) trashFolder = true;
  });

  async function confirm(): Promise<void> {
    const result = await api.deleteApplication(application.id, trashFolder);
    invalidate();
    toast.success(tr('ui.deleteApp.done'));
    for (const warning of result.warnings) toast.warning(describeWarning(warning));
    onclose();
    navigate(paths.applications);
  }
</script>

<Dialog {open} title={tr('ui.deleteApp.title')} {onclose} ui="delete-application-dialog">
  <div class="stack">
    <p>{tr('ui.deleteApp.text', { label: application.label })}</p>
    {#if application.folder_url !== ''}
      <label class="check"><input type="checkbox" bind:checked={trashFolder} />{tr('ui.deleteApp.trash')}</label>
    {/if}
  </div>
  {#snippet footer()}
    <Button onclick={onclose}>{tr('ui.cancel')}</Button>
    <Button variant="danger" ui="delete-application.confirm" onclick={confirm}>{tr('ui.delete')}</Button>
  {/snippet}
</Dialog>

<style>
  .check { display: flex; align-items: center; gap: var(--space-2); min-height: var(--tap); }
</style>
