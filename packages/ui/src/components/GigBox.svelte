<script lang="ts">
  import { api } from '../api';
  import { tr } from '../lib/i18n.svelte';
  import { notifyError } from '../lib/notify';
  import { invalidate } from '../state/invalidate.svelte';

  /**
   * The Gig checkbox of a job as one cell of the facts grid (put it inside the `dl`); a click is saved at once, like the
   * Remote and Hybrid boxes. A gig is short-term work: ticking it adds the field for its shift and the High priority box.
   */
  let { jobId, isGig, isPriority = false, ui }: { jobId: string; isGig: boolean; isPriority?: boolean; ui: string } = $props();

  async function change(box: HTMLInputElement, was: boolean, patch: 'is_gig' | 'gig_priority' = 'is_gig'): Promise<void> {
    try {
      await api.updateJob(jobId, { [patch]: box.checked });
    } catch (error) {
      box.checked = was;
      notifyError(error);
    }
    invalidate();
  }
</script>

<div class="fact" data-ui="{ui}.gig-box">
  <dt class="muted small">{tr('ui.job.info.kind')}</dt>
  <dd>
    <label class="check"><input data-ui="{ui}.gig-box.gig" type="checkbox" checked={isGig} onchange={(event) => change(event.currentTarget, isGig)} />{tr('ui.job.gig')}</label>
    {#if isGig}
      <label class="check"><input data-ui="{ui}.gig-box.priority" type="checkbox" checked={isPriority} onchange={(event) => change(event.currentTarget, isPriority, 'gig_priority')} />{tr('ui.job.gigPriority')}</label>
    {/if}
  </dd>
</div>

<style>
  .fact { min-width: 0; }
  dd { margin: 0; }
  .check { display: flex; align-items: center; gap: var(--space-1); min-height: 1.75rem; }
</style>
