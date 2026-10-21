<script lang="ts">
  import { markMatches, MIN_SEARCH_LENGTH, SEARCH_TYPES, searchWords, type SearchHit, type SearchResult, type SearchType } from '@jobhunters/core';
  import { tick } from 'svelte';
  import { api } from '../api';
  import { formatDate } from '../lib/format';
  import { tr } from '../lib/i18n.svelte';
  import { describeError } from '../lib/errors';
  import { jobStatus } from '../lib/job-status';
  import { aiTaskTypeLabel } from '../lib/labels';
  import { paths } from '../lib/route';
  import { navigate } from '../lib/router.svelte';
  import { statusStyle } from '../lib/status';
  import Icon from './Icon.svelte';

  /**
   * The search of the main menu: a text box (an icon on narrow screens) and a pop-up with what was found, grouped by type,
   * every row marked with its type. It searches after a short pause in typing, closes on Esc and on a click elsewhere,
   * and is reached from the keyboard with / (outside a text field) and Ctrl+K (Cmd+K).
   */
  const PAUSE_MS = 300;
  const FULL_LIMIT = 50;

  let query = $state('');
  let open = $state(false);
  let loading = $state(false);
  let failure = $state('');
  let result = $state<SearchResult>();
  /** Groups the user opened completely ("Show all"). */
  let full = $state<Partial<Record<SearchType, SearchHit[]>>>({});
  let active = $state(0);
  const canMatch = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  let wide = $state(canMatch ? window.matchMedia('(min-width: 1024px)').matches : true);
  let root = $state<HTMLElement>();
  let input = $state<HTMLInputElement>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Where the pointer last really was: scrolling the list under a still pointer makes the browser report a move to the same place. */
  let pointer = { x: -1, y: -1 };
  let sequence = 0;

  const words = $derived(searchWords(query));
  const ready = $derived(query.trim().length >= MIN_SEARCH_LENGTH);
  const groups = $derived(
    result === undefined
      ? []
      : SEARCH_TYPES.map((type) => ({ type, total: result!.groups[type].total, hits: full[type] ?? result!.groups[type].hits })).filter((group) => group.total > 0),
  );
  const rows = $derived(groups.flatMap((group) => group.hits));
  const none = $derived(ready && !loading && failure === '' && result !== undefined && groups.length === 0);

  $effect(() => {
    if (!canMatch) return;
    const media = window.matchMedia('(min-width: 1024px)');
    const change = (): void => {
      wide = media.matches;
    };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  });

  // A click anywhere else closes the pop-up.
  $effect(() => {
    if (!open) return;
    const away = (event: PointerEvent): void => {
      if (root !== undefined && event.target instanceof Node && !root.contains(event.target)) open = false;
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  });

  async function run(text: string): Promise<void> {
    const mine = ++sequence;
    loading = true;
    failure = '';
    try {
      const found = await api.search(text);
      if (mine !== sequence) return;
      result = found;
      full = {};
      active = 0;
    } catch (error) {
      if (mine !== sequence) return;
      failure = describeError(error);
      result = undefined;
    } finally {
      if (mine === sequence) loading = false;
    }
  }

  function oninput(): void {
    open = true;
    clearTimeout(timer);
    if (!ready) {
      sequence += 1;
      loading = false;
      failure = '';
      result = undefined;
      return;
    }
    loading = true;
    timer = setTimeout(() => void run(query), PAUSE_MS);
  }

  /** The row under the pointer becomes the chosen one only when the pointer itself moved, never because the list scrolled under it. */
  function follow(event: MouseEvent, index: number): void {
    if (event.clientX === pointer.x && event.clientY === pointer.y) return;
    pointer = { x: event.clientX, y: event.clientY };
    active = index;
  }

  /** Keeps the chosen row in view; the first row also shows the heading above it. */
  function reveal(): void {
    const popup = root?.querySelector<HTMLElement>('[data-ui="search.popup"]');
    if (active === 0 && popup) popup.scrollTop = 0;
    else root?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }

  async function showAll(type: SearchType): Promise<void> {
    const mine = sequence;
    try {
      const found = await api.search(query, { types: [type], limit: FULL_LIMIT });
      if (mine === sequence) full = { ...full, [type]: found.groups[type].hits };
    } catch (error) {
      if (mine === sequence) failure = describeError(error);
    }
  }

  function target(hit: SearchHit): string {
    switch (hit.type) {
      case 'companies':
        return paths.company(hit.id);
      case 'jobs':
        return paths.job(hit.id);
      case 'applications':
        return paths.application(hit.id);
      case 'emails':
        return paths.email(hit.id);
      default:
        return paths.tasks;
    }
  }

  /** The pop-up goes away and the text is cleared, so the next search starts empty. */
  function finish(): void {
    open = false;
    query = '';
    result = undefined;
    sequence += 1;
    loading = false;
    clearTimeout(timer);
    input?.blur();
  }

  function choose(hit: SearchHit): void {
    navigate(target(hit));
    finish();
  }

  function onkeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      open = false;
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (rows.length === 0) return;
      event.preventDefault();
      open = true;
      active = (active + (event.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length;
      void tick().then(reveal);
    } else if (event.key === 'Enter') {
      const hit = rows[active];
      if (open && hit !== undefined) {
        event.preventDefault();
        choose(hit);
      }
    }
  }

  async function focusSearch(): Promise<void> {
    open = ready;
    await tick();
    input?.focus();
    input?.select();
  }

  /** On a narrow screen the pop-up is opened by the icon and holds the text box itself. */
  async function openCompact(): Promise<void> {
    open = true;
    await tick();
    input?.focus();
  }

  function onwindowkeydown(event: KeyboardEvent): void {
    const plain = !event.altKey && !event.ctrlKey && !event.metaKey;
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (document.activeElement === input) {
        open = false;
        input?.blur();
      } else if (wide) void focusSearch();
      else void openCompact();
      return;
    }
    if (event.key === '/' && plain) {
      const element = event.target instanceof HTMLElement ? event.target : undefined;
      const typing = element !== undefined && (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable);
      if (typing) return;
      event.preventDefault();
      if (wide) void focusSearch();
      else void openCompact();
    }
  }

  const typeLabel = (type: SearchType): string => tr(`ui.search.type.${type}`);

  function statusText(hit: SearchHit): string {
    if (hit.type === 'jobs') return jobStatus({ status: hit.status, match_percent: null }).text;
    if (hit.type === 'applications') return statusStyle(hit.status).text;
    return '';
  }

  /** The title of a hit; an e-mail without a subject or a task without a job has none of its own. */
  function titleOf(hit: SearchHit): string {
    if (hit.title !== '') return hit.title;
    return hit.type === 'emails' ? tr('ui.emails.noSubject') : hit.type === 'tasks' ? aiTaskTypeLabel(hit.kind) : '';
  }

  function detailOf(hit: SearchHit): string {
    const parts = [...hit.parts];
    if (hit.type === 'companies' && hit.counts) parts.push(tr('ui.company.jobCount', { count: hit.counts.jobs }), tr('summary.applications', { count: hit.counts.applications }));
    if (hit.type === 'emails') {
      if (hit.kind === 'outgoing' && parts[0] !== undefined) parts[0] = tr('ui.emails.to', { name: parts[0] });
      if (hit.date !== '') parts.push(formatDate(hit.date));
    }
    if (hit.type === 'tasks') {
      if (hit.title !== '') parts.unshift(aiTaskTypeLabel(hit.kind));
      if (hit.date !== '') parts.push(formatDate(hit.date));
    }
    const status = statusText(hit);
    if (status !== '') parts.push(status);
    return parts.join(' · ');
  }
</script>

<svelte:window onkeydown={onwindowkeydown} />

<div class="search" class:wide data-ui="search" bind:this={root}>
  {#if wide}
    <label class="field">
      <span class="lens"><Icon name="search" size={18} /></span>
      {@render box()}
    </label>
  {:else}
    <button type="button" class="trigger" data-ui="search.open" aria-label={tr('ui.search.open')} title={tr('ui.search.open')} aria-expanded={open} onclick={openCompact}>
      <Icon name="search" size={22} />
      <span class="label">{tr('ui.search.label')}</span>
    </button>
  {/if}

  {#if open && (wide ? ready : true)}
    <div class="popup" class:compact={!wide} data-ui="search.popup">
      {#if !wide}
        <label class="field inside">
          <span class="lens"><Icon name="search" size={18} /></span>
          {@render box()}
        </label>
      {/if}
      {#if ready}
        {#if loading && result === undefined}
          <p class="muted note" data-ui="search.loading" role="status">{tr('ui.search.searching')}</p>
        {:else if failure !== ''}
          <p class="error note" data-ui="search.error" role="alert">{failure}</p>
        {:else if none}
          <p class="muted note" data-ui="search.empty" role="status">{tr('ui.search.none', { query: query.trim() })}</p>
        {:else}
          <div class="results" id="search-results" role="listbox" aria-label={tr('ui.search.results')} class:stale={loading}>
            {#each groups as group (group.type)}
              <section data-ui="search.group.{group.type}">
                <h3>{tr(`ui.search.group.${group.type}`)} · {group.total}</h3>
                <ul>
                  {#each group.hits as hit (hit.id)}
                    {@const index = rows.indexOf(hit)}
                    <li role="presentation">
                      <a
                        id="search-hit-{index}"
                        class="hit"
                        role="option"
                        aria-selected={index === active}
                        data-ui="search.result.{hit.type}.{hit.id}"
                        href={target(hit)}
                        onmousemove={(event) => follow(event, index)}
                        onclick={() => finish()}
                      >
                        <span class="tag {hit.type}" data-ui="search.result.{hit.type}.{hit.id}.type">{typeLabel(hit.type)}</span>
                        <span class="text">
                          <span class="title">{#each markMatches(titleOf(hit), words) as piece}{#if piece.hit}<mark>{piece.text}</mark>{:else}{piece.text}{/if}{/each}</span>
                          {#if detailOf(hit) !== ''}<span class="muted small">{detailOf(hit)}</span>{/if}
                          {#if hit.snippet !== ''}<span class="muted small snippet">{#each markMatches(hit.snippet, words) as piece}{#if piece.hit}<mark>{piece.text}</mark>{:else}{piece.text}{/if}{/each}</span>{/if}
                        </span>
                      </a>
                    </li>
                  {/each}
                </ul>
                {#if group.total > group.hits.length}
                  <button type="button" class="more" data-ui="search.more.{group.type}" onclick={() => showAll(group.type)}>{tr('ui.search.more', { count: group.total })}</button>
                {/if}
              </section>
            {/each}
          </div>
          <p class="muted small keys">{tr('ui.search.hint')}</p>
        {/if}
      {/if}
    </div>
  {/if}
</div>

{#snippet box()}
  <input
    class="input"
    type="search"
    data-ui="search.input"
    role="combobox"
    aria-label={tr('ui.search.label')}
    aria-expanded={open && ready}
    aria-controls="search-results"
    aria-activedescendant={open && rows[active] !== undefined ? `search-hit-${active}` : undefined}
    autocomplete="off"
    placeholder={tr('ui.search.placeholder')}
    bind:this={input}
    bind:value={query}
    {oninput}
    onfocus={() => (open = ready || !wide)}
    {onkeydown}
  />
{/snippet}

<style>
  .search { position: relative; display: flex; flex: 1; min-width: 0; }
  .search.wide { display: block; flex: none; padding: 0 var(--space-3) var(--space-2); }
  .field { position: relative; display: block; }
  .field :global(.input) { width: 100%; padding-left: 2rem; }
  .lens { position: absolute; left: var(--space-2); top: 50%; transform: translateY(-50%); display: inline-flex; color: var(--text-muted); pointer-events: none; z-index: 1; }
  .trigger { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 64px; padding: var(--space-2) 2px; font: inherit; font-size: 0.7rem; color: var(--text-muted); background: transparent; border: 0; cursor: pointer; }
  .trigger[aria-expanded='true'] { color: var(--accent); }
  .label { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .popup { position: absolute; z-index: 60; left: var(--space-3); top: 100%; width: min(440px, calc(100vw - 2 * var(--space-3))); max-height: min(70vh, 560px); overflow-y: auto; padding: var(--space-2); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-m); box-shadow: 0 8px 24px rgb(0 0 0 / 0.18); }
  .popup.compact { position: fixed; left: var(--space-2); right: var(--space-2); top: var(--space-2); width: auto; max-width: 560px; max-height: calc(100vh - 2 * var(--space-2)); }
  .field.inside { margin-bottom: var(--space-2); }
  .note { margin: var(--space-2); }
  .error { color: var(--danger); }
  .results.stale { opacity: 0.6; }
  h3 { margin: var(--space-2) var(--space-2) var(--space-1); font-size: var(--text-s); font-weight: 600; color: var(--text-muted); }
  ul { display: flex; flex-direction: column; gap: 2px; padding: 0; margin: 0; list-style: none; }
  .hit { display: flex; align-items: flex-start; gap: var(--space-2); padding: var(--space-2); color: inherit; text-decoration: none; border-radius: var(--radius-s); }
  .hit[aria-selected='true'] { background: var(--accent-soft); }
  .tag { flex: none; width: 5.5rem; padding: 1px var(--space-1); font-size: 0.6875rem; font-weight: 600; text-align: center; border-radius: var(--radius-s); background: var(--surface-2); }
  .tag.jobs { background: var(--accent-soft); }
  .tag.applications { background: var(--success-soft); }
  .tag.emails { background: var(--warning-soft); }
  .tag.tasks { background: var(--surface-2); border: 1px solid var(--border); }
  .text { display: flex; flex-direction: column; gap: 1px; min-width: 0; overflow-wrap: anywhere; }
  .title { font-weight: 600; }
  mark { background: transparent; color: inherit; font-weight: 800; text-decoration: underline; text-decoration-color: var(--accent); text-underline-offset: 2px; }
  .more { margin: 2px var(--space-2) var(--space-1); padding: var(--space-1) 0; font: inherit; font-size: var(--text-s); color: var(--accent); background: none; border: 0; cursor: pointer; }
  .keys { margin: var(--space-2) var(--space-2) 0; padding-top: var(--space-2); border-top: 1px solid var(--border); }
  @media (min-width: 640px) {
    .trigger { flex: none; flex-direction: row; justify-content: center; min-height: var(--tap); margin: var(--space-1) var(--space-2); border-radius: var(--radius-s); }
    .search { flex: none; }
    .label { display: none; }
    .popup.compact { left: calc(96px + var(--space-2)); }
  }
</style>
