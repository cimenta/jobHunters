<script lang="ts">
  import { APPLICATION_STATUSES } from '@jobhunters/core';
  import { api } from '../api';
  import Button from '../components/Button.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import ErrorBlock from '../components/ErrorBlock.svelte';
  import Field from '../components/Field.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import StatusBadge from '../components/StatusBadge.svelte';
  import { filterApplications } from '../lib/filters';
  import { formatDate } from '../lib/format';
  import { tr } from '../lib/i18n.svelte';
  import { useResource } from '../lib/resource.svelte';
  import { paths } from '../lib/route';
  import { navigate, router } from '../lib/router.svelte';
  import { statusStyle } from '../lib/status';
  import { invalidate } from '../state/invalidate.svelte';

  const applications = useResource(() => api.listApplications());
  let text = $state('');
  let statusChoice = $state<string>();
  // A link such as #/applications?status=sent selects the status; the user's own choice wins afterwards.
  const status = $derived(statusChoice ?? router.current.query.status ?? '');
  const rows = $derived(filterApplications(applications.data ?? [], { text, status }));
</script>

<div class="stack" data-ui="applications">
  <div class="page-title"><h1>{tr('ui.nav.applications')}</h1></div>

  {#if applications.status === 'loading'}
    <Skeleton lines={5} />
  {:else if applications.status === 'error'}
    <ErrorBlock error={applications.error} onretry={invalidate} />
  {:else if (applications.data ?? []).length === 0}
    <EmptyState ui="applications.empty" icon="file" title={tr('ui.apps.emptyTitle')} text={tr('ui.apps.emptyText')}>
      <Button variant="primary" onclick={() => navigate(paths.jobs)}>{tr('ui.apps.goToJobs')}</Button>
    </EmptyState>
  {:else}
    <div class="filters" data-ui="applications.filters">
      <Field label={tr('ui.jobs.search')} for="app-search">
        <input id="app-search" class="input" type="search" bind:value={text} />
      </Field>
      <Field label={tr('ui.apps.status')} for="app-status">
        <select id="app-status" class="input" value={status} onchange={(event) => (statusChoice = event.currentTarget.value)}>
          <option value="">{tr('ui.apps.allStatuses')}</option>
          {#each APPLICATION_STATUSES as option (option)}
            <option value={option}>{statusStyle(option).text}</option>
          {/each}
        </select>
      </Field>
    </div>

    {#if rows.length === 0}
      <EmptyState title={tr('ui.jobs.noMatchTitle')} text={tr('ui.jobs.noMatchText')} />
    {:else}
      <ul class="list" data-ui="applications.list">
        {#each rows as application (application.id)}
          <li>
            <a class="list-item" data-ui="application.{application.id}" href={paths.application(application.id)} aria-current={router.current.id === application.id ? 'true' : undefined}>
              <span class="grow stack-tight">
                <span class="label">{application.label}</span>
                <span class="muted small">{[application.job_title, application.company_name].filter((part) => part !== '').join(' · ')}</span>
                {#if application.last_activity_at !== ''}
                  <span class="muted small">{tr('ui.apps.lastActivity', { date: formatDate(application.last_activity_at) })}</span>
                {/if}
              </span>
              <StatusBadge status={application.status} />
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<style>
  .filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-3); }
  .stack-tight { display: flex; flex-direction: column; gap: 2px; }
  .label { font-weight: 600; }
</style>
