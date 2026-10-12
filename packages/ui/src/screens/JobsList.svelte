<script lang="ts">
  import type { JobRow } from '@jobhunters/core';
  import { api } from '../api';
  import Badge from '../components/Badge.svelte';
  import Button from '../components/Button.svelte';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import ErrorBlock from '../components/ErrorBlock.svelte';
  import Field from '../components/Field.svelte';
  import Icon from '../components/Icon.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import { filterJobs, type JobFilters } from '../lib/filters';
  import { tr } from '../lib/i18n.svelte';
  import { reportAvailability } from '../lib/job-notices';
  import { jobStatus, jobStatusOptions } from '../lib/job-status';
  import { safeHttpUrl, shorten } from '../lib/format';
  import { availabilityLabel } from '../lib/labels';
  import { notifyError } from '../lib/notify';
  import { useResource } from '../lib/resource.svelte';
  import { paths } from '../lib/route';
  import { navigate, router } from '../lib/router.svelte';
  import { app } from '../state/app.svelte';
  import { invalidate } from '../state/invalidate.svelte';
  import { toast } from '../state/toast.svelte';

  const jobs = useResource(() => api.listJobs());
  let text = $state('');
  let availability = $state<JobFilters['availability']>('');
  let gig = $state(false);
  let status = $state('');

  const rows = $derived(filterJobs(jobs.data ?? [], { text, availability, gig, status }));
  const filtered = $derived(text.trim() !== '' || availability !== '' || gig || status !== '');

  const hasExperience = $derived((app.settings?.candidate_experience ?? '').trim() !== '');
  /** The no-experience hint is shown once, on the first card whose checkbox is disabled, so the list stays calm. */
  const hintId = $derived(rows.find((row) => canEvaluate(row) && row.match_task_status !== 'pending' && row.match_task_status !== 'in_progress')?.id);
  /** Jobs whose match request is being sent or cancelled: a second click must not queue a second task. */
  let busy = $state<string[]>([]);
  let deleting = $state<{ id: string; title: string } | undefined>();

  /** The checkbox is offered only for an ad that was never evaluated and has no application. */
  function canEvaluate(job: JobRow): boolean {
    return typeof job.match_percent !== 'number' && job.application_count === 0 && job.status !== 'awaiting';
  }

  async function toggleMatch(job: JobRow, input: HTMLInputElement): Promise<void> {
    const checked = input.checked;
    const wasActive = job.match_task_status === 'pending' || job.match_task_status === 'in_progress';
    if (busy.includes(job.id)) {
      input.checked = wasActive;
      return;
    }
    busy = [...busy, job.id];
    try {
      if (checked) {
        await api.requestJobMatch(job.id);
        toast.success(tr('ui.match.requested', { title: job.title }));
      } else if (job.match_task_status === 'pending' && job.match_task_id !== '') {
        await api.cancelAiTask(job.match_task_id);
        toast.success(tr('ui.match.cancelled', { title: job.title }));
      } else {
        input.checked = wasActive;
      }
    } catch (error) {
      input.checked = wasActive;
      notifyError(error);
    } finally {
      busy = busy.filter((id) => id !== job.id);
      invalidate();
    }
  }

  async function check(job: JobRow): Promise<void> {
    reportAvailability(await api.checkJobAvailability(job.id));
    invalidate();
  }

  async function remove(target: { id: string; title: string }): Promise<void> {
    await api.deleteJob(target.id);
    toast.success(tr('ui.job.deleted', { title: shorten(target.title, 60) }));
    invalidate();
  }

  function clear(): void {
    text = '';
    availability = '';
    gig = false;
    status = '';
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
      <Field label={tr('ui.jobs.status')} for="job-status-filter">
        <select id="job-status-filter" class="input" bind:value={status}>
          <option value="">{tr('ui.jobs.statusAll')}</option>
          {#each jobStatusOptions(true) as option (option.code)}<option value={option.code}>{option.text}</option>{/each}
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
          {@const current = jobStatus(job)}
          <li>
            <div class="card-row" class:current={router.current.id === job.id}>
              <a class="list-item job grow" data-ui="job.{job.id}" href={paths.job(job.id)} aria-current={router.current.id === job.id ? 'true' : undefined}>
                <span class="dot {job.availability}" title={availabilityLabel(job.availability)} role="img" aria-label={availabilityLabel(job.availability)}></span>
                <span class="grow body">
                  <span class="title">{job.title}</span>
                  <span class="muted small">{[job.company_name, job.location].filter((part) => part !== '').join(' · ')}</span>
                  <span class="row wrap small">
                    <Badge text={current.text} color={current.color} textColor={current.textColor} />
                    {#if job.is_gig}<Badge text={tr('ui.job.gig')} color="var(--accent-soft)" textColor="var(--text)" />{/if}
                    {#if job.application_count > 0}<span class="muted">{tr('summary.applications', { count: job.application_count })}</span>{/if}
                  </span>
                  {#if canEvaluate(job) && !hasExperience && job.match_task_status !== 'pending' && job.match_task_status !== 'in_progress' && job.id === hintId}
                    <span class="muted small" data-ui="job.{job.id}.match.hint">{tr('ui.jobs.card.matchNoExperience')}</span>
                  {/if}
                </span>
              </a>
              <div class="actions" data-ui="job.{job.id}.actions">
                <div class="icons">
                  {#if safeHttpUrl(job.url) !== ''}
                    <a class="icon-link" href={safeHttpUrl(job.url)} target="_blank" rel="noopener noreferrer" aria-label={tr('ui.jobs.card.open')} title={tr('ui.jobs.card.open')}><Icon name="external" size={18} /></a>
                  {/if}
                  {#if job.status !== 'awaiting'}
                    <Button variant="ghost" label={tr('ui.jobs.card.check')} ui="job.{job.id}.check" onclick={() => check(job)}><Icon name="refresh" size={18} /></Button>
                  {:else}
                    <Button variant="ghost" label={tr('ui.jobs.card.delete')} ui="job.{job.id}.delete" onclick={() => (deleting = { id: job.id, title: job.title })}><Icon name="trash" size={18} /></Button>
                  {/if}
                </div>
                {#if canEvaluate(job)}
                  {@const waiting = job.match_task_status === 'pending'}
                  {@const running = job.match_task_status === 'in_progress'}
                  {@const active = waiting || running}
                  <div class="match">
                    {#if !hasExperience && !active}
                      <a class="icon-link" href={paths.settings} aria-label={tr('ui.jobs.card.matchNoExperience')} title={tr('ui.jobs.card.matchNoExperience')} data-ui="job.{job.id}.match.settings"><Icon name="settings" size={18} /></a>
                    {:else if waiting}
                      <span class="pending" role="img" aria-label={tr('ui.match.pending')} title={tr('ui.match.pending')}><Icon name="clock" size={18} /></span>
                    {/if}
                    <label class="check-box" title={tr('ui.match.request')} data-ui="job.{job.id}.match">
                      <input type="checkbox" checked={active} disabled={running || busy.includes(job.id) || (!hasExperience && !active)} onchange={(event) => toggleMatch(job, event.currentTarget)} />
                      <span class="sr-only">{tr('ui.match.request')}</span>
                    </label>
                  </div>
                {/if}
              </div>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<ConfirmDialog open={deleting !== undefined} text={tr('ui.job.deleteConfirm', { title: deleting?.title ?? '' })} onconfirm={() => (deleting ? remove(deleting) : undefined)} onclose={() => (deleting = undefined)} />

<style>
  .filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-3); align-items: end; }
  .check { display: flex; align-items: center; gap: var(--space-2); min-height: var(--tap); }
  .card-row { display: flex; align-items: stretch; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-m); }
  .card-row:hover, .card-row.current { border-color: var(--accent); }
  .card-row.current { background: var(--accent-soft); }
  .card-row .job { flex: 1 1 0; min-width: 0; background: transparent; border: 0; }
  .job { align-items: flex-start; overflow-wrap: anywhere; }
  .actions { flex: none; width: 56px; display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; gap: var(--space-2); padding: var(--space-1) var(--space-2) var(--space-2) 0; }
  .icons { display: flex; flex-direction: column; align-items: flex-end; }
  .actions :global(.btn) { min-width: var(--tap); padding: 0; }
  .icon-link { display: inline-flex; align-items: center; justify-content: center; min-width: var(--tap); min-height: var(--tap); color: inherit; }
  .match { display: flex; flex-direction: column; align-items: flex-end; }
  .pending { display: inline-flex; align-items: center; justify-content: center; min-width: var(--tap); min-height: var(--tap); color: var(--text-muted); }
  .check-box { display: inline-flex; align-items: center; justify-content: center; min-width: var(--tap); min-height: var(--tap); cursor: pointer; }
  .body { display: flex; flex-direction: column; gap: var(--space-1); }
  .title { font-weight: 600; }
  .dot { flex: none; width: 12px; height: 12px; margin-top: 7px; border-radius: 50%; background: var(--text-muted); }
  .dot.online { background: var(--success); }
  .dot.offline { background: var(--danger); }
</style>
