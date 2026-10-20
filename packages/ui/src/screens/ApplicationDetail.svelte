<script lang="ts">
  import { api } from '../api';
  import Card from '../components/Card.svelte';
  import ErrorBlock from '../components/ErrorBlock.svelte';
  import Icon from '../components/Icon.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import InlineText from '../components/InlineText.svelte';
  import Badge from '../components/Badge.svelte';
  import StatusBadge from '../components/StatusBadge.svelte';
  import Tabs from '../components/Tabs.svelte';
  import WorkModeBoxes from '../components/WorkModeBoxes.svelte';
  import { formatDate, safeHttpUrl } from '../lib/format';
  import { jobFacts, matchColor } from '../lib/job-facts';
  import { tr } from '../lib/i18n.svelte';
  import { useResource } from '../lib/resource.svelte';
  import { paths } from '../lib/route';
  import { invalidate } from '../state/invalidate.svelte';
  import Button from '../components/Button.svelte';
  import AddLinkDialog from './AddLinkDialog.svelte';
  import StatusControl from './StatusControl.svelte';
  import AdTab from './tabs/AdTab.svelte';
  import CommunicationsTab from './tabs/CommunicationsTab.svelte';
  import DocumentsTab from './tabs/DocumentsTab.svelte';
  import QuestionsTab from './tabs/QuestionsTab.svelte';
  import InterviewTab from './tabs/InterviewTab.svelte';
  import RemindersTab from './tabs/RemindersTab.svelte';
  import TimelineTab from './tabs/TimelineTab.svelte';

  let { id }: { id: string } = $props();

  const detail = useResource(() => api.getApplication(id), () => id);
  let tab = $state('ad');
  /** Whether the window that asks for the link of an ad without one is open. */
  let linking = $state(false);
  /** Whether the field "Reason why not" is open for typing; it opens right after the status was changed to Withdrawn. */
  let reasonEditing = $state(false);

  const items = $derived(
    detail.data
      ? [
          { id: 'ad', label: tr('ui.app.tab.ad') },
          { id: 'documents', label: tr('ui.app.tab.documents'), count: detail.data.documents.length },
          { id: 'questions', label: tr('ui.app.tab.questions'), count: detail.data.questions.length },
          { id: 'communications', label: tr('ui.app.tab.communications'), count: detail.data.communications.length },
          { id: 'interview', label: tr('ui.app.tab.interview') },
          { id: 'reminders', label: tr('ui.app.tab.reminders'), count: detail.data.reminders.filter((r) => r.status === 'open').length },
          { id: 'timeline', label: tr('ui.app.tab.timeline') },
        ]
      : [],
  );
</script>

<div class="stack" data-ui="application-detail">
  {#if detail.status === 'loading'}
    <Skeleton lines={6} />
  {:else if detail.status === 'error'}
    <ErrorBlock error={detail.error} onretry={invalidate} />
  {:else if detail.data}
    {@const application = detail.data.application}
    {@const job = detail.data.job}
    {@const adUrl = job ? safeHttpUrl(job.url) : ''}
    {@const facts = job ? jobFacts(job, { editableLocation: true }) : []}
    <Card ui="application-detail.header">
      <div class="page-title">
        <h1>{application.label}</h1>
      </div>
      <div class="summary">
        <div class="side">
          <StatusControl {application} onchanged={(to) => { if (to === 'withdrawn') reasonEditing = true; }} />
          <div class="actions" role="group" aria-label={tr('ui.job.actions')} data-ui="application-detail.actions">
            {#if job}
              <a class="btn tool" data-ui="application-detail.job-link" href={paths.job(job.id)} aria-label={tr('ui.app.openJob')} title={tr('ui.app.openJob')}><Icon name="briefcase" size={18} /></a>
            {/if}
            {#if detail.data.company}
              <a class="btn tool" data-ui="application-detail.company-link" href={paths.company(detail.data.company.id)} aria-label={tr('ui.app.openCompany')} title={tr('ui.app.openCompany')}><Icon name="building" size={18} /></a>
            {/if}
            {#if adUrl !== ''}
              <a class="btn tool" data-ui="application-detail.ad-link" href={adUrl} target="_blank" rel="noopener noreferrer" aria-label={tr('ui.app.openAdWeb')} title={tr('ui.app.openAdWeb')}><Icon name="external" size={18} /></a>
            {:else if job}
              <Button variant="alert" label={tr('ui.job.noLink')} ui="application-detail.ad-link" onclick={() => (linking = true)}><Icon name="external" size={18} /></Button>
            {/if}
            {#if application.folder_url !== ''}
              <a class="btn tool" data-ui="application-detail.folder-link" href={application.folder_url} target="_blank" rel="noopener noreferrer" aria-label={tr('ui.app.folder')} title={tr('ui.app.folder')}><Icon name="folder" size={18} /></a>
            {/if}
          </div>
        </div>
        <div class="main stack">
          {#if detail.data.company}<p class="muted">{detail.data.company.name}</p>{/if}
          <div class="row wrap">
            <StatusBadge status={application.status} />
            {#if job && typeof job.match_percent === 'number'}
              <Badge text={tr('jobStatus.match', { percent: job.match_percent })} color={matchColor(job.match_percent)} textColor="var(--text)" />
            {/if}
            {#if application.applied_at !== ''}<span class="muted small">{tr('ui.app.appliedAt', { date: formatDate(application.applied_at) })}</span>{/if}
            {#if application.language === 'en' || application.language === 'cs'}
              <span class="muted small" data-ui="application-detail.language">{tr('ui.app.language', { language: tr(`ui.language.${application.language}`) })}</span>
            {/if}
          </div>
          {#if facts.length > 0}
            <dl class="facts" data-ui="application-detail.info">
              {#each facts as fact (fact.key)}
                {#if fact.key === 'work-mode'}
                  {#if job}<WorkModeBoxes jobId={job.id} isRemote={job.is_remote} isHybrid={job.is_hybrid} ui="application-detail" />{/if}
                {:else if fact.key === 'ai-salary'}
                  <!-- The salary asked for sits right next to the AI estimate, on the same row. -->
                  <div class="pair">
                    <div class="fact" data-ui="application-detail.info.{fact.key}"><dt class="muted small">{fact.label}</dt><dd>{fact.value}</dd></div>
                    <InlineText label={tr('ui.app.askedSalary')} value={application.salary ?? ''} ui="application-detail.asked-salary" onsave={(text) => api.updateApplication(application.id, { salary: text })} />
                  </div>
                {:else if fact.key === 'location' && job}
                  <InlineText label={fact.label} value={job.location ?? ''} maxlength={300} ui="application-detail.location" onsave={(text) => api.updateJob(job.id, { location: text })} />
                {:else}
                  <div class="fact" data-ui="application-detail.info.{fact.key}"><dt class="muted small">{fact.label}</dt><dd>{fact.value}</dd></div>
                {/if}
              {/each}
              {#if !facts.some((fact) => fact.key === 'ai-salary')}
                <InlineText label={tr('ui.app.askedSalary')} value={application.salary ?? ''} ui="application-detail.asked-salary" onsave={(text) => api.updateApplication(application.id, { salary: text })} />
              {/if}
              {#if job}
                <InlineText wide="two" label={tr('ui.job.contactPerson')} value={job.contact_person ?? ''} maxlength={300} ui="application-detail.contact-person" onsave={(text) => api.updateJob(job.id, { contact_person: text })} />
                {#if application.status === 'withdrawn' || reasonEditing || (job.no_reason ?? '') !== ''}
                  <InlineText wide="full" label={tr('ui.job.noReason')} value={job.no_reason ?? ''} maxlength={1000} placeholder={tr('ui.job.noReasonPlaceholder')} ui="application-detail.no-reason" bind:editing={reasonEditing} onsave={(text) => api.updateJob(job.id, { no_reason: text })} />
                {/if}
              {/if}
            </dl>
          {/if}
        </div>
      </div>
    </Card>

    {#if job}
      <AddLinkDialog open={linking} job={{ id: job.id, title: job.title }} onclose={() => (linking = false)} />
    {/if}

    <Card ui="application-detail.tabs">
      <Tabs {items} bind:active={tab} label={tr('ui.app.tabs')} />
      <div role="tabpanel" data-ui="application-detail.panel" id="panel-{tab}" aria-labelledby="tab-{tab}">
        {#if tab === 'ad'}
          <AdTab detail={detail.data} />
        {:else if tab === 'documents'}
          <DocumentsTab detail={detail.data} />
        {:else if tab === 'questions'}
          <QuestionsTab detail={detail.data} />
        {:else if tab === 'communications'}
          <CommunicationsTab detail={detail.data} />
        {:else if tab === 'interview'}
          <InterviewTab detail={detail.data} />
        {:else if tab === 'reminders'}
          <RemindersTab detail={detail.data} />
        {:else}
          <TimelineTab detail={detail.data} />
        {/if}
      </div>
    </Card>
  {/if}
</div>

<style>
  .summary { display: grid; --icons-w: calc(2 * var(--tap) + var(--space-2)); grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'main side'; gap: var(--space-4); align-items: start; }
  .main { grid-area: main; min-width: 0; }
  .side { grid-area: side; display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; padding-left: var(--space-4); border-left: 1px solid var(--border); }
  .actions { display: grid; grid-template-columns: repeat(2, var(--tap)); gap: var(--space-2); }
  .tool { display: inline-flex; align-items: center; justify-content: center; width: var(--tap); min-height: var(--tap); color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-s); text-decoration: none; }
  .tool:hover { border-color: var(--accent); }
  .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: var(--space-2) var(--space-4); margin: 0; }
  .fact { min-width: 0; overflow-wrap: anywhere; }
  .fact dd { margin: 0; }
  .pair { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); }
  .pair > :global(.fact) { flex: 1 1 220px; }
  @media (max-width: 600px) {
    .summary { grid-template-columns: 1fr; grid-template-areas: 'side' 'main'; }
    .side { padding-left: 0; border-left: 0; }
  }
</style>
