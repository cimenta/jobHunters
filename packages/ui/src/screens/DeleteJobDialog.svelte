<script lang="ts">
  import { api } from '../api';
  import Button from '../components/Button.svelte';
  import Dialog from '../components/Dialog.svelte';
  import { describeWarning } from '../lib/errors';
  import { shorten } from '../lib/format';
  import { tr } from '../lib/i18n.svelte';
  import { invalidate } from '../state/invalidate.svelte';
  import { toast } from '../state/toast.svelte';

  interface Props {
    open: boolean;
    job: { id: string; title: string; folder_url: string };
    onclose: () => void;
    /** Called after the job is gone (the detail goes back to the list). */
    ondeleted?: () => void;
  }
  let { open, job, onclose, ondeleted }: Props = $props();

  let trashFolder = $state(true);
  let busy = $state(false);

  $effect(() => {
    if (open) trashFolder = true;
  });

  async function confirm(): Promise<void> {
    busy = true;
    try {
      const result = await api.deleteJob(job.id, job.folder_url !== '' && trashFolder);
      const title = shorten(job.title, 60);
      toast.success(result.folderTrashed ? tr('ui.deleteJob.doneTrashed', { title }) : tr('ui.job.deleted', { title }));
      for (const warning of result.warnings) toast.warning(describeWarning(warning));
      invalidate();
      onclose();
      ondeleted?.();
    } finally {
      busy = false;
    }
  }
</script>

<Dialog {open} title={tr('ui.deleteJob.title')} {onclose} ui="delete-job-dialog">
  <div class="stack">
    <p>{tr('ui.deleteJob.text', { title: job.title })}</p>
    {#if job.folder_url !== ''}
      <label class="check">
        <input data-ui="delete-job.trash-folder" type="checkbox" bind:checked={trashFolder} />
        <span>{tr('ui.deleteJob.trash')}<br /><span class="muted small">{tr('ui.deleteJob.trashHint')}</span></span>
      </label>
    {/if}
  </div>
  {#snippet footer()}
    <Button ui="delete-job.cancel" onclick={onclose}>{tr('ui.cancel')}</Button>
    <Button variant="danger" ui="delete-job.confirm" disabled={busy} onclick={confirm}>{tr('ui.delete')}</Button>
  {/snippet}
</Dialog>

<style>
  .check { display: flex; align-items: flex-start; gap: var(--space-2); min-height: var(--tap); }
  .check input { margin-top: 4px; }
</style>
