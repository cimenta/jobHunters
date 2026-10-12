<script lang="ts">
  import { onDestroy } from 'svelte';
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

  let { pauseMs = 1000 }: { pauseMs?: number } = $props();

  interface Row {
    kind: 'saved' | 'duplicate' | 'queued' | 'invalid' | 'failed';
    label: string;
    detail?: string;
    href?: string;
  }

  let text = $state('');
  let running = $state(false);
  let stopRequested = false;
  let finished = $state(false);
  let rows = $state<Row[]>([]);
  let summary = $state('');
  let queuedCount = $state(0);
  let cutOff = $state(false);
  let stoppedNote = $state('');

  const parsed = $derived(parseLinks(text));
  onDestroy(() => (stopRequested = true));

  async function run(): Promise<void> {
    const { links, skipped, tooMany } = parseLinks(text);
    if (links.length === 0) return;
    running = true;
    finished = false;
    stopRequested = false;
    rows = [];
    summary = '';
    stoppedNote = '';
    cutOff = tooMany;
    let done = 0;
    const counts = { saved: 0, queued: 0, duplicates: 0, invalid: 0 };
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
          rows.push({ kind: 'failed', label: tr('ui.batch.failed', { message: describeError(error) }), detail: link });
        }
        done += 1;
        if (stopRequested) break;
        if (index < links.length - 1 && pauseMs > 0) await new Promise((resolve) => setTimeout(resolve, pauseMs));
        if (stopRequested) break;
      }
    } finally {
      summary = tr('ui.batch.summary', counts);
      if (done < links.length) stoppedNote = tr('ui.batch.stopped', { done, total: links.length });
      queuedCount = counts.queued;
      running = false;
      finished = true;
      toast.success(summary);
      invalidate();
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
        <Button type="submit" variant="primary" ui="batch.add" disabled={parsed.links.length === 0 || running}>{tr('ui.batch.add')}</Button>
        {#if running}<Button ui="batch.stop" onclick={() => (stopRequested = true)}>{tr('ui.batch.stop')}</Button>{/if}
      </div>
      {#if parsed.tooMany || cutOff}<p class="muted">{tr('ui.batch.tooMany')}</p>{/if}
    </form>
  </Card>

  <div aria-live="polite">
  {#if rows.length > 0 || finished}
    <Card ui="batch.results">
      {#if finished}
        <p data-ui="batch.summary"><strong>{summary}</strong></p>
        {#if stoppedNote}<p>{stoppedNote}</p>{/if}
        {#if queuedCount > 0}
          <p>{tr('ui.batch.queuedHint')} <a data-ui="batch.open-tasks" href={paths.tasks}>{tr('ui.batch.openTasks')}</a></p>
        {/if}
      {/if}
      <ul class="results">
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
</style>
