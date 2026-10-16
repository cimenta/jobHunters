<script lang="ts">
  import type { AiTask } from '@jobhunters/core';
  import { api } from '../../api';
  import Button from '../../components/Button.svelte';
  import { tr } from '../../lib/i18n.svelte';
  import { matchStatusText as statusText } from '../../lib/match-status';
  import { notifyError } from '../../lib/notify';
  import { toast } from '../../state/toast.svelte';
  import { paths } from '../../lib/route';
  import { app } from '../../state/app.svelte';
  import { invalidate } from '../../state/invalidate.svelte';

  /** Apps Script turns a missing value into null, so both mean "no task". */
  let { jobId, jobTitle = '', match }: { jobId: string; jobTitle?: string; match: AiTask | null | undefined } = $props();

  const hasExperience = $derived((app.settings?.candidate_experience ?? '').trim() !== '');
  const waiting = $derived(match?.status === 'pending');
  const running = $derived(match?.status === 'in_progress');
  /** A finished task leaves the box unchecked, so ticking it asks for a fresh evaluation. */
  const active = $derived(waiting || running);

  async function toggle(checked: boolean): Promise<void> {
    try {
      if (checked) {
        await api.requestJobMatch(jobId);
        toast.success(tr('ui.match.requested', { title: jobTitle }));
      } else if (match && waiting) {
        await api.cancelAiTask(match.id);
        toast.success(tr('ui.match.cancelled', { title: jobTitle }));
      }
    } catch (error) {
      notifyError(error);
    } finally {
      invalidate();
    }
  }
</script>

<div class="stack" data-ui="job-detail.match">
  {#if !hasExperience && !active}
    <p class="muted">{tr('ui.match.noExperience')}</p>
    <div><a href={paths.settings} data-ui="job-detail.match.settings">{tr('ui.match.openSettings')}</a></div>
  {:else}
    <label class="check" data-ui="job-detail.match.request">
      <input data-ui="job-detail.match.toggle" type="checkbox" checked={active} disabled={running} onchange={(event) => toggle(event.currentTarget.checked)} />
      {tr('ui.match.request')}
    </label>
    {#if match}
      <p class="muted small" data-ui="job-detail.match.status">{statusText(match)}</p>
      {#if match.ai_note !== ''}
        <p class="note" data-ui="job-detail.match.text">{match.ai_note}</p>
      {/if}
      <div class="row wrap">
        <Button variant="ghost" ui="job-detail.match.refresh" onclick={invalidate}>{tr('ui.retry')}</Button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .check { display: flex; align-items: center; gap: var(--space-2); min-height: var(--tap); }
  .note { white-space: pre-wrap; }
</style>
