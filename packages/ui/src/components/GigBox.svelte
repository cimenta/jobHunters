<script lang="ts">
  import { api } from '../api';
  import { tr } from '../lib/i18n.svelte';
  import { notifyError } from '../lib/notify';
  import { invalidate } from '../state/invalidate.svelte';

  /**
   * The Gig checkbox of a job as one cell of the facts grid (put it inside the `dl`); a click is saved at once, like the
   * Remote and Hybrid boxes. A gig is short-term work: ticking it adds the field for its shift.
   */
  let { jobId, isGig, ui }: { jobId: string; isGig: boolean; ui: string } = $props();

  async function change(box: HTMLInputElement, was: boolean): Promise<void> {
    try {
      await api.updateJob(jobId, { is_gig: box.checked });
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
  </dd>
</div>

<style>
  .fact { min-width: 0; }
  dd { margin: 0; }
  .check { display: flex; align-items: center; gap: var(--space-1); min-height: 1.75rem; }
</style>
