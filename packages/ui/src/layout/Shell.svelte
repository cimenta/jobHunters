<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import GlobalSearch from '../components/GlobalSearch.svelte';
  import Icon, { type IconName } from '../components/Icon.svelte';
  import { tr } from '../lib/i18n.svelte';
  import { paths, sectionOf, type Section } from '../lib/route';
  import { formatCount, formatVersion } from '../lib/format';
  import { router } from '../lib/router.svelte';
  import { api } from '../api';
  import { useResource } from '../lib/resource.svelte';
  import { notifyError } from '../lib/notify';
  import { app, reloadSettings, reloadSetupStatus, settingsNeedAttention } from '../state/app.svelte';
  import { invalidate, invalidation } from '../state/invalidate.svelte';
  import { toast } from '../state/toast.svelte';
  import { createMenuPoller, menuRefreshSeconds } from '../lib/menu-poll';
  import { menuBadge } from '../lib/menu-numbers';
  import { DEFAULT_MENU_NUMBERS } from '@jobhunters/core';

  let { children }: { children?: Snippet } = $props();

  const items: { section: Section; icon: IconName; href: string }[] = [
    { section: 'dashboard', icon: 'home', href: paths.dashboard },
    { section: 'jobs', icon: 'briefcase', href: paths.jobs },
    { section: 'applications', icon: 'file', href: paths.applications },
    { section: 'companies', icon: 'building', href: paths.companies },
    { section: 'calendar', icon: 'calendar', href: paths.calendar },
    { section: 'emails', icon: 'mail', href: paths.emails },
    { section: 'tasks', icon: 'sparkle', href: paths.tasks },
    { section: 'settings', icon: 'settings', href: paths.settings },
    { section: 'help', icon: 'help', href: paths.help },
  ];
  const current = $derived(sectionOf(router.current));
  const version = $derived(formatVersion(app.version));
  const counts = useResource(() => api.getMenuCounts());
  // The numbers wait for the setup check: the red mark must be on screen first, never after them.
  const showCounts = $derived(counts.status === 'ready' && !app.setupChecking);
  const waiting = $derived(showCounts ? (counts.data?.aiTasksWaiting ?? 0) : 0);
  // The numbers the user chose in Settings for the menu items that show them.
  const chosen = $derived(app.settings?.menu_numbers ?? DEFAULT_MENU_NUMBERS);
  const badges = $derived({
    jobs: showCounts ? menuBadge('jobs', chosen.jobs, counts.data?.metrics?.jobs) : undefined,
    applications: showCounts ? menuBadge('applications', chosen.applications, counts.data?.metrics?.applications) : undefined,
    tasks: showCounts ? menuBadge('tasks', chosen.tasks, counts.data?.metrics?.tasks) : undefined,
  });

  // Keeps the menu numbers fresh (the AI works in the sheet): 15 s while AI tasks wait, else 60 s, only while visible.
  const poller = createMenuPoller({
    // Resolve first: a rejected promise given to `counts.run` would replace good numbers with an error. A result that
    // was overtaken by an `invalidate()` load while the request was in flight is dropped.
    fetch: async () => {
      const version = invalidation.version;
      const value = await api.getMenuCounts();
      if (version !== invalidation.version) return;
      await counts.run(Promise.resolve(value));
    },
    waiting: () => untrack(() => waiting),
    intervalFor: (busy) => 1000 * menuRefreshSeconds(untrack(() => app.settings), busy > 0),
    now: () => Date.now(),
    setTimeout: (callback, ms) => setTimeout(callback, ms),
    clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    isHidden: () => document.hidden,
  });
  let refreshing = $state(false);

  /** Every screen that shows data re-reads it, and so do the settings, the menu numbers and the Setup check. */
  async function refreshAll(): Promise<void> {
    if (refreshing) return;
    refreshing = true;
    try {
      invalidate();
      poller.kick();
      await Promise.all([reloadSettings(), reloadSetupStatus()]);
      toast.success(tr('ui.refresh.done'));
    } catch (error) {
      notifyError(error);
    } finally {
      refreshing = false;
    }
  }

  // Alt+Shift+R refreshes from anywhere, also while a pop-up covers the menu button.
  function onkeydown(event: KeyboardEvent): void {
    if (event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyR') {
      event.preventDefault();
      void refreshAll();
    }
  }

  $effect(() => {
    const refresh = () => poller.kick();
    const onVisible = () => {
      if (!document.hidden) poller.kick();
    };
    poller.start();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      poller.stop();
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  });
  $effect(() => {
    void waiting;
    void app.settings?.menu_refresh_seconds;
    void app.settings?.menu_refresh_busy_seconds;
    poller.reschedule();
  });
  const labels: Record<Section, () => string> = {
    dashboard: () => tr('ui.nav.dashboard'),
    jobs: () => tr('ui.nav.jobs'),
    applications: () => tr('ui.nav.applications'),
    companies: () => tr('ui.nav.companies'),
    calendar: () => tr('ui.nav.calendar'),
    emails: () => tr('ui.nav.emails'),
    tasks: () => tr('ui.nav.tasks'),
    settings: () => tr('ui.nav.settings'),
    help: () => tr('ui.nav.help'),
  };
</script>

<svelte:window {onkeydown} />

<div class="shell">
  <nav aria-label={tr('ui.nav.label')} data-ui="nav">
    <span class="brand" data-ui="app.brand"><span class="name" data-ui="app.name">JobHunters</span>{#if version !== ''}<small class="version" data-ui="app.version">{version}</small>{/if}<button type="button" class="refresh" class:spinning={refreshing} data-ui="app.refresh" aria-label={tr('ui.refresh.label')} title={tr('ui.refresh.label')} onclick={refreshAll}><Icon name="refresh" size={18} /></button></span>
    <GlobalSearch />
    {#each items as item (item.section)}
      {@const badge = item.section === 'jobs' || item.section === 'tasks' || item.section === 'applications' ? badges[item.section] : undefined}
      {#snippet link()}
        <a
          class="item"
          data-ui="nav.{item.section}"
          href={item.href}
          aria-label={item.section === 'settings' && settingsNeedAttention()
            ? tr('ui.nav.actionNeeded', { label: labels[item.section]() })
            : badge
              ? `${labels[item.section]()}, ${badge.label}`
              : labels[item.section]()}
          aria-current={current === item.section ? 'page' : undefined}
        >
          <Icon name={item.icon} size={22} />
          <span class="label">{labels[item.section]()}</span>
          {#if item.section === 'tasks' && badge}
            <span class="count" data-ui="nav.count.tasks" aria-hidden="true" title={badge.title}>{badge.text}</span>
          {:else if item.section === 'settings' && settingsNeedAttention()}
            <span class="count alert" data-ui="nav.action-needed" aria-hidden="true" title={tr('ui.nav.actionNeededTip')}>!</span>
          {:else if item.section === 'applications' && badge}
            <span class="count" data-ui="nav.count.applications" aria-hidden="true" title={badge.title}>{badge.text}</span>
          {/if}
        </a>
      {/snippet}
      {#if item.section === 'jobs'}
        <div class="item-group">
          {@render link()}
          <a class="plus" data-ui="nav.add-job" href={paths.newJob} aria-label={tr('ui.nav.addJob')} title={tr('ui.nav.addJob')}><Icon name="plus" size={20} /></a>
          {#if badge}
            <span class="count jobs-count" data-ui="nav.count.jobs" aria-hidden="true" title={badge.title}>{badge.text}</span>
          {/if}
        </div>
      {:else}
        {@render link()}
      {/if}
    {/each}
  </nav>
  <button type="button" class="refresh corner" class:spinning={refreshing} data-ui="app.refresh.corner" aria-label={tr('ui.refresh.label')} title={tr('ui.refresh.label')} onclick={refreshAll}><Icon name="refresh" size={18} /></button>
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
  .refresh { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; color: var(--text-muted); background: transparent; border: 0; border-radius: var(--radius-s); cursor: pointer; }
  .refresh:hover { color: var(--text); background: var(--accent-soft); }
  .refresh.corner { position: fixed; z-index: 30; top: var(--space-2); right: var(--space-2); background: var(--surface); border: 1px solid var(--border); }
  .refresh.spinning :global(svg) { animation: refresh-spin 0.8s linear infinite; }
  @keyframes refresh-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .refresh.spinning :global(svg) { animation-duration: 2.4s; } }
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
  .count.alert { background: var(--danger); color: #fff; }
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
    .refresh.corner { display: none; }
    .brand { display: grid; grid-template-columns: 1fr auto; grid-template-areas: 'name refresh' 'version refresh'; align-items: center; column-gap: var(--space-2); padding: var(--space-3) var(--space-4); }
    .name { grid-area: name; font-size: var(--text-m); font-weight: 700; line-height: 1.2; }
    .version { grid-area: version; font-size: 0.7rem; font-weight: 400; line-height: 1.2; color: var(--text-muted); }
    .brand .refresh { grid-area: refresh; width: 28px; height: 28px; }
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
    .item .count.alert { box-sizing: border-box; min-width: 20px; height: 20px; border-radius: 50%; background: var(--danger); color: #fff; font-size: var(--text-s); font-weight: 800; line-height: 20px; text-align: center; }
    main { margin-left: 232px; padding: var(--space-5) var(--space-6); }
  }
</style>
