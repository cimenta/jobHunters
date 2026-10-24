<script lang="ts">
  import { addWidget, APPLICATION_STATUSES, DASHBOARD_COLS, DASHBOARD_WIDGETS, effectiveLayout, placeWidget, removeWidget, widgetOrder, type DashboardLayout, type DashboardWidgetId, type WidgetBox } from '@jobhunters/core';
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

  const ROW = 40;
  const GAP = 8;
  const WIDGET_TITLES: Record<DashboardWidgetId, () => string> = {
    reminders: () => tr('ui.dashboard.reminders'),
    ai_tasks: () => tr('ui.dashboard.aiTasks'),
    status_counts: () => tr('ui.dashboard.applications'),
  };

  const dashboard = useResource(() => api.getDashboard());
  let postponing = $state<DashboardReminder>();

  let editing = $state(false);
  let menuOpen = $state(false);
  let saved = $state(false);
  let gridEl = $state<HTMLElement>();
  /** The layout while a widget is being dragged or resized; stored on release. */
  let draft = $state<DashboardLayout>();
  const layout = $derived(draft ?? effectiveLayout(uiState().dashboard_layout));
  /** Fixed DOM order (a re-ordered element would lose the pointer capture of a drag); the stacked narrow view orders by CSS. */
  const shown = $derived(DASHBOARD_WIDGETS.filter((id) => layout[id] !== undefined));
  const readingOrder = $derived(widgetOrder(layout));
  const missing = $derived(DASHBOARD_WIDGETS.filter((id) => layout[id] === undefined));

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

  /** Applies a layout change at once and stores it (null = back to the default layout). */
  function store(next: DashboardLayout | null): void {
    draft = undefined;
    saveUiState({ dashboard_layout: next });
    saved = true;
  }

  function startDrag(event: PointerEvent, id: DashboardWidgetId, mode: 'move' | 'resize'): void {
    const start = layout[id];
    if (!gridEl || !start) return;
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture?.(event.pointerId);
    const pitchX = (gridEl.clientWidth + GAP) / DASHBOARD_COLS;
    const pitchY = ROW + GAP;
    const from = { x: event.clientX, y: event.clientY };
    const base = layout;
    const apply = (e: PointerEvent): void => {
      const dx = Math.round((e.clientX - from.x) / pitchX);
      const dy = Math.round((e.clientY - from.y) / pitchY);
      const box: WidgetBox = mode === 'move' ? { ...start, x: start.x + dx, y: start.y + dy } : { ...start, w: start.w + dx, h: start.h + dy };
      draft = placeWidget(base, id, box);
    };
    const done = (): void => {
      target.removeEventListener('pointermove', apply);
      target.removeEventListener('pointerup', done);
      target.removeEventListener('pointercancel', done);
      if (draft) store(draft);
    };
    target.addEventListener('pointermove', apply);
    target.addEventListener('pointerup', done);
    target.addEventListener('pointercancel', done);
  }

  /** Arrow keys move the widget by a cell, Shift and arrow keys resize it. */
  function keyAdjust(event: KeyboardEvent, id: DashboardWidgetId): void {
    const steps: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const step = steps[event.key];
    const box = layout[id];
    if (!step || !box) return;
    event.preventDefault();
    const [dx, dy] = step;
    store(placeWidget(layout, id, event.shiftKey ? { ...box, w: box.w + dx, h: box.h + dy } : { ...box, x: box.x + dx, y: box.y + dy }));
  }

  function addChosen(event: Event): void {
    const select = event.currentTarget as HTMLSelectElement;
    const id = DASHBOARD_WIDGETS.find((candidate) => candidate === select.value);
    select.value = '';
    if (id) store(addWidget(layout, id));
  }

  function startEditing(): void {
    menuOpen = false;
    saved = false;
    editing = true;
  }

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

<svelte:window onclick={() => (menuOpen = false)} onkeydown={(event) => { if (event.key === 'Escape') menuOpen = false; }} />

{#snippet remindersWidget()}
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
{/snippet}

{#snippet aiTasksWidget()}
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
{/snippet}

{#snippet statusCountsWidget()}
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
{/snippet}

<div class="stack-lg" data-ui="dashboard">
  <div class="page-title">
    <h1>{tr('ui.nav.dashboard')}</h1>
    <div class="title-actions">
      <Button variant="primary" ui="dashboard.add-job" onclick={() => navigate(paths.newJob)}><Icon name="plus" size={18} />{tr('ui.dashboard.addJob')}</Button>
      <div class="menu-wrap">
        <Button variant="ghost" ui="dashboard.menu" label={tr('ui.dashboard.menu')} onclick={(event) => { event.stopPropagation(); menuOpen = !menuOpen; }}><Icon name="more" size={20} /></Button>
        {#if menuOpen}
          <div class="menu" role="menu" data-ui="dashboard.menu.list">
            <button type="button" role="menuitem" data-ui="dashboard.menu.edit-layout" onclick={startEditing}><Icon name="layout" size={18} />{tr('ui.dashboard.editLayout')}</button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  {#if editing}
    <div class="edit-bar" data-ui="dashboard.edit-bar">
      <strong>{tr('ui.dashboard.editing')}</strong>
      <select data-ui="dashboard.add-widget" aria-label={tr('ui.dashboard.addWidget')} disabled={missing.length === 0} onchange={addChosen}>
        <option value="">{tr('ui.dashboard.addWidget')}</option>
        {#each missing as id (id)}<option value={id}>{WIDGET_TITLES[id]()}</option>{/each}
      </select>
      <Button ui="dashboard.reset-layout" onclick={() => store(null)}><Icon name="undo" size={18} />{tr('ui.dashboard.resetLayout')}</Button>
      <span class="muted small" data-ui="dashboard.saved" aria-live="polite">{saved ? tr('ui.dashboard.layoutSaved') : tr('ui.dashboard.layoutAuto')}</span>
      <span class="grow"></span>
      <Button variant="primary" ui="dashboard.done" onclick={() => (editing = false)}><Icon name="check" size={18} />{tr('ui.dashboard.done')}</Button>
    </div>
  {/if}

  {#if dashboard.status === 'loading'}
    <Skeleton lines={6} />
  {:else if dashboard.status === 'error'}
    <ErrorBlock error={dashboard.error} onretry={invalidate} />
  {:else if shown.length === 0}
    <EmptyState ui="dashboard.no-widgets" icon="layout" title={tr('ui.dashboard.noWidgets')} />
  {:else}
    <div class="grid" class:editing bind:this={gridEl} data-ui="dashboard.grid">
      {#each shown as id (id)}
        {@const box = layout[id]!}
        <div class="widget" style="--col:{box.x + 1}; --span:{box.w}; --row:{box.y + 1}; --rows:{box.h}; --order:{readingOrder.indexOf(id)}" data-ui="dashboard.widget.{id}">
          {#if editing}
            <div class="tools">
              <button
                type="button"
                class="handle"
                data-ui="dashboard.widget.{id}.drag"
                aria-label="{tr('ui.dashboard.drag')}: {WIDGET_TITLES[id]()}"
                title={tr('ui.dashboard.dragHint')}
                onpointerdown={(event) => startDrag(event, id, 'move')}
                onkeydown={(event) => keyAdjust(event, id)}
              ><Icon name="move" size={16} />{WIDGET_TITLES[id]()}</button>
              <Button variant="ghost" ui="dashboard.widget.{id}.remove" label="{tr('ui.dashboard.remove')}: {WIDGET_TITLES[id]()}" onclick={() => store(removeWidget(layout, id))}><Icon name="close" size={16} /></Button>
            </div>
          {/if}
          <div class="body">
            {#if id === 'reminders'}{@render remindersWidget()}{:else if id === 'ai_tasks'}{@render aiTasksWidget()}{:else}{@render statusCountsWidget()}{/if}
          </div>
          {#if editing}
            <span class="resize" role="presentation" data-ui="dashboard.widget.{id}.resize" title={tr('ui.dashboard.resize')} onpointerdown={(event) => startDrag(event, id, 'resize')}></span>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<PostponeDialog open={postponing !== undefined} onclose={() => (postponing = undefined)} onconfirm={postpone} />

<style>
  .title-actions { display: flex; align-items: center; gap: var(--space-2); }
  .menu-wrap { position: relative; }
  .menu { position: absolute; right: 0; top: 100%; z-index: 20; display: flex; flex-direction: column; min-width: 12rem; padding: var(--space-1); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-m); box-shadow: var(--shadow-1); }
  .menu button { display: flex; align-items: center; gap: var(--space-2); min-height: var(--tap); padding: 0 var(--space-3); font: inherit; color: var(--text); text-align: left; background: none; border: 0; border-radius: var(--radius-s); cursor: pointer; }
  .menu button:hover { background: var(--accent-soft); }
  .edit-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: var(--accent-soft); border: 1px solid var(--accent); border-radius: var(--radius-m); }
  .edit-bar .grow { flex: 1; }
  .grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); grid-auto-rows: 40px; gap: 8px; }
  .grid.editing { background-image: linear-gradient(to right, var(--border) 1px, transparent 1px); background-size: calc((100% + 8px) / 12) 100%; }
  .widget { position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0; grid-column: var(--col) / span var(--span); grid-row: var(--row) / span var(--rows); }
  .body { display: flex; flex: 1; min-height: 0; }
  .body > :global(section) { flex: 1; min-width: 0; overflow: auto; }
  .editing .widget { outline: 2px dashed var(--accent); outline-offset: 2px; border-radius: var(--radius-m); }
  .tools { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
  .handle { display: inline-flex; align-items: center; gap: var(--space-1); min-height: 28px; padding: 0 var(--space-2); font: inherit; font-size: var(--text-s); color: var(--on-accent); background: var(--accent); border: 0; border-radius: var(--radius-s); cursor: grab; touch-action: none; }
  .handle:active { cursor: grabbing; }
  .resize { position: absolute; right: 0; bottom: 0; width: 18px; height: 18px; background: var(--accent); border-radius: var(--radius-m) 0 var(--radius-m) 0; cursor: nwse-resize; touch-action: none; }
  @media (max-width: 720px) {
    .grid { display: flex; flex-direction: column; background-image: none; }
    .widget { grid-column: auto; grid-row: auto; order: var(--order); }
    .handle, .resize { display: none; }
  }
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
