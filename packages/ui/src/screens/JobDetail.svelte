<script lang="ts">
  import { api } from '../api';
  import Badge from '../components/Badge.svelte';
  import Button from '../components/Button.svelte';
  import Card from '../components/Card.svelte';
  import ErrorBlock from '../components/ErrorBlock.svelte';
  import Field from '../components/Field.svelte';
  import Icon from '../components/Icon.svelte';
  import Tabs from '../components/Tabs.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import StatusBadge from '../components/StatusBadge.svelte';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';
  import { formatDate, formatSalary, safeHttpUrl, shorten } from '../lib/format';
  import { tr } from '../lib/i18n.svelte';
  import { jobStatus, jobStatusOptions } from '../lib/job-status';
  import { reportAvailability } from '../lib/job-notices';
  import { availabilityLabel, availabilityReasonLabel } from '../lib/labels';
  import { useResource } from '../lib/resource.svelte';
  import { paths } from '../lib/route';
  import { navigate } from '../lib/router.svelte';
  import { invalidate } from '../state/invalidate.svelte';
  import { toast } from '../state/toast.svelte';
  import CreateApplicationDialog from './CreateApplicationDialog.svelte';
  import MatchTab from './tabs/MatchTab.svelte';

  let { id }: { id: string } = $props();

  const detail = useResource(() => api.getJob(id), () => id);
  let notes = $state('');
  let gig = $state(false);
  let creating = $state(false);
  let deleting = $state(false);
  let tab = $state('applications');

  $effect(() => {
    const job = detail.data?.job;
    if (job) {
      notes = job.notes;
      gig = job.is_gig;
    }
  });

  async function save(): Promise<void> {
    await api.updateJob(id, { notes, is_gig: gig });
    toast.success(tr('ui.job.savedNotes', { title: detail.data?.job.title ?? '' }));
    invalidate();
  }

  async function changeStatus(status: string): Promise<void> {
    const job = detail.data?.job;
    const from = job ? jobStatus(job).text : '';
    const to = jobStatusOptions().find((option) => option.code === status)?.text ?? status;
    await api.updateJob(id, { status });
    toast.success(tr('ui.job.statusChanged', { title: job?.title ?? '', from, to }));
    invalidate();
  }

  async function checkAvailability(): Promise<void> {
    reportAvailability(await api.checkJobAvailability(id));
    invalidate();
  }

  async function remove(): Promise<void> {
    const job = detail.data?.job;
    await api.deleteJob(id);
    toast.success(tr('ui.job.deleted', { title: shorten(job?.title ?? '', 60) }));
    invalidate();
    navigate(paths.jobs);
  }

  const salary = $derived(detail.data ? formatSalary(detail.data.job) : '');
</script>

<div class="stack" data-ui="job-detail">
  {#if detail.status === 'loading'}
    <Skeleton lines={6} />
  {:else if detail.status === 'error'}
    <ErrorBlock error={detail.error} onretry={invalidate} />
  {:else if detail.data}
    {@const job = detail.data.job}
    {@const current = jobStatus(job)}
    <Card ui="job-detail.summary">
      <div class="page-title">
        <h1>{job.title}</h1>
        {#if job.status !== 'awaiting'}
          <Button variant="primary" ui="job-detail.create-application" onclick={() => (creating = true)}><Icon name="plus" size={18} />{tr('ui.job.createApplication')}</Button>
        {/if}
      </div>
      <p class="muted">{[detail.data.company?.name ?? '', job.location, salary].filter((part) => part !== '').join(' · ')}</p>
      <div class="row wrap">
        <Badge text={availabilityLabel(job.availability)} color={job.availability === 'online' ? 'var(--success-soft)' : job.availability === 'offline' ? 'var(--danger-soft)' : 'var(--surface-2)'} textColor="var(--text)" />
        <Badge text={current.text} color={current.color} textColor={current.textColor} />
        {#if job.is_gig}<Badge text={tr('ui.job.gig')} color="var(--accent-soft)" textColor="var(--text)" />{/if}
        {#if typeof job.match_percent === 'number' && current.code !== 'new'}<span class="muted small">{tr('jobStatus.match', { percent: job.match_percent })}</span>{/if}
        {#if job.last_checked_at !== ''}<span class="muted small">{tr('ui.job.checked', { date: formatDate(job.last_checked_at) })}</span>{/if}
        {#if job.availability_reason !== ''}<span class="muted small" data-ui="job-detail.availability-reason">{availabilityReasonLabel(job.availability_reason)}</span>{/if}
        {#if job.flags.includes('snapshot_missing')}<span class="warn small">{tr('ui.job.snapshotMissing')}</span>{/if}
      </div>
      <div class="row wrap">
        {#if safeHttpUrl(job.url) !== ''}
          <a data-ui="job-detail.url-link" href={safeHttpUrl(job.url)} target="_blank" rel="noopener noreferrer" class="row"><Icon name="external" size={16} />{tr('ui.job.open')}</a>
        {/if}
        {#if job.status !== 'awaiting'}
        <select class="input status-select" aria-label={tr('ui.job.status')} data-ui="job-detail.status" value={current.code} onchange={(event) => changeStatus(event.currentTarget.value)}>
          {#each jobStatusOptions() as option (option.code)}<option value={option.code}>{option.text}</option>{/each}
        </select>
        <Button ui="job-detail.check-availability" onclick={checkAvailability}>{tr('ui.job.checkAvailability')}</Button>
        {/if}
        {#if job.folder_url !== ''}
          <a data-ui="job-detail.folder-link" href={job.folder_url} target="_blank" rel="noopener noreferrer" class="row"><Icon name="external" size={16} />{tr('ui.job.folder')}</a>
        {/if}
      </div>
    </Card>

    {#if job.status === 'awaiting'}
      <Card ui="job.awaiting">
        <p>{tr('ui.job.awaitingNotice')}</p>
        <div><Button variant="danger" ui="job-detail.delete" onclick={() => (deleting = true)}><Icon name="trash" size={18} />{tr('ui.job.delete')}</Button></div>
      </Card>
      <ConfirmDialog open={deleting} text={tr('ui.job.deleteConfirm', { title: job.title })} onconfirm={remove} onclose={() => (deleting = false)} />
    {/if}

    <Card ui="job-detail.tabs">
      <Tabs
        items={[
          { id: 'applications', label: tr('ui.job.tab.applications'), count: detail.data.applications.length },
          { id: 'notes', label: tr('ui.job.tab.notes') },
          { id: 'description', label: tr('ui.job.tab.description') },
          ...(job.status === 'awaiting' ? [] : [{ id: 'match', label: tr('ui.job.tab.match') }]),
        ]}
        bind:active={tab}
        label={tr('ui.job.tabs')}
      />
      <div role="tabpanel" data-ui="job-detail.panel" id="panel-{tab}" aria-labelledby="tab-{tab}">
        {#if tab === 'applications'}
          <div class="stack" data-ui="job-detail.applications">
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
          </div>
        {:else if tab === 'notes'}
          <div class="stack" data-ui="job-detail.notes">
            <Field label={tr('ui.job.notes')} for="job-notes"><textarea data-ui="job-detail.notes-input" id="job-notes" class="input" rows="3" bind:value={notes}></textarea></Field>
            <label class="check"><input data-ui="job-detail.gig" type="checkbox" bind:checked={gig} />{tr('ui.job.gig')}</label>
            <div><Button variant="primary" ui="job-detail.save" onclick={save}>{tr('ui.save')}</Button></div>
          </div>
        {:else if tab === 'description'}
          <div data-ui="job-detail.description">
            <p class="description">{job.description === '' ? tr('ui.job.noDescription') : job.description}</p>
          </div>
        {:else if job.status !== 'awaiting'}
          <MatchTab jobId={job.id} jobTitle={job.title} match={detail.data.match} />
        {/if}
      </div>
    </Card>

    <CreateApplicationDialog open={creating} {job} applications={detail.data.applications} onclose={() => (creating = false)} />
  {/if}
</div>

<style>
  .description { white-space: pre-wrap; }
  .warn { color: var(--warning); font-weight: 600; }
  .check { display: flex; align-items: center; gap: var(--space-2); min-height: var(--tap); }
</style>
