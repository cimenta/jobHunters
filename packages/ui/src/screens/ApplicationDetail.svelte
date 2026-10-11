<script lang="ts">
  import { api } from '../api';
  import Button from '../components/Button.svelte';
  import Card from '../components/Card.svelte';
  import ErrorBlock from '../components/ErrorBlock.svelte';
  import Icon from '../components/Icon.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import StatusBadge from '../components/StatusBadge.svelte';
  import Tabs from '../components/Tabs.svelte';
  import { formatDate } from '../lib/format';
  import { tr } from '../lib/i18n.svelte';
  import { useResource } from '../lib/resource.svelte';
  import { paths } from '../lib/route';
  import { navigate } from '../lib/router.svelte';
  import { invalidate } from '../state/invalidate.svelte';
  import StatusControl from './StatusControl.svelte';
  import CommunicationsTab from './tabs/CommunicationsTab.svelte';
  import DocumentsTab from './tabs/DocumentsTab.svelte';
  import QuestionsTab from './tabs/QuestionsTab.svelte';
  import RemindersTab from './tabs/RemindersTab.svelte';
  import TimelineTab from './tabs/TimelineTab.svelte';

  let { id }: { id: string } = $props();

  const detail = useResource(() => api.getApplication(id), () => id);
  let tab = $state('documents');

  const items = $derived(
    detail.data
      ? [
          { id: 'documents', label: tr('ui.app.tab.documents'), count: detail.data.documents.length },
          { id: 'questions', label: tr('ui.app.tab.questions'), count: detail.data.questions.length },
          { id: 'communications', label: tr('ui.app.tab.communications'), count: detail.data.communications.length },
          { id: 'reminders', label: tr('ui.app.tab.reminders'), count: detail.data.reminders.filter((r) => r.status === 'open').length },
          { id: 'timeline', label: tr('ui.app.tab.timeline') },
        ]
      : [],
  );
</script>

<div class="stack" data-ui="application-detail">
  <div class="only-narrow">
    <Button variant="ghost" onclick={() => navigate(paths.applications)}><Icon name="back" size={18} />{tr('ui.back')}</Button>
  </div>

  {#if detail.status === 'loading'}
    <Skeleton lines={6} />
  {:else if detail.status === 'error'}
    <ErrorBlock error={detail.error} onretry={invalidate} />
  {:else if detail.data}
    {@const application = detail.data.application}
    <Card ui="application-detail.header">
      <div class="page-title">
        <h1>{application.label}</h1>
        <StatusBadge status={application.status} />
      </div>
      <div class="row wrap small">
        {#if detail.data.job}<a href={paths.job(detail.data.job.id)}>{tr('ui.app.job')}: {detail.data.job.title}</a>{/if}
        {#if detail.data.company}<a href={paths.company(detail.data.company.id)}>{tr('ui.app.company')}: {detail.data.company.name}</a>{/if}
        {#if application.folder_url !== ''}
          <a href={application.folder_url} target="_blank" rel="noopener noreferrer" class="row"><Icon name="external" size={16} />{tr('ui.app.folder')}</a>
        {/if}
        {#if application.applied_at !== ''}<span class="muted">{tr('ui.app.appliedAt', { date: formatDate(application.applied_at) })}</span>{/if}
      </div>
      <StatusControl {application} />
    </Card>

    <Card ui="application-detail.tabs">
      <Tabs {items} bind:active={tab} label={tr('ui.app.tabs')} />
      <div role="tabpanel" data-ui="application-detail.panel" id="panel-{tab}" aria-labelledby="tab-{tab}">
        {#if tab === 'documents'}
          <DocumentsTab detail={detail.data} />
        {:else if tab === 'questions'}
          <QuestionsTab detail={detail.data} />
        {:else if tab === 'communications'}
          <CommunicationsTab detail={detail.data} />
        {:else if tab === 'reminders'}
          <RemindersTab detail={detail.data} />
        {:else}
          <TimelineTab detail={detail.data} />
        {/if}
      </div>
    </Card>
  {/if}
</div>
