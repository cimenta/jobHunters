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
  import { useResource } from '../lib/resource.svelte';
  import { paths } from '../lib/route';
  import { navigate } from '../lib/router.svelte';
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
  const counts = $derived(
    APPLICATION_STATUSES.map((status) => ({ status, count: dashboard.data?.statusCounts[status] ?? 0 })).filter((entry) => entry.count > 0),
  );

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
        <EmptyState icon="check" title={tr('ui.dashboard.noReminders')} />
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

    <Card ui="dashboard.status-counts">
      <h2>{tr('ui.dashboard.applications')}</h2>
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
  .counts { display: flex; flex-wrap: wrap; gap: var(--space-3); padding: 0; margin: 0; list-style: none; }
  .count-link { display: inline-flex; align-items: center; gap: var(--space-2); min-height: var(--tap); padding: 0 var(--space-3); color: var(--text); text-decoration: none; border: 1px solid var(--border); border-radius: var(--radius-m); }
  .count-link:hover { border-color: var(--accent); }
</style>
