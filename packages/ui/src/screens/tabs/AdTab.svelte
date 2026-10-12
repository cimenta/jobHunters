<script lang="ts">
  import type { ApplicationDetail } from '../../api/types';
  import Icon from '../../components/Icon.svelte';
  import { formatSalary, safeHttpUrl } from '../../lib/format';
  import { tr } from '../../lib/i18n.svelte';

  let { detail }: { detail: ApplicationDetail } = $props();

  const job = $derived(detail.job);
  const summary = $derived(
    job ? [job.title, detail.company?.name ?? '', job.location, formatSalary(job)].filter((part) => part !== '').join(' · ') : '',
  );
</script>

<div class="stack" data-ui="ad">
  {#if job}
    <p class="muted small">{summary}</p>
    {#if job.description === ''}
      <p class="muted">{tr('ui.app.adEmpty')}</p>
    {:else}
      <div class="text" style="white-space: pre-wrap">{job.description}</div>
    {/if}
    {#if safeHttpUrl(job.url) !== ''}
      <a href={safeHttpUrl(job.url)} target="_blank" rel="noopener noreferrer" class="row"><Icon name="external" size={16} />{tr('ui.job.open')}</a>
    {/if}
  {:else}
    <p class="muted">{tr('ui.app.adEmpty')}</p>
  {/if}
</div>

<style>
  .text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: 60vh;
    overflow-y: auto;
  }
</style>
