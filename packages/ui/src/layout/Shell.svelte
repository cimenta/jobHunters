<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon, { type IconName } from '../components/Icon.svelte';
  import { tr } from '../lib/i18n.svelte';
  import { paths, sectionOf, type Section } from '../lib/route';
  import { formatVersion } from '../lib/format';
  import { router } from '../lib/router.svelte';
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
      <a class="item" data-ui="nav.{item.section}" href={item.href} aria-label={labels[item.section]()} aria-current={current === item.section ? 'page' : undefined}>
        <Icon name={item.icon} size={22} />
        <span class="label">{labels[item.section]()}</span>
      </a>
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
  .item { min-width: 0; }
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
      width: 72px;
      flex-direction: column;
      padding: var(--space-3) 0;
      border-top: 0;
      border-right: 1px solid var(--border);
    }
    .item { flex: none; flex-direction: row; justify-content: center; min-height: var(--tap); margin: var(--space-1) var(--space-2); border-radius: var(--radius-s); }
    .item[aria-current='page'] { background: var(--accent-soft); }
    .label { display: none; }
    main { margin-left: 72px; padding: var(--space-5); }
  }

  @media (min-width: 1024px) {
    nav { width: 232px; }
    .brand { display: flex; align-items: baseline; gap: var(--space-2); padding: var(--space-3) var(--space-4); font-size: var(--text-l); font-weight: 700; }
    .version { font-size: var(--text-s); font-weight: 400; color: var(--text-muted); }
    .item { justify-content: flex-start; gap: var(--space-3); padding: 0 var(--space-4); font-size: var(--text-m); }
    .label { display: inline; }
    main { margin-left: 232px; padding: var(--space-5) var(--space-6); }
  }
</style>
