<script lang="ts">
  import { APPLICATION_STATUSES, DEFAULT_TRANSITIONS, type ApplicationStatus } from '@jobhunters/core';
  import { api } from '../api';
  import Button from '../components/Button.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import ErrorBlock from '../components/ErrorBlock.svelte';
  import Field from '../components/Field.svelte';
  import MultiSelect from '../components/MultiSelect.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import StatusBadge from '../components/StatusBadge.svelte';
  import { filterApplications } from '../lib/filters';
  import { formatDate } from '../lib/format';
  import { tr } from '../lib/i18n.svelte';
  import { useResource } from '../lib/resource.svelte';
  import { paths } from '../lib/route';
  import { navigate, router } from '../lib/router.svelte';
  import { statusStyle } from '../lib/status';
  import { app } from '../state/app.svelte';
  import { invalidate } from '../state/invalidate.svelte';
  import { saveUiState, uiState } from '../state/ui-state';
  import KanbanBoard from './KanbanBoard.svelte';

  const applications = useResource(() => api.listApplications());
  let text = $state('');
  let statusChoice = $state<string[]>();
  const kanban = $derived(uiState().applications_kanban);
  // A link such as #/applications?status=sent selects the status of the list; the user's own choice wins afterwards.
  const selected = $derived(statusChoice ?? (!kanban && router.current.query.status ? [router.current.query.status] : kanban ? uiState().applications_status_board : uiState().applications_status_list));
  const rows = $derived(filterApplications(applications.data ?? [], { text, statuses: kanban ? [] : selected }));
  const columns = $derived<ApplicationStatus[]>(APPLICATION_STATUSES.filter((status) => selected.length === 0 || selected.includes(status)));
  const statusOptions = $derived(APPLICATION_STATUSES.map((status) => ({ value: status, text: statusStyle(status).text })));

  function chooseStatuses(next: string[]): void {
    statusChoice = next;
    saveUiState(kanban ? { applications_status_board: next } : { applications_status_list: next });
  }

  function setKanban(on: boolean): void {
    statusChoice = undefined;
    saveUiState({ applications_kanban: on });
  }
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
      <MultiSelect ui="applications.status" label={tr('ui.apps.status')} allLabel={tr('ui.apps.allStatuses')} options={statusOptions} {selected} onchange={chooseStatuses} />
      <label class="check"><input type="checkbox" checked={kanban} onchange={(event) => setKanban(event.currentTarget.checked)} />{tr('ui.apps.kanban')}</label>
      {#if kanban}
        <label class="check"><input type="checkbox" checked={uiState().applications_hide_empty} onchange={(event) => saveUiState({ applications_hide_empty: event.currentTarget.checked })} />{tr('ui.apps.hideEmpty')}</label>
      {/if}
    </div>

    {#if kanban}
      <KanbanBoard rows={filterApplications(applications.data ?? [], { text })} statuses={columns} hideEmpty={uiState().applications_hide_empty} transitions={app.settings?.status_transitions ?? DEFAULT_TRANSITIONS} onmoved={invalidate} />
    {:else if rows.length === 0}
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
  .check { display: flex; align-items: center; gap: var(--space-2); min-height: var(--tap); }
</style>
