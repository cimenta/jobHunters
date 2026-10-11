<script lang="ts">
  import { api } from '../api';
  import Badge from '../components/Badge.svelte';
  import Button from '../components/Button.svelte';
  import Card from '../components/Card.svelte';
  import ErrorBlock from '../components/ErrorBlock.svelte';
  import Field from '../components/Field.svelte';
  import Icon from '../components/Icon.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import StatusBadge from '../components/StatusBadge.svelte';
  import { formatDate, formatSalary } from '../lib/format';
  import { tr } from '../lib/i18n.svelte';
  import { availabilityLabel } from '../lib/labels';
  import { useResource } from '../lib/resource.svelte';
  import { paths } from '../lib/route';
  import { navigate } from '../lib/router.svelte';
  import { invalidate } from '../state/invalidate.svelte';
  import { toast } from '../state/toast.svelte';
  import CreateApplicationDialog from './CreateApplicationDialog.svelte';

  let { id }: { id: string } = $props();

  const detail = useResource(() => api.getJob(id), () => id);
  let notes = $state('');
  let gig = $state(false);
  let creating = $state(false);

  $effect(() => {
    const job = detail.data?.job;
    if (job) {
      notes = job.notes;
      gig = job.is_gig;
    }
  });

  async function save(): Promise<void> {
    await api.updateJob(id, { notes, is_gig: gig });
    toast.success(tr('ui.saved'));
    invalidate();
  }

  const salary = $derived(detail.data ? formatSalary(detail.data.job) : '');
</script>

<div class="stack" data-ui="job-detail">
  <div class="only-narrow">
    <Button variant="ghost" onclick={() => navigate(paths.jobs)}><Icon name="back" size={18} />{tr('ui.back')}</Button>
  </div>

  {#if detail.status === 'loading'}
    <Skeleton lines={6} />
  {:else if detail.status === 'error'}
    <ErrorBlock error={detail.error} onretry={invalidate} />
  {:else if detail.data}
    {@const job = detail.data.job}
    <Card ui="job-detail.summary">
      <div class="page-title">
        <h1>{job.title}</h1>
        <Button variant="primary" ui="job-detail.create-application" onclick={() => (creating = true)}><Icon name="plus" size={18} />{tr('ui.job.createApplication')}</Button>
      </div>
      <p class="muted">{[detail.data.company?.name ?? '', job.location, salary].filter((part) => part !== '').join(' · ')}</p>
      <div class="row wrap">
        <Badge text={availabilityLabel(job.availability)} color={job.availability === 'online' ? 'var(--success-soft)' : job.availability === 'offline' ? 'var(--danger-soft)' : 'var(--surface-2)'} textColor="var(--text)" />
        {#if job.is_gig}<Badge text={tr('ui.job.gig')} color="var(--accent-soft)" textColor="var(--text)" />{/if}
        {#if job.last_checked_at !== ''}<span class="muted small">{tr('ui.job.checked', { date: formatDate(job.last_checked_at) })}</span>{/if}
        {#if job.flags.includes('snapshot_missing')}<span class="warn small">{tr('ui.job.snapshotMissing')}</span>{/if}
      </div>
      <div class="row wrap">
        {#if job.url !== ''}
          <a href={job.url} target="_blank" rel="noopener noreferrer" class="row"><Icon name="external" size={16} />{tr('ui.job.open')}</a>
        {/if}
        {#if job.folder_url !== ''}
          <a href={job.folder_url} target="_blank" rel="noopener noreferrer" class="row"><Icon name="external" size={16} />{tr('ui.job.folder')}</a>
        {/if}
      </div>
    </Card>

    <Card ui="job-detail.applications">
      <h2>{tr('ui.job.applications')}</h2>
      {#if detail.data.applications.length === 0}
        <p class="muted">{tr('ui.job.noApplications')}</p>
      {:else}
        <ul class="list">
          {#each detail.data.applications as application (application.id)}
            <li>
              <a class="list-item" data-ui="application.{application.id}" href={paths.application(application.id)}>
                <span class="grow">{application.label}</span>
                <StatusBadge status={application.status} />
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </Card>

    <Card ui="job-detail.notes">
      <Field label={tr('ui.job.notes')} for="job-notes"><textarea id="job-notes" class="input" rows="3" bind:value={notes}></textarea></Field>
      <label class="check"><input type="checkbox" bind:checked={gig} />{tr('ui.job.gig')}</label>
      <div><Button variant="primary" ui="job-detail.save" onclick={save}>{tr('ui.save')}</Button></div>
    </Card>

    <Card ui="job-detail.description">
      <h2>{tr('ui.job.description')}</h2>
      <p class="description">{job.description === '' ? tr('ui.job.noDescription') : job.description}</p>
    </Card>

    <CreateApplicationDialog open={creating} {job} applications={detail.data.applications} onclose={() => (creating = false)} />
  {/if}
</div>

<style>
  .description { white-space: pre-wrap; }
  .warn { color: var(--warning); font-weight: 600; }
  .check { display: flex; align-items: center; gap: var(--space-2); min-height: var(--tap); }
</style>
