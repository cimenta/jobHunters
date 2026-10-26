<script lang="ts">
  import { api } from '../api';
  import { tr } from '../lib/i18n.svelte';
  import { notifyError } from '../lib/notify';
  import { invalidate } from '../state/invalidate.svelte';

  /**
   * The Remote, Hybrid and Contract only checkboxes of a job as one cell of the facts grid (put it inside the `dl`); a click is saved at
   * once. They belong to the job, so every screen that shows them edits the same value.
   */
  let { jobId, isRemote, isHybrid, isContract = false, ui }: { jobId: string; isRemote: boolean; isHybrid: boolean; isContract?: boolean; ui: string } = $props();

  async function change(patch: { is_remote?: boolean; is_hybrid?: boolean; is_contract?: boolean }, box: HTMLInputElement, was: boolean): Promise<void> {
    try {
      await api.updateJob(jobId, patch);
    } catch (error) {
      box.checked = was;
      notifyError(error);
    }
    invalidate();
  }
</script>

<div class="fact" role="group" aria-label={tr('ui.job.info.workMode')} data-ui="{ui}.work-mode">
  <dt class="muted small">{tr('ui.job.info.workMode')}</dt>
  <dd>
    <label class="check"><input data-ui="{ui}.work-mode.remote" type="checkbox" checked={isRemote} onchange={(event) => change({ is_remote: event.currentTarget.checked }, event.currentTarget, isRemote)} />{tr('ui.job.remote')}</label>
    <label class="check"><input data-ui="{ui}.work-mode.hybrid" type="checkbox" checked={isHybrid} onchange={(event) => change({ is_hybrid: event.currentTarget.checked }, event.currentTarget, isHybrid)} />{tr('ui.job.hybrid')}</label>
    <label class="check"><input data-ui="{ui}.work-mode.contract" type="checkbox" checked={isContract} onchange={(event) => change({ is_contract: event.currentTarget.checked }, event.currentTarget, isContract)} />{tr('ui.job.contractOnly')}</label>
  </dd>
</div>

<style>
  .fact { min-width: 0; }
  dd { margin: 0; display: flex; flex-wrap: wrap; gap: 0 var(--space-3); }
  .check { display: flex; align-items: center; gap: var(--space-1); min-height: 1.75rem; }
</style>
