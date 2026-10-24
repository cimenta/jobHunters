<script lang="ts">
  import { APPLICATION_STATUSES } from '@jobhunters/core';
  import { api } from '../api';
  import type { DashboardReminder } from '../api/types';
  import Button from '../components/Button.svelte';
  import Card from '../components/Card.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import ErrorBlock from '../components/ErrorBlock.svelte';
  import Icon from '../components/Icon.svelte';
  import PostponeDialog from '../components/PostponeDialog.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import StatusBadge from '../components/StatusBadge.svelte';
  import { formatDate, shorten } from '../lib/format';
  import { tr } from '../lib/i18n.svelte';
  import { AI_TASK_TYPES, aiTaskTypeLabel } from '../lib/labels';
  import { useResource } from '../lib/resource.svelte';
  import { paths } from '../lib/route';
  import { navigate } from '../lib/router.svelte';
  import { saveUiState, uiState } from '../state/ui-state';
  import { invalidate } from '../state/invalidate.svelte';
  import { toast } from '../state/toast.svelte';

  const dashboard = useResource(() => api.getDashboard());
  let postponing = $state<DashboardReminder>();

  const groups = $derived(
    dashboard.data
      ? [
          { key: 'overdue', title: tr('ui.dashboard.overdue'), items: dashboard.data.reminders.overdue },
          { key: 'today', title: tr('ui.dashboard.today'), items: dashboard.data.reminders.today },
          { key: 'soon', title: tr('ui.dashboard.soon'), items: dashboard.data.reminders.soon },
        ].filter((group) => group.items.length > 0)
      : [],
  );
  const gig = $derived(uiState().dashboard_gig);
  const counts = $derived(
    APPLICATION_STATUSES.map((status) => {
      const all = dashboard.data?.statusCounts[status] ?? 0;
      const gigs = dashboard.data?.gigStatusCounts?.[status] ?? 0;
      return { status, count: gig === 'only' ? gigs : gig === 'except' ? all - gigs : all };
    }).filter((entry) => entry.count > 0),
  );
  const total = $derived(counts.reduce((sum, entry) => sum + entry.count, 0));

  const aiTasks = $derived.by(() => {
    const waiting = dashboard.data?.aiTasksWaiting ?? { total: 0, byType: {} };
    const known = AI_TASK_TYPES.filter((type) => (waiting.byType[type] ?? 0) > 0).map((type) => ({ type, count: waiting.byType[type]! }));
    const other = Object.entries(waiting.byType)
      .filter(([type]) => !AI_TASK_TYPES.includes(type))
      .reduce((sum, [, count]) => sum + count, 0);
    const rows = other > 0 ? [...known.filter((row) => row.type !== 'other'), { type: 'other', count: (waiting.byType.other ?? 0) + other }] : known;
    return { total: waiting.total, rows };
  });

  async function complete(reminder: DashboardReminder): Promise<void> {
    await api.completeReminder(reminder.id);
    toast.success(tr('ui.reminder.completed', { text: shorten(reminder.text, 40) }));
    invalidate();
  }

  async function postpone(date: string): Promise<void> {
    if (!postponing) return;
    const target = postponing;
    await api.postponeReminder(target.id, date);
    toast.success(tr('ui.reminder.postponed', { date: formatDate(date), text: shorten(target.text, 40) }));
    invalidate();
  }
</script>

<div class="stack-lg" data-ui="dashboard">
  <div class="page-title">
    <h1>{tr('ui.nav.dashboard')}</h1>
    <Button variant="primary" ui="dashboard.add-job" onclick={() => navigate(paths.newJob)}><Icon name="plus" size={18} />{tr('ui.dashboard.addJob')}</Button>
  </div>

  {#if dashboard.status === 'loading'}
    <Skeleton lines={6} />
  {:else if dashboard.status === 'error'}
    <ErrorBlock error={dashboard.error} onretry={invalidate} />
  {:else}
    <Card ui="dashboard.reminders">
      <h2>{tr('ui.dashboard.reminders')}</h2>
      {#if groups.length === 0}
        <EmptyState ui="dashboard.no-reminders" icon="check" title={tr('ui.dashboard.noReminders')} />
      {:else}
        {#each groups as group (group.key)}
          <div class="group" class:overdue={group.key === 'overdue'}>
            <h3>{group.title}</h3>
            <ul class="list">
              {#each group.items as reminder (reminder.id)}
                <li class="list-item reminder" data-ui="reminder.{reminder.id}">
                  <div class="grow">
                    <p class="text">{reminder.text}</p>
                    <p class="muted small">
                      {[reminder.job_title, reminder.company_name, formatDate(reminder.due_at)].filter((part) => part !== '').join(' · ')}
                    </p>
                  </div>
                  {#if reminder.application_label !== ''}
                    <Button variant="ghost" ui="reminder.open.{reminder.id}" label={tr('ui.reminder.openApplication')} onclick={() => navigate(paths.application(reminder.application_id))}>
                      <Icon name="external" size={18} />
                    </Button>
                  {/if}
                  <Button variant="ghost" ui="reminder.done.{reminder.id}" label={tr('ui.reminder.done')} onclick={() => complete(reminder)}><Icon name="check" size={18} /></Button>
                  <Button variant="ghost" ui="reminder.postpone.{reminder.id}" label={tr('ui.reminder.postpone')} onclick={() => (postponing = reminder)}><Icon name="clock" size={18} /></Button>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      {/if}
    </Card>

    <Card ui="dashboard.ai-tasks">
      <h2>{tr('ui.dashboard.aiTasks')}</h2>
      {#if aiTasks.total === 0}
        <p class="muted">{tr('ui.dashboard.aiTasksNone')}</p>
      {:else}
        <p class="big"><strong>{aiTasks.total}</strong></p>
        <ul class="plain">
          {#each aiTasks.rows as row (row.type)}
            <li><a href={paths.tasks} data-ui="dashboard.ai-tasks.{row.type}">{aiTaskTypeLabel(row.type)} – {row.count}</a></li>
          {/each}
        </ul>
        <p class="muted small">{tr('ui.dashboard.aiTasksHint')}</p>
      {/if}
    </Card>

    <Card ui="dashboard.status-counts">
      <div class="head">
        <h2>{tr('ui.dashboard.applications')}<span class="total" data-ui="dashboard.total">{tr('ui.dashboard.total')} <strong>{total}</strong></span></h2>
        <span class="seg" role="group" data-ui="dashboard.gig" title={tr('ui.jobs.gigHint')} aria-label={tr('ui.dashboard.gigGroup')}>
          <button type="button" data-ui="dashboard.gig.only" aria-pressed={gig === 'only'} onclick={() => saveUiState({ dashboard_gig: gig === 'only' ? '' : 'only' })}>{tr('ui.jobs.gigOnly')}</button>
          <button type="button" data-ui="dashboard.gig.except" aria-pressed={gig === 'except'} onclick={() => saveUiState({ dashboard_gig: gig === 'except' ? '' : 'except' })}>{tr('ui.jobs.gigExcept')}</button>
        </span>
      </div>
      {#if counts.length === 0}
        <p class="muted">{tr('ui.dashboard.noApplications')}</p>
      {:else}
        <ul class="counts">
          {#each counts as entry (entry.status)}
            <li>
              <a href={paths.applicationsWithStatus(entry.status)} class="count-link" data-ui="dashboard.count.{entry.status}">
                <StatusBadge status={entry.status} /><strong>{entry.count}</strong>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </Card>
  {/if}
</div>

<PostponeDialog open={postponing !== undefined} onclose={() => (postponing = undefined)} onconfirm={postpone} />

<style>
  .group { display: flex; flex-direction: column; gap: var(--space-2); }
  .group.overdue h3 { color: var(--danger); }
  .reminder { align-items: flex-start; flex-wrap: wrap; }
  .reminder .grow { flex: 1 1 14rem; }
  .text { font-weight: 600; }
  .big { font-size: var(--text-xl, 2rem); margin: 0; }
  .plain { padding: 0; margin: 0; list-style: none; }
  .head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-2); }
  .total { display: inline-block; margin-left: var(--space-2); padding: 2px var(--space-2); font-size: var(--text-s); font-weight: 400; vertical-align: middle; background: var(--accent-soft); border: 1px solid var(--accent); border-radius: var(--radius-m); }
  .seg { display: inline-flex; border: 1px solid var(--accent); border-radius: var(--radius-s); overflow: hidden; background: var(--surface); }
  .seg button { min-height: 28px; padding: 0 var(--space-2); font: inherit; font-size: var(--text-s); color: var(--text); background: var(--surface); border: 0; cursor: pointer; white-space: nowrap; }
  .seg button + button { border-left: 1px solid var(--accent); }
  .seg button:hover { background: var(--accent-soft); }
  .seg button[aria-pressed='true'] { color: var(--on-accent); font-weight: 600; background: var(--accent); }
  .counts { display: flex; flex-wrap: wrap; gap: var(--space-3); padding: 0; margin: 0; list-style: none; }
  .count-link { display: inline-flex; align-items: center; gap: var(--space-2); min-height: var(--tap); padding: 0 var(--space-3); color: var(--text); text-decoration: none; border: 1px solid var(--border); border-radius: var(--radius-m); }
  .count-link:hover { border-color: var(--accent); }
</style>
