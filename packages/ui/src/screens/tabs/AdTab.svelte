<script lang="ts">
  import type { ApplicationDetail } from '../../api/types';
  import Button from '../../components/Button.svelte';
  import Icon from '../../components/Icon.svelte';
  import { formatSalary, safeHttpUrl } from '../../lib/format';
  import { tr } from '../../lib/i18n.svelte';
  import MatchDialog from './MatchDialog.svelte';

  let { detail }: { detail: ApplicationDetail } = $props();

  const job = $derived(detail.job);
  const summary = $derived(
    job ? [job.title, detail.company?.name ?? '', job.location, formatSalary(job)].filter((part) => part !== '').join(' · ') : '',
  );
  const percent = $derived(job?.match_percent);
  const hasMatch = $derived(typeof percent === 'number' || !!detail.match);
  let showing = $state(false);
</script>

<div class="stack" data-ui="ad">
  {#if job}
    <div class="top">
      <p class="muted small summary">{summary}</p>
      <Button ui="ad.match" variant={hasMatch ? 'secondary' : 'ghost'} onclick={() => (showing = true)}>
        <Icon name="sparkle" size={16} />{typeof percent === 'number' ? tr('jobStatus.match', { percent }) : tr('ui.app.matchButton')}
      </Button>
    </div>
    <MatchDialog open={showing} jobTitle={job.title} {percent} match={detail.match} onclose={() => (showing = false)} />
    {#if job.description === ''}
      <p class="muted">{tr('ui.app.adEmpty')}</p>
    {:else}
      <div class="text" style="white-space: pre-wrap">{job.description}</div>
    {/if}
    {#if safeHttpUrl(job.url) !== ''}
      <a data-ui="ad.link" href={safeHttpUrl(job.url)} target="_blank" rel="noopener noreferrer" class="row"><Icon name="external" size={16} />{tr('ui.job.open')}</a>
    {/if}
  {:else}
    <p class="muted">{tr('ui.app.adEmpty')}</p>
  {/if}
</div>

<style>
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); }
  .summary { margin: 0; min-width: 0; overflow-wrap: anywhere; }
  .text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: 60vh;
    overflow-y: auto;
  }
</style>
