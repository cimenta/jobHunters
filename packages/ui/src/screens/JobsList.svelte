<script lang="ts">
  import { JOB_SORTS, type JobRow, type JobSort } from '@jobhunters/core';
  import { api } from '../api';
  import Badge from '../components/Badge.svelte';
  import Button from '../components/Button.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import ErrorBlock from '../components/ErrorBlock.svelte';
  import Field from '../components/Field.svelte';
  import Icon from '../components/Icon.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import { describeWarning } from '../lib/errors';
  import { filterJobs, sortJobs, type JobFilters } from '../lib/filters';
  import { tr } from '../lib/i18n.svelte';
  import { reportAvailability } from '../lib/job-notices';
  import { jobStatus, jobStatusOptions } from '../lib/job-status';
  import { formatAiSalary, formatEmploymentType, formatSalary, formatWorkMode, safeHttpUrl, shorten } from '../lib/format';
  import { availabilityLabel } from '../lib/labels';
  import { notifyError } from '../lib/notify';
  import { useResource } from '../lib/resource.svelte';
  import { paths } from '../lib/route';
  import { navigate, router } from '../lib/router.svelte';
  import { app } from '../state/app.svelte';
  import { invalidate } from '../state/invalidate.svelte';
  import { saveUiState, uiState } from '../state/ui-state';
  import { toast } from '../state/toast.svelte';

  const jobs = useResource(() => api.listJobs());
  let text = $state('');
  let availability = $state<JobFilters['availability']>('');
  let gig = $state(false);
  let status = $state('');

  const hideApplied = $derived(uiState().jobs_hide_applied);
  const hideNo = $derived(uiState().jobs_hide_no);
  /** The status No as the user named it (the names of the statuses can be changed in Settings). */
  const noText = $derived(jobStatusOptions(true).find((option) => option.code === 'no')?.text ?? 'No');
  const sort = $derived(uiState().jobs_sort);

  const rows = $derived(sortJobs(filterJobs(jobs.data ?? [], { text, availability, gig, status, hideApplied, hideNo }), sort));
  const filtered = $derived(text.trim() !== '' || availability !== '' || gig || status !== '' || hideApplied || hideNo);

  const hasExperience = $derived((app.settings?.candidate_experience ?? '').trim() !== '');
  /** The no-experience hint is shown once, on the first card whose checkbox is disabled, so the list stays calm. */
  const hintId = $derived(rows.find((row) => canEvaluate(row) && row.match_task_status !== 'pending' && row.match_task_status !== 'in_progress')?.id);
  /** Jobs whose match request is being sent or cancelled: a second click must not queue a second task. */
  let busy = $state<string[]>([]);
  /** Jobs just prepared: the box stays ticked and locked until the refreshed list drops it. */
  let prepared = $state<string[]>([]);
  let deleting = $state<{ id: string; title: string; folder_url: string } | undefined>();
  /** The job whose link is being added (the red icon of a job without a link). */
  let linking = $state<{ id: string; title: string } | undefined>();

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

  /** A job gets an application and AI tasks in one step; the box is one-way, so it is reset on failure only. */
  async function prepare(job: JobRow, input: HTMLInputElement): Promise<void> {
    if (busy.includes(job.id)) {
      input.checked = false;
      return;
    }
    busy = [...busy, job.id];
    try {
      const result = await api.prepareApplication(job.id);
      prepared = [...prepared, job.id];
      const title = shorten(job.title, 60);
      toast.success(result.tasks.length > 0 ? tr('ui.jobs.card.prepared', { title, count: result.tasks.length }) : tr('ui.jobs.card.preparedNoTasks', { title }));
      for (const warning of result.warnings) toast.warning(describeWarning(warning));
    } catch (error) {
      input.checked = false;
      notifyError(error);
    } finally {
      busy = busy.filter((id) => id !== job.id);
      invalidate();
    }
  }

  /** Work mode · type · salary of the ad, empty when the ad has none of them. */
  function facts(job: JobRow): string {
    return [formatWorkMode(job), formatEmploymentType(job.employment_type), formatSalary(job)].filter((part) => part !== '').join(' · ');
  }

  async function check(job: JobRow): Promise<void> {
    reportAvailability(await api.checkJobAvailability(job.id));
    invalidate();
  }

  function clear(): void {
    text = '';
    availability = '';
    gig = false;
    status = '';
    saveUiState({ jobs_hide_applied: false, jobs_hide_no: false });
    document.getElementById('job-search')?.focus();
  }
  import AddLinkDialog from './AddLinkDialog.svelte';
  import DeleteJobDialog from './DeleteJobDialog.svelte';
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
      <Button ui="jobs.add-job" variant="primary" onclick={() => navigate(paths.newJob)}><Icon name="plus" size={18} />{tr('ui.jobs.add')}</Button>
    </EmptyState>
  {:else}
    <div class="filters-wrap"><div class="filters" data-ui="jobs.filters">
      <Field label={tr('ui.jobs.search')} for="job-search">
        <input id="job-search" data-ui="jobs.search" class="input" type="search" placeholder={tr('ui.jobs.searchPlaceholder')} bind:value={text} />
      </Field>
      <Field label={tr('ui.jobs.availability')} for="job-availability">
        <select id="job-availability" data-ui="jobs.availability" class="input" bind:value={availability}>
          <option value="">{tr('ui.jobs.availabilityAll')}</option>
          <option value="online">{availabilityLabel('online')}</option>
          <option value="offline">{availabilityLabel('offline')}</option>
          <option value="unknown">{availabilityLabel('unknown')}</option>
        </select>
      </Field>
      <Field label={tr('ui.jobs.status')} for="job-status-filter">
        <select id="job-status-filter" data-ui="jobs.status" class="input" bind:value={status}>
          <option value="">{tr('ui.jobs.statusAll')}</option>
          {#each jobStatusOptions(true) as option (option.code)}<option value={option.code}>{option.text}</option>{/each}
        </select>
      </Field>
      <Field label={tr('ui.jobs.sort')} for="job-sort">
        <select id="job-sort" data-ui="jobs.sort" class="input" value={sort} onchange={(event) => saveUiState({ jobs_sort: event.currentTarget.value as JobSort })}>
          {#each JOB_SORTS as option (option)}<option value={option}>{tr(`ui.jobs.sort.${option}`)}</option>{/each}
        </select>
      </Field>
      <div class="checks" data-ui="jobs.checks">
        <label class="check" title={tr('ui.jobs.hideApplied')}><input type="checkbox" data-ui="jobs.hide-applied" checked={hideApplied} onchange={(event) => saveUiState({ jobs_hide_applied: event.currentTarget.checked })} />{tr('ui.jobs.hideAppliedShort')}</label>
        <div class="check-row">
        <label class="check" title={tr('ui.jobs.hideStatus', { status: noText })}><input type="checkbox" data-ui="jobs.hide-no" checked={hideNo} onchange={(event) => saveUiState({ jobs_hide_no: event.currentTarget.checked })} />{tr('ui.jobs.hideStatusShort', { status: noText })}</label>
        <label class="check" title={tr('ui.job.gig')}><input type="checkbox" data-ui="jobs.gig" bind:checked={gig} />{tr('ui.jobs.gigShort')}</label>
        </div>
      </div>
      {#if filtered}<Button variant="secondary" ui="jobs.clear-filters" onclick={clear}>{tr('ui.jobs.clear')}</Button>{/if}
    </div></div>

    {#if rows.length === 0}
      <EmptyState ui="jobs.no-match" title={tr('ui.jobs.noMatchTitle')} text={tr('ui.jobs.noMatchText')}>
        {#if filtered}<Button ui="jobs.clear-empty" onclick={clear}>{tr('ui.jobs.clear')}</Button>{/if}
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
                  {#if facts(job) !== ''}<span class="muted small" data-ui="job.{job.id}.facts">{facts(job)}</span>{/if}
                  {#if job.ai_salary}<span class="muted small" data-ui="job.{job.id}.ai-salary">{formatAiSalary(job.ai_salary, job.salary_currency)}</span>{/if}
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
                    <a data-ui="job.{job.id}.link" class="icon-link" href={safeHttpUrl(job.url)} target="_blank" rel="noopener noreferrer" aria-label={tr('ui.jobs.card.open')} title={tr('ui.jobs.card.open')}><Icon name="external" size={18} /></a>
                  {:else if job.status !== 'awaiting'}
                    <Button variant="alert" label={tr('ui.job.noLink')} ui="job.{job.id}.link" onclick={() => (linking = { id: job.id, title: job.title })}><Icon name="external" size={18} /></Button>
                  {/if}
                  {#if job.status !== 'awaiting'}
                    <Button variant="ghost" label={safeHttpUrl(job.url) === '' ? tr('ui.job.addLinkFirst') : tr('ui.jobs.card.check')} ui="job.{job.id}.check" disabled={safeHttpUrl(job.url) === ''} onclick={() => check(job)}><Icon name="check" size={18} /></Button>
                  {/if}
                  {#if job.application_count === 0}
                    <Button variant="ghost" label={tr('ui.jobs.card.delete')} ui="job.{job.id}.delete" onclick={() => (deleting = { id: job.id, title: job.title, folder_url: job.folder_url })}><Icon name="trash" size={18} /></Button>
                  {/if}
                </div>
                {#if canEvaluate(job)}
                  {@const waiting = job.match_task_status === 'pending'}
                  {@const running = job.match_task_status === 'in_progress'}
                  {@const active = waiting || running}
                  <div class="match">
                    {#if waiting}
                      <span class="pending" role="img" aria-label={tr('ui.match.pending')} title={tr('ui.match.pending')}><Icon name="clock" size={18} /></span>
                    {/if}
                    <label class="check-box prepare" title={!hasExperience && !active ? tr('ui.jobs.card.matchNoExperience') : tr('ui.match.request')} data-ui="job.{job.id}.match">
                      <input data-ui="job.{job.id}.ai-match" type="checkbox" aria-label={tr('ui.match.request')} checked={active} disabled={running || busy.includes(job.id) || (!hasExperience && !active)} onchange={(event) => toggleMatch(job, event.currentTarget)} />
                      <span class="prepare-text">{tr('ui.match.requestShort')}</span>
                    </label>
                  </div>
                {/if}
                {#if job.application_count === 0 && job.status !== 'awaiting'}
                  <div class="match">
                    {#if !hasExperience}
                      <a class="icon-link" href={paths.settings} aria-label={tr('ui.jobs.card.aiNoExperience')} title={tr('ui.jobs.card.aiNoExperience')} data-ui="job.{job.id}.ai.settings"><Icon name="settings" size={18} /></a>
                    {/if}
                    <label class="check-box prepare" title={tr('ui.jobs.card.prepareTitle')} data-ui="job.{job.id}.prepare.box">
                      <input data-ui="job.{job.id}.prepare" type="checkbox" checked={prepared.includes(job.id)} disabled={busy.includes(job.id) || prepared.includes(job.id) || !hasExperience} onchange={(event) => (event.currentTarget.checked ? prepare(job, event.currentTarget) : undefined)} />
                      <span class="prepare-text">{tr('ui.jobs.card.prepare')}</span>
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

{#if deleting !== undefined}
  <DeleteJobDialog open={true} job={deleting} onclose={() => (deleting = undefined)} />
{/if}

{#if linking !== undefined}
  <AddLinkDialog open={true} job={linking} onclose={() => (linking = undefined)} />
{/if}

<style>
  .filters-wrap { container-type: inline-size; }
  .filters { display: flex; flex-direction: column; gap: var(--space-3); }
  .filters > :global(*) { min-width: 0; }
  .checks { display: flex; flex-direction: column; }
  /* Hide No and Gig stand side by side under Hide with application. */
  .check-row { display: flex; flex-wrap: wrap; column-gap: var(--space-4); }
  .check { display: flex; align-items: center; gap: var(--space-2); min-height: var(--tap); white-space: nowrap; }
  @container (min-width: 560px) {
    .filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); align-items: end; }
  }
  @container (min-width: 900px) {
    .filters { grid-template-columns: minmax(120px, 1fr) 170px 130px 160px max-content max-content; }
    .filters > .checks, .filters > :global(.btn) { min-width: max-content; }
  }
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
  .check-box.prepare { flex-direction: column; gap: 2px; width: 100%; padding: var(--space-1) 0; }
  .prepare-text { font-size: 0.6875rem; line-height: 1.1; text-align: center; overflow-wrap: normal; word-break: normal; hyphens: none; color: var(--text-muted); }
  .body { display: flex; flex-direction: column; gap: var(--space-1); }
  .title { font-weight: 600; }
  .dot { flex: none; width: 12px; height: 12px; margin-top: 7px; border-radius: 50%; background: var(--text-muted); }
  .dot.online { background: var(--success); }
  .dot.offline { background: var(--danger); }
</style>
