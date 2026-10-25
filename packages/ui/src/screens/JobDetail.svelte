<script lang="ts">
  import { DEFAULT_TRANSITIONS } from '@jobhunters/core';
  import { api } from '../api';
  import type { ApplicationRow } from '../api/types';
  import Badge from '../components/Badge.svelte';
  import Button from '../components/Button.svelte';
  import Card from '../components/Card.svelte';
  import ErrorBlock from '../components/ErrorBlock.svelte';
  import Field from '../components/Field.svelte';
  import Icon from '../components/Icon.svelte';
  import Tabs from '../components/Tabs.svelte';
  import InlineText from '../components/InlineText.svelte';
  import GigBox from '../components/GigBox.svelte';
  import WorkModeBoxes from '../components/WorkModeBoxes.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import WithdrawDialog from '../components/WithdrawDialog.svelte';
  import StatusBadge from '../components/StatusBadge.svelte';
  import { formatDate, safeHttpUrl } from '../lib/format';
  import { jobFacts } from '../lib/job-facts';
  import { tr } from '../lib/i18n.svelte';
  import { jobStatus, jobStatusOptions } from '../lib/job-status';
  import { reportAvailability, reportRefresh } from '../lib/job-notices';
  import { availabilityLabel, availabilityReasonLabel } from '../lib/labels';
  import { useResource } from '../lib/resource.svelte';
  import { paths } from '../lib/route';
  import { navigate } from '../lib/router.svelte';
  import { withdrawable, withdrawApplications } from '../lib/withdraw';
  import { app } from '../state/app.svelte';
  import { invalidate } from '../state/invalidate.svelte';
  import { toast } from '../state/toast.svelte';
  import CreateApplicationDialog from './CreateApplicationDialog.svelte';
  import AddLinkDialog from './AddLinkDialog.svelte';
  import DeleteJobDialog from './DeleteJobDialog.svelte';
  import JobCommunicationsTab from './tabs/JobCommunicationsTab.svelte';
  import MatchTab from './tabs/MatchTab.svelte';
  import TimelineTab from './tabs/TimelineTab.svelte';

  let { id }: { id: string } = $props();

  const detail = useResource(() => api.getJob(id), () => id);
  let notes = $state('');
  let gig = $state(false);
  let creating = $state(false);
  let deleting = $state(false);
  /** Whether the window that asks for the link of an ad without one is open. */
  let linking = $state(false);
  let tab = $state('applications');
  /** Whether the field "Reason why not" is open for typing; it opens right after the status was changed to No. */
  let reasonEditing = $state(false);

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

  /** The open applications offered for Withdrawn while the ad is being set to No (the question is open while this is set). */
  let withdrawing = $state<ApplicationRow[]>();

  async function changeStatus(status: string, select?: HTMLSelectElement): Promise<void> {
    const job = detail.data?.job;
    if (status === 'no' && job && job.status !== 'no') {
      const open = withdrawable(detail.data?.applications ?? [], app.settings?.status_transitions ?? DEFAULT_TRANSITIONS);
      if (open.length > 0) {
        if (select) select.value = jobStatus(job).code;
        withdrawing = open;
        return;
      }
    }
    await applyStatus(status, []);
  }

  async function applyStatus(status: string, withdraw: ApplicationRow[]): Promise<void> {
    const job = detail.data?.job;
    const from = job ? jobStatus(job).text : '';
    const to = jobStatusOptions().find((option) => option.code === status)?.text ?? status;
    await api.updateJob(id, { status });
    const failed = await withdrawApplications(withdraw);
    if (status === 'no') reasonEditing = true;
    toast.success(tr('ui.job.statusChanged', { title: job?.title ?? '', from, to }));
    if (withdraw.length > 0) toast.success(tr('ui.job.withdrawn', { count: withdraw.length - failed.length }));
    if (failed.length > 0) toast.warning(tr('ui.job.withdrawSkipped', { labels: failed.map((application) => application.label).join(', ') }));
    invalidate();
  }

  async function checkAvailability(): Promise<void> {
    reportAvailability(await api.checkJobAvailability(id));
    invalidate();
  }

  async function refresh(): Promise<void> {
    reportRefresh(await api.refreshJob(id));
    invalidate();
  }

  /** The labelled facts of the ad; only the filled ones are listed. */
  const facts = $derived(detail.data ? jobFacts(detail.data.job, { editableLocation: detail.data.job.status !== 'awaiting' }) : []);
</script>

<div class="stack" data-ui="job-detail">
  {#if detail.status === 'loading'}
    <Skeleton lines={6} />
  {:else if detail.status === 'error'}
    <ErrorBlock error={detail.error} onretry={invalidate} />
  {:else if detail.data}
    {@const job = detail.data.job}
    {@const current = jobStatus(job)}
    {@const jobUrl = safeHttpUrl(job.url)}
    {@const canDelete = detail.data.applications.length === 0}
    <Card ui="job-detail.summary">
      <div class="page-title">
        <h1>{job.title}</h1>
        {#if job.status !== 'awaiting'}
          <Button variant="primary" label={tr('ui.job.createApplicationLabel')} ui="job-detail.create-application" onclick={() => (creating = true)}><Icon name="plus" size={18} />{tr('ui.job.createApplicationShort')}</Button>
        {/if}
      </div>
      <div class="summary">
        <div class="side">
          {#if job.status !== 'awaiting'}
            <select class="input" aria-label={tr('ui.job.status')} data-ui="job-detail.status" value={current.code} onchange={(event) => changeStatus(event.currentTarget.value, event.currentTarget)}>
              {#each jobStatusOptions() as option (option.code)}<option value={option.code}>{option.text}</option>{/each}
            </select>
          {/if}
          {#if job.status !== 'awaiting' || jobUrl !== '' || job.folder_url !== '' || canDelete}
            <div class="actions" role="group" aria-label={tr('ui.job.actions')} data-ui="job-detail.actions">
              {#if job.status !== 'awaiting'}
                <Button label={jobUrl === '' ? tr('ui.job.addLinkFirst') : tr('ui.job.refresh')} ui="job-detail.refresh" disabled={jobUrl === ''} onclick={refresh}><Icon name="refresh" size={18} /></Button>
                <Button label={jobUrl === '' ? tr('ui.job.addLinkFirst') : tr('ui.job.checkAvailability')} ui="job-detail.check-availability" disabled={jobUrl === ''} onclick={checkAvailability}><Icon name="check" size={18} /></Button>
              {/if}
              {#if jobUrl !== ''}
                <a class="btn tool" data-ui="job-detail.url-link" href={jobUrl} target="_blank" rel="noopener noreferrer" aria-label={tr('ui.job.open')} title={tr('ui.job.open')}><Icon name="external" size={18} /></a>
              {:else if job.status !== 'awaiting'}
                <Button variant="alert" label={tr('ui.job.noLink')} ui="job-detail.url-link" onclick={() => (linking = true)}><Icon name="external" size={18} /></Button>
              {/if}
              {#if job.folder_url !== ''}
                <a class="btn tool" data-ui="job-detail.folder-link" href={job.folder_url} target="_blank" rel="noopener noreferrer" aria-label={tr('ui.job.folder')} title={tr('ui.job.folder')}><Icon name="folder" size={18} /></a>
              {/if}
              {#if canDelete && job.status !== 'awaiting'}
                <Button label={tr('ui.job.deleteIcon')} ui="job-detail.delete-icon" onclick={() => (deleting = true)}><Icon name="trash" size={18} /></Button>
              {/if}
            </div>
          {/if}
        </div>
        <div class="main stack">
          {#if (detail.data.company?.name ?? '') !== ''}<p class="muted">{detail.data.company?.name}</p>{/if}
          <div class="row wrap">
            <Badge text={availabilityLabel(job.availability)} color={job.availability === 'online' ? 'var(--success-soft)' : job.availability === 'offline' ? 'var(--danger-soft)' : 'var(--surface-2)'} textColor="var(--text)" />
            <Badge text={current.text} color={current.color} textColor={current.textColor} />
            {#if job.is_gig}<Badge text={tr('ui.job.gig')} color="var(--accent-soft)" textColor="var(--text)" />{/if}
            {#if job.is_gig && job.gig_priority === true}<Badge text={tr('ui.job.gigPriority')} color="var(--danger-soft)" textColor="var(--text)" />{/if}
            {#if typeof job.match_percent === 'number' && current.code !== 'new'}<span class="muted small">{tr('jobStatus.match', { percent: job.match_percent })}</span>{/if}
            {#if job.last_checked_at !== ''}<span class="muted small">{tr('ui.job.checked', { date: formatDate(job.last_checked_at) })}</span>{/if}
            {#if job.availability_reason !== ''}<span class="muted small" data-ui="job-detail.availability-reason">{availabilityReasonLabel(job.availability_reason)}</span>{/if}
            {#if job.flags.includes('snapshot_missing')}<span class="warn small">{tr('ui.job.snapshotMissing')}</span>{/if}
          </div>
          {#if facts.length > 0}
            <dl class="facts" data-ui="job-detail.info">
              {#each facts as fact (fact.key)}
                {#if fact.key === 'work-mode'}
                  {#if job.status !== 'awaiting'}<WorkModeBoxes jobId={job.id} isRemote={job.is_remote} isHybrid={job.is_hybrid} ui="job-detail" />{/if}
                {:else if fact.key === 'location' && job.status !== 'awaiting'}
                  <InlineText label={fact.label} value={job.location ?? ''} maxlength={300} ui="job-detail.location" onsave={(text) => api.updateJob(job.id, { location: text })} />
                {:else}
                  <div class="fact" class:wide={fact.key === 'ai-salary'} data-ui="job-detail.info.{fact.key}"><dt class="muted small">{fact.label}</dt><dd>{fact.value}</dd></div>
                {/if}
              {/each}
              {#if job.status !== 'awaiting'}
                <GigBox jobId={job.id} isGig={job.is_gig} isPriority={job.gig_priority === true} ui="job-detail" />
                <InlineText wide="two" label={tr('ui.job.contactPerson')} value={job.contact_person ?? ''} maxlength={300} ui="job-detail.contact-person" onsave={(text) => api.updateJob(job.id, { contact_person: text })} />
                {#if job.is_gig}
                  <InlineText wide="two" label={tr('ui.job.gigShift')} value={job.gig_shift ?? ''} maxlength={300} placeholder={tr('ui.job.gigShiftPlaceholder')} ui="job-detail.gig-shift" onsave={(text) => api.updateJob(job.id, { gig_shift: text })} />
                {/if}
                <InlineText wide="full" label={tr('ui.job.link')} value={job.url ?? ''} maxlength={2000} placeholder="https://" ui="job-detail.link" onsave={(text) => api.updateJob(job.id, { url: text })} />
                {#if current.code === 'no' || (job.no_reason ?? '') !== ''}
                  <InlineText wide="full" label={tr('ui.job.noReason')} value={job.no_reason ?? ''} maxlength={1000} placeholder={tr('ui.job.noReasonPlaceholder')} ui="job-detail.no-reason" bind:editing={reasonEditing} onsave={(text) => api.updateJob(job.id, { no_reason: text })} />
                {/if}
              {/if}
            </dl>
          {/if}
        </div>
      </div>
    </Card>

    {#if job.status === 'awaiting'}
      <Card ui="job.awaiting">
        <p>{tr('ui.job.awaitingNotice')}</p>
        <div><Button variant="danger" ui="job-detail.delete" onclick={() => (deleting = true)}><Icon name="trash" size={18} />{tr('ui.job.delete')}</Button></div>
      </Card>
    {/if}
    <AddLinkDialog open={linking} job={{ id: job.id, title: job.title }} onclose={() => (linking = false)} />
    {#if canDelete}
      <DeleteJobDialog open={deleting} job={{ id: job.id, title: job.title, folder_url: job.folder_url }} onclose={() => (deleting = false)} ondeleted={() => navigate(paths.jobs)} />
    {/if}

    <Card ui="job-detail.tabs">
      <Tabs
        items={[
          { id: 'applications', label: tr('ui.job.tab.applications'), count: detail.data.applications.length },
          { id: 'timeline', label: tr('ui.job.tab.timeline') },
          { id: 'communication', label: tr('ui.job.tab.communication'), count: detail.data.communications?.length },
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
        {:else if tab === 'timeline'}
          <TimelineTab job={detail.data} />
        {:else if tab === 'communication'}
          <JobCommunicationsTab job={detail.data} />
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
          <MatchTab jobId={job.id} jobTitle={job.title} match={detail.data.match} note={job.match_note} />
        {/if}
      </div>
    </Card>

    <WithdrawDialog open={withdrawing !== undefined} jobTitle={job.title} jobStatusText={jobStatusOptions().find((option) => option.code === 'no')?.text ?? 'No'} applications={withdrawing ?? []} onclose={() => (withdrawing = undefined)} onchoose={(withdraw) => applyStatus('no', withdraw ? (withdrawing ?? []) : [])} ui="job-detail.withdraw" />
    <CreateApplicationDialog open={creating} {job} applications={detail.data.applications} onclose={() => (creating = false)} />
  {/if}
</div>

<style>
  .description { white-space: pre-wrap; }
  .summary { display: grid; --icons-w: calc(2 * var(--tap) + var(--space-2)); grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'main side'; gap: var(--space-4); align-items: start; }
  .main { grid-area: main; min-width: 0; }
  .side { grid-area: side; display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; padding-left: var(--space-4); border-left: 1px solid var(--border); }
  .side select { width: var(--icons-w); max-width: 100%; }
  .actions { display: grid; grid-template-columns: repeat(2, var(--tap)); gap: var(--space-2); }
  .actions :global(.btn) { min-width: var(--tap); width: var(--tap); padding: 0; }
  .tool { display: inline-flex; align-items: center; justify-content: center; min-height: var(--tap); color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-s); text-decoration: none; }
  .tool:hover { border-color: var(--accent); }
  @media (max-width: 600px) {
    .summary { grid-template-columns: 1fr; grid-template-areas: 'side' 'main'; }
    .side { padding-left: 0; border-left: 0; }
  }
  .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: var(--space-2) var(--space-4); margin: 0; }
  .fact { min-width: 0; overflow-wrap: anywhere; }
  .fact dd { margin: 0; }
  .fact.wide { grid-column: 1 / -1; }
  .warn { color: var(--warning); font-weight: 600; }
  .check { display: flex; align-items: center; gap: var(--space-2); min-height: var(--tap); }
</style>
