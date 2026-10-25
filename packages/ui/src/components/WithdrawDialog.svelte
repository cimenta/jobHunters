<script lang="ts">
  import type { ApplicationRow } from '../api/types';
  import { tr } from '../lib/i18n.svelte';
  import { statusStyle } from '../lib/status';
  import Button from './Button.svelte';
  import Dialog from './Dialog.svelte';
  import StatusBadge from './StatusBadge.svelte';

  interface Props {
    open: boolean;
    jobTitle: string;
    /** Status the ad is being set to, as the user named it. */
    jobStatusText: string;
    applications: readonly ApplicationRow[];
    /** Cancel: nothing was changed. */
    onclose: () => void;
    /** `true` = also move the applications to Withdrawn. The ad gets its status either way. */
    onchoose: (withdraw: boolean) => Promise<unknown> | unknown;
    ui?: string;
  }
  let { open, jobTitle, jobStatusText, applications, onclose, onchoose, ui = 'withdraw-dialog' }: Props = $props();

  async function choose(withdraw: boolean): Promise<void> {
    await onchoose(withdraw);
    onclose();
  }
</script>

<Dialog {open} title={tr('ui.job.withdrawTitle')} {onclose} {ui}>
  <p>{tr('ui.job.withdrawIntro', { title: jobTitle, status: jobStatusText })}</p>
  <ul class="list" data-ui="{ui}.list">
    {#each applications as application (application.id)}
      <li class="list-item" data-ui="{ui}.application.{application.id}"><span class="grow">{application.label}</span><StatusBadge status={application.status} /></li>
    {/each}
  </ul>
  <p>{tr('ui.job.withdrawAsk', { status: statusStyle('withdrawn').text })}</p>
  {#snippet footer()}
    <Button ui="{ui}.cancel" onclick={onclose}>{tr('ui.cancel')}</Button>
    <Button ui="{ui}.keep" onclick={() => choose(false)}>{tr('ui.job.withdrawKeep')}</Button>
    <Button ui="{ui}.withdraw" variant="primary" onclick={() => choose(true)}>{tr('ui.job.withdrawThem')}</Button>
  {/snippet}
</Dialog>

<style>
  .list { padding: 0; margin: 0 0 var(--space-3); list-style: none; }
  .list-item { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-1) 0; }
  .grow { flex: 1; }
</style>
