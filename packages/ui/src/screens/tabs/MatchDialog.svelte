<script lang="ts">
  import type { AiTask } from '@jobhunters/core';
  import Badge from '../../components/Badge.svelte';
  import Button from '../../components/Button.svelte';
  import Dialog from '../../components/Dialog.svelte';
  import { matchColor } from '../../lib/job-facts';
  import { tr } from '../../lib/i18n.svelte';
  import { matchStatusText } from '../../lib/match-status';

  /** The AI's evaluation of how well the job fits: the percentage and the text the AI wrote. A missing task means no evaluation was asked for. */
  let { open, jobTitle, percent, match, onclose }: { open: boolean; jobTitle: string; percent: number | null | undefined; match: AiTask | null | undefined; onclose: () => void } = $props();

  const note = $derived((match?.ai_note ?? '').trim());
</script>

<Dialog {open} title={tr('ui.app.matchTitle')} {onclose} ui="match-dialog">
  <div class="stack">
    <div class="row wrap">
      {#if typeof percent === 'number'}
        <Badge ui="match-dialog.percent" text={tr('jobStatus.match', { percent })} color={matchColor(percent)} textColor="var(--text)" />
      {/if}
      <span class="muted small" data-ui="match-dialog.job">{jobTitle}</span>
    </div>
    {#if !match}
      <p class="muted" data-ui="match-dialog.none">{tr('ui.app.matchNone')}</p>
    {:else}
      <p class="muted small" data-ui="match-dialog.status">{matchStatusText(match)}</p>
      {#if note !== ''}
        <div class="note" data-ui="match-dialog.text">{note}</div>
      {:else if match.status === 'done'}
        <p class="muted" data-ui="match-dialog.empty">{tr('ui.app.matchNoText')}</p>
      {/if}
    {/if}
  </div>
  {#snippet footer()}
    <Button ui="match-dialog.close" onclick={onclose}>{tr('ui.close')}</Button>
  {/snippet}
</Dialog>

<style>
  .note { white-space: pre-wrap; overflow-wrap: anywhere; border-top: 1px solid var(--border); padding-top: var(--space-3); }
</style>
