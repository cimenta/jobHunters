<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { api } from '../api';
  import Button from '../components/Button.svelte';
  import Card from '../components/Card.svelte';
  import Field from '../components/Field.svelte';
  import { parseLinks } from '../lib/batch';
  import { describeError } from '../lib/errors';
  import { tr } from '../lib/i18n.svelte';
  import { paths } from '../lib/route';
  import { invalidate } from '../state/invalidate.svelte';
  import { toast } from '../state/toast.svelte';

  /** Closes the whole window that holds this form; without it the done block has no Close button. */
  let { pauseMs = 1000, onclose }: { pauseMs?: number; onclose?: () => void } = $props();

  interface Row {
    kind: 'saved' | 'duplicate' | 'queued' | 'invalid' | 'failed';
    label: string;
    detail?: string;
    href?: string;
  }

  let text = $state('');
  let running = $state(false);
  let stopRequested = false;
  let rows = $state<Row[]>([]);
  let summary = $state('');
  let cutOff = $state(false);
  interface Outcome {
    kind: 'ok' | 'partly' | 'stopped';
    title: string;
    detail: string;
    queued: number;
  }
  let outcome = $state<Outcome | undefined>();
  let doneBlock = $state<HTMLElement>();
  let total = $state(0);
  let doneCount = $state(0);
  let currentLink = $state('');

  function addMore(): void {
    text = '';
    outcome = undefined;
    rows = [];
    document.getElementById('batch-links')?.focus();
  }

  const parsed = $derived(parseLinks(text));
  onDestroy(() => (stopRequested = true));

  async function run(): Promise<void> {
    const { links, skipped, tooMany } = parseLinks(text);
    if (links.length === 0) return;
    running = true;
    outcome = undefined;
    stopRequested = false;
    rows = [];
    summary = '';
    cutOff = tooMany;
    let done = 0;
    total = links.length;
    doneCount = 0;
    currentLink = '';
    const counts = { saved: 0, queued: 0, duplicates: 0, invalid: 0 };
    let failed = 0;
    for (const skip of skipped) {
      if (skip.reason === 'invalid') {
        counts.invalid += 1;
        rows.push({ kind: 'invalid', label: tr('ui.batch.invalid'), detail: skip.line });
      } else {
        counts.duplicates += 1;
        rows.push({ kind: 'duplicate', label: tr('ui.batch.duplicate'), detail: skip.line });
      }
    }
    try {
      for (const [index, link] of links.entries()) {
        currentLink = link;
        try {
          const result = await api.importJob(link);
          if (result.status === 'saved') {
            counts.saved += 1;
            rows.push({ kind: 'saved', label: tr('ui.batch.saved'), detail: result.job.title, href: paths.job(result.job.id) });
          } else if (result.status === 'duplicate') {
            counts.duplicates += 1;
            rows.push({ kind: 'duplicate', label: tr('ui.batch.duplicate'), detail: result.job.title || link, href: paths.job(result.job.id) });
          } else if (result.status === 'queued') {
            counts.queued += 1;
            rows.push({
              kind: 'queued',
              label: tr('ui.batch.queued'),
              detail: result.fetchStatus !== 0 ? `${link} (${tr('ui.batch.httpStatus', { status: result.fetchStatus })})` : link,
              href: paths.job(result.job.id),
            });
          } else {
            counts.invalid += 1;
            rows.push({ kind: 'invalid', label: tr('ui.batch.invalid'), detail: link });
          }
        } catch (error) {
          failed += 1;
          rows.push({ kind: 'failed', label: tr('ui.batch.failed', { message: describeError(error) }), detail: link });
        }
        done += 1;
        doneCount = done;
        if (stopRequested) break;
        if (index < links.length - 1 && pauseMs > 0) await new Promise((resolve) => setTimeout(resolve, pauseMs));
        if (stopRequested) break;
      }
    } finally {
      summary = tr('ui.batch.summary', counts);
      const amounts: [string, number][] = [['saved', counts.saved], ['queued', counts.queued], ['failed', failed], ['duplicates', counts.duplicates], ['invalid', counts.invalid]];
      const parts = amounts.filter(([, count]) => count > 0).map(([name, count]) => tr(`ui.batch.part.${name}`, { count })).join(', ');
      const everythingSaved = done === links.length && counts.saved === links.length && skipped.length === 0 && failed === 0 && counts.queued === 0;
      outcome = done < links.length
        ? { kind: 'stopped', title: tr('ui.batch.stopped', { done, total: links.length }), detail: parts, queued: counts.queued }
        : everythingSaved
          ? { kind: 'ok', title: tr('ui.batch.doneAll', { count: counts.saved }), detail: tr('ui.batch.doneHint'), queued: 0 }
          : { kind: 'partly', title: tr('ui.batch.doneTitle', { parts }), detail: counts.queued > 0 ? tr('ui.batch.queuedHint') : '', queued: counts.queued };
      running = false;
      toast.success(summary);
      invalidate();
      await tick();
      doneBlock?.scrollIntoView?.({ block: 'nearest' });
    }
  }
</script>

<div class="stack" data-ui="batch">
  <Card ui="batch.form">
    <form
      class="stack"
      onsubmit={(event) => {
        event.preventDefault();
        void run();
      }}
    >
      <Field label={tr('ui.batch.label')} for="batch-links" hint={tr('ui.batch.hint')}>
        <textarea id="batch-links" data-ui="batch.links" class="input" rows="8" autocomplete="off" bind:value={text}></textarea>
      </Field>
      <div class="row wrap">
        <Button type="submit" variant="primary" ui="batch.add" loading={running} disabled={parsed.links.length === 0 || running}>{tr(running ? 'ui.batch.adding' : 'ui.batch.add')}</Button>
        {#if running}<Button ui="batch.stop" onclick={() => (stopRequested = true)}>{tr('ui.batch.stop')}</Button>{/if}
      </div>
      {#if parsed.tooMany || cutOff}<p class="muted">{tr('ui.batch.tooMany')}</p>{/if}
    </form>
  </Card>

  {#if running}
    <div class="progress" role="status" data-ui="batch.progress">
      <div class="status"><span class="spinner" aria-hidden="true"></span><span class="pulse">{tr('ui.batch.progress', { current: Math.min(doneCount + 1, total), total })}</span></div>
      <div class="bar" role="progressbar" aria-label={tr('ui.batch.progressLabel')} aria-valuemin="0" aria-valuemax={total} aria-valuenow={doneCount} data-ui="batch.progress.bar"><span style:width="{total === 0 ? 0 : Math.round((doneCount / total) * 100)}%"></span></div>
      <div class="current muted small" data-ui="batch.progress.current">{currentLink}</div>
    </div>
  {/if}

  {#if outcome}
    <div class="done {outcome.kind}" role="status" data-ui="batch.done" data-outcome={outcome.kind} bind:this={doneBlock}>
      <span class="icon" aria-hidden="true">{outcome.kind === 'ok' ? '✓' : '!'}</span>
      <div class="stack-sm">
        <h3>{outcome.title}</h3>
        {#if outcome.detail}<p class="muted">{outcome.detail}</p>{/if}
        <div class="row wrap">
          {#if onclose}<Button variant="primary" ui="batch.done.close" onclick={onclose}>{tr('ui.close')}</Button>{/if}
          {#if outcome.queued > 0}<a class="open-tasks" data-ui="batch.open-tasks" href={paths.tasks}>{tr('ui.batch.openTasks')}</a>{/if}
          <Button ui="batch.done.more" onclick={addMore}>{tr('ui.batch.doneMore')}</Button>
        </div>
      </div>
    </div>
  {/if}

  <div aria-live="polite">
  {#if rows.length > 0 || running}
    <Card ui="batch.results">
      <ul class="results">
        {#if running}
          <li class="waiting muted" data-ui="batch.waiting"><span class="spinner" aria-hidden="true"></span>{tr('ui.batch.waiting')}</li>
        {/if}
        {#each rows as row, index (index)}
          <li data-ui="batch.result.{index}" class={row.kind}>
            <strong>{row.label}</strong>
            {#if row.detail}
              {#if row.href}<a data-ui="batch.result.{index}.link" href={row.href}>{row.detail}</a>{:else}<span class="muted">{row.detail}</span>{/if}
            {/if}
          </li>
        {/each}
      </ul>
    </Card>
  {/if}
  </div>
</div>

<style>
  .results { display: grid; gap: var(--space-2); padding: 0; margin: 0; list-style: none; }
  .results li { display: flex; flex-wrap: wrap; gap: var(--space-2); overflow-wrap: anywhere; }
  .failed strong { color: var(--danger); }
  .progress { padding: var(--space-3) var(--space-4); background: var(--accent-soft); border: 1px solid var(--accent); border-radius: var(--radius-m); }
  .status { display: flex; align-items: center; gap: var(--space-3); font-weight: 700; color: var(--accent); }
  .bar { height: 8px; margin: var(--space-3) 0 var(--space-2); overflow: hidden; background: var(--border); border-radius: 999px; }
  .bar > span { display: block; height: 100%; background: var(--accent); border-radius: 999px; transition: width 0.3s; }
  .current { overflow-wrap: anywhere; }
  .spinner { display: inline-block; flex: none; width: 14px; height: 14px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }
  .waiting { align-items: center; }
  .done { display: flex; gap: var(--space-3); align-items: flex-start; padding: var(--space-3) var(--space-4); border-radius: var(--radius-m); }
  .done.ok { background: var(--accent-soft); border: 1px solid var(--accent); }
  .done.partly, .done.stopped { background: var(--warning-soft); border: 1px solid var(--warning); }
  .done h3 { margin: 0; font-size: var(--text-m); }
  .done p { margin: 0; }
  .icon { flex: none; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; color: #fff; font-weight: 800; }
  .ok .icon { background: var(--accent); }
  .partly .icon, .stopped .icon { background: var(--warning); }
  .open-tasks { align-self: center; }
  .pulse { animation: pulse 1.4s ease-in-out infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
  @media (prefers-reduced-motion: reduce) { .spinner, .pulse { animation: none; } }
</style>
