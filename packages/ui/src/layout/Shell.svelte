<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon, { type IconName } from '../components/Icon.svelte';
  import { tr } from '../lib/i18n.svelte';
  import { paths, sectionOf, type Section } from '../lib/route';
  import { formatCount, formatVersion } from '../lib/format';
  import { router } from '../lib/router.svelte';
  import { api } from '../api';
  import { useResource } from '../lib/resource.svelte';
  import { app } from '../state/app.svelte';

  let { children }: { children?: Snippet } = $props();

  const items: { section: Section; icon: IconName; href: string }[] = [
    { section: 'dashboard', icon: 'home', href: paths.dashboard },
    { section: 'jobs', icon: 'briefcase', href: paths.jobs },
    { section: 'applications', icon: 'file', href: paths.applications },
    { section: 'companies', icon: 'building', href: paths.companies },
    { section: 'tasks', icon: 'sparkle', href: paths.tasks },
    { section: 'settings', icon: 'settings', href: paths.settings },
    { section: 'help', icon: 'help', href: paths.help },
  ];
  const current = $derived(sectionOf(router.current));
  const version = $derived(formatVersion(app.version));
  const counts = useResource(() => api.getMenuCounts());
  const newJobs = $derived(counts.status === 'ready' ? (counts.data?.newJobs ?? 0) : 0);
  const waiting = $derived(counts.status === 'ready' ? (counts.data?.aiTasksWaiting ?? 0) : 0);
  const labels: Record<Section, () => string> = {
    dashboard: () => tr('ui.nav.dashboard'),
    jobs: () => tr('ui.nav.jobs'),
    applications: () => tr('ui.nav.applications'),
    companies: () => tr('ui.nav.companies'),
    tasks: () => tr('ui.nav.tasks'),
    settings: () => tr('ui.nav.settings'),
    help: () => tr('ui.nav.help'),
  };
</script>

<div class="shell">
  <nav aria-label={tr('ui.nav.label')} data-ui="nav">
    <span class="brand" data-ui="app.brand">JobHunters{#if version !== ''}<small class="version" data-ui="app.version">{version}</small>{/if}</span>
    {#each items as item (item.section)}
      {@const count = item.section === 'jobs' ? newJobs : item.section === 'tasks' ? waiting : 0}
      {#snippet link()}
        <a
          class="item"
          data-ui="nav.{item.section}"
          href={item.href}
          aria-label={count > 0 && item.section === 'jobs'
            ? tr('ui.nav.jobsNew', { label: labels[item.section](), count })
            : count > 0
              ? tr('ui.nav.tasksWaiting', { label: labels[item.section](), count })
              : labels[item.section]()}
          aria-current={current === item.section ? 'page' : undefined}
        >
          <Icon name={item.icon} size={22} />
          <span class="label">{labels[item.section]()}</span>
          {#if item.section === 'tasks' && count > 0}
            <span class="count" data-ui="nav.count.tasks" aria-hidden="true" title={tr('ui.nav.tasksWaitingTip', { count })}>{formatCount(count)}</span>
          {/if}
        </a>
      {/snippet}
      {#if item.section === 'jobs'}
        <div class="item-group">
          {@render link()}
          <a class="plus" data-ui="nav.add-job" href={paths.newJob} aria-label={tr('ui.nav.addJob')} title={tr('ui.nav.addJob')}><Icon name="plus" size={20} /></a>
          {#if count > 0}
            <span class="count jobs-count" data-ui="nav.count.jobs" aria-hidden="true" title={tr('ui.nav.jobsNewTip', { count })}>{formatCount(count)}</span>
          {/if}
        </div>
      {:else}
        {@render link()}
      {/if}
    {/each}
  </nav>
  <main data-ui="content">{@render children?.()}</main>
</div>

<style>
  nav {
    position: fixed;
    z-index: 40;
    right: 0;
    bottom: 0;
    left: 0;
    display: flex;
    background: var(--surface);
    border-top: 1px solid var(--border);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .brand { display: none; }
  .item {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 64px;
    padding: var(--space-2) 2px;
    font-size: 0.7rem;
    color: var(--text-muted);
    text-align: center;
    text-decoration: none;
  }
  .item { min-width: 0; position: relative; }
  .count {
    position: absolute;
    top: 6px;
    left: calc(50% + 2px);
    box-sizing: border-box;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--accent);
    color: var(--on-accent, #fff);
    font-size: 0.65rem;
    font-weight: 700;
    line-height: 18px;
    text-align: center;
  }
  /* Jobs: the icon is centred in the space left of the plus (28px + 4px margin). */
  .jobs-count { left: calc((100% - 32px) / 2 + 2px); }
  .item-group { position: relative; display: flex; flex: 1.7; align-items: center; min-width: 0; }
  .item-group .item { flex: 1; }
  .plus {
    flex: none;
    margin-right: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--success);
    color: var(--on-accent, #fff);
    text-decoration: none;
  }
  .label { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; overflow-wrap: normal; word-break: keep-all; }
  .item[aria-current='page'] { color: var(--accent); font-weight: 700; }
  main {
    min-width: 0;
    max-width: 1280px;
    margin: 0 auto;
    padding: var(--space-4);
    padding-bottom: calc(64px + var(--space-6) + env(safe-area-inset-bottom));
  }

  @media (max-width: 420px) {
    .item { font-size: 0.62rem; }
  }

  @media (min-width: 640px) {
    nav {
      top: 0;
      right: auto;
      width: 96px;
      flex-direction: column;
      padding: var(--space-3) 0;
      border-top: 0;
      border-right: 1px solid var(--border);
    }
    .item-group { flex: none; }
    .count { top: 4px; left: calc(50% + 2px); }
    .jobs-count { left: calc((100% - 36px) / 2 + 2px); }
    .item-group .item { flex: 1; margin-right: 0; }
    .plus { margin-right: var(--space-2); }
    .item { flex: none; flex-direction: row; justify-content: center; min-height: var(--tap); margin: var(--space-1) var(--space-2); border-radius: var(--radius-s); }
    .item[aria-current='page'] { background: var(--accent-soft); }
    .label { display: none; }
    main { margin-left: 96px; padding: var(--space-5); }
  }

  @media (min-width: 1024px) {
    nav { width: 232px; }
    .brand { display: flex; align-items: baseline; gap: var(--space-2); padding: var(--space-3) var(--space-4); font-size: var(--text-l); font-weight: 700; }
    .version { font-size: var(--text-s); font-weight: 400; color: var(--text-muted); }
    .item { justify-content: flex-start; gap: var(--space-3); padding: 0 var(--space-4); font-size: var(--text-m); }
    .label { display: inline; }
    .item-group .item { flex: 0 1 auto; }
    .count, .jobs-count {
      position: static;
      margin-left: auto;
      margin-right: calc(var(--space-2) + var(--space-4));
      min-width: 0;
      height: auto;
      padding: 0;
      background: none;
      color: var(--text-muted);
      font-size: var(--text-s);
      font-weight: 600;
      line-height: inherit;
    }
    .item .count { margin-right: 0; }
    main { margin-left: 232px; padding: var(--space-5) var(--space-6); }
  }
</style>
