<script lang="ts">
  import { api } from '../api';
  import Badge from '../components/Badge.svelte';
  import Button from '../components/Button.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import ErrorBlock from '../components/ErrorBlock.svelte';
  import Field from '../components/Field.svelte';
  import Icon from '../components/Icon.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import { filterJobs, type JobFilters } from '../lib/filters';
  import { tr } from '../lib/i18n.svelte';
  import { availabilityLabel } from '../lib/labels';
  import { useResource } from '../lib/resource.svelte';
  import { paths } from '../lib/route';
  import { navigate, router } from '../lib/router.svelte';
  import { invalidate } from '../state/invalidate.svelte';

  const jobs = useResource(() => api.listJobs());
  let text = $state('');
  let availability = $state<JobFilters['availability']>('');
  let gig = $state(false);

  const rows = $derived(filterJobs(jobs.data ?? [], { text, availability, gig }));
  const filtered = $derived(text.trim() !== '' || availability !== '' || gig);

  function clear(): void {
    text = '';
    availability = '';
    gig = false;
  }
</script>

<div class="stack" data-ui="jobs">
  <div class="page-title">
    <h1>{tr('ui.nav.jobs')}</h1>
    <Button variant="primary" ui="jobs.add" onclick={() => navigate(paths.newJob)}><Icon name="plus" size={18} />{tr('ui.jobs.add')}</Button>
  </div>

  {#if jobs.status === 'loading'}
    <Skeleton lines={5} />
  {:else if jobs.status === 'error'}
    <ErrorBlock error={jobs.error} onretry={invalidate} />
  {:else if (jobs.data ?? []).length === 0}
    <EmptyState ui="jobs.empty" icon="briefcase" title={tr('ui.jobs.emptyTitle')} text={tr('ui.jobs.emptyText')}>
      <Button variant="primary" onclick={() => navigate(paths.newJob)}><Icon name="plus" size={18} />{tr('ui.jobs.add')}</Button>
    </EmptyState>
  {:else}
    <div class="filters" data-ui="jobs.filters">
      <Field label={tr('ui.jobs.search')} for="job-search">
        <input id="job-search" data-ui="jobs.search" class="input" type="search" placeholder={tr('ui.jobs.searchPlaceholder')} bind:value={text} />
      </Field>
      <Field label={tr('ui.jobs.availability')} for="job-availability">
        <select id="job-availability" class="input" bind:value={availability}>
          <option value="">{tr('ui.jobs.availabilityAll')}</option>
          <option value="online">{availabilityLabel('online')}</option>
          <option value="offline">{availabilityLabel('offline')}</option>
          <option value="unknown">{availabilityLabel('unknown')}</option>
        </select>
      </Field>
      <label class="check"><input type="checkbox" bind:checked={gig} />{tr('ui.job.gig')}</label>
    </div>

    {#if rows.length === 0}
      <EmptyState title={tr('ui.jobs.noMatchTitle')} text={tr('ui.jobs.noMatchText')}>
        {#if filtered}<Button onclick={clear}>{tr('ui.jobs.clear')}</Button>{/if}
      </EmptyState>
    {:else}
      <ul class="list" data-ui="jobs.list">
        {#each rows as job (job.id)}
          <li>
            <a class="list-item job" data-ui="job.{job.id}" href={paths.job(job.id)} aria-current={router.current.id === job.id ? 'true' : undefined}>
              <span class="dot {job.availability}" title={availabilityLabel(job.availability)} role="img" aria-label={availabilityLabel(job.availability)}></span>
              <span class="grow body">
                <span class="title">{job.title}</span>
                <span class="muted small">{[job.company_name, job.location].filter((part) => part !== '').join(' · ')}</span>
                <span class="row wrap small">
                  {#if job.is_gig}<Badge text={tr('ui.job.gig')} color="var(--accent-soft)" textColor="var(--text)" />{/if}
                  {#if job.application_count > 0}<span class="muted">{tr('summary.applications', { count: job.application_count })}</span>{/if}
                </span>
              </span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<style>
  .filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-3); align-items: end; }
  .check { display: flex; align-items: center; gap: var(--space-2); min-height: var(--tap); }
  .job { align-items: flex-start; }
  .body { display: flex; flex-direction: column; gap: var(--space-1); }
  .title { font-weight: 600; }
  .dot { flex: none; width: 12px; height: 12px; margin-top: 7px; border-radius: 50%; background: var(--text-muted); }
  .dot.online { background: var(--success); }
  .dot.offline { background: var(--danger); }
</style>
