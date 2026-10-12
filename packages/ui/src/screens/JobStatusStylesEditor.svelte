<script lang="ts">
  import { DEFAULT_JOB_STATUS_STYLES, STATUS_TEXT_MAX, isBuiltinJobStatus, readableTextColor, t, type JobStatusStyle, type JobStatusStyles } from '@jobhunters/core';
  import { api } from '../api';
  import Badge from '../components/Badge.svelte';
  import Button from '../components/Button.svelte';
  import { tr, ui } from '../lib/i18n.svelte';
  import { jobStyles } from '../lib/job-status';
  import { reloadSettings } from '../state/app.svelte';
  import { toast } from '../state/toast.svelte';

  interface Row {
    code: string;
    /** Text for the current language; empty = the default of a built-in status. */
    text: string;
    color: string;
    check: boolean;
  }

  let rows = $state<Row[]>([]);
  let newText = $state('');
  let newColor = $state('#7c3aed');

  // Follows the saved settings and the language, so a saved change or a language switch refreshes the form.
  $effect(() => {
    rows = Object.entries(jobStyles()).map(([code, style]) => ({ code, text: style.text?.[ui.locale] ?? '', color: style.color, check: style.check }));
  });

  const builtin = (code: string): boolean => isBuiltinJobStatus(code);
  const defaultText = (code: string): string => (builtin(code) ? t(`jobStatus.${code}`, {}, ui.locale) : code);
  const label = (row: Row): string => row.text.trim() || defaultText(row.code);

  function reset(row: Row): void {
    const defaults = DEFAULT_JOB_STATUS_STYLES[row.code];
    if (defaults === undefined) return;
    row.text = '';
    row.color = defaults.color;
    row.check = defaults.check;
  }

  function add(): void {
    const suffix = Array.from({ length: 6 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
    rows = [...rows, { code: `s_${suffix}`, text: newText.trim(), color: newColor, check: true }];
    newText = '';
  }

  async function save(): Promise<void> {
    const existing = jobStyles();
    const next: JobStatusStyles = {};
    for (const row of rows) {
      const texts = { ...(existing[row.code]?.text ?? {}) };
      delete texts[ui.locale];
      if (row.text.trim() !== '') texts[ui.locale] = row.text.trim();
      const style: JobStatusStyle = { color: row.color.toLowerCase(), check: row.check };
      if (Object.keys(texts).length > 0) style.text = texts;
      next[row.code] = style;
    }
    await api.saveJobStatuses(next);
    await reloadSettings();
    toast.success(tr('ui.jobStatus.savedStyles'));
  }
</script>

<div class="stack">
  {#each rows as row (row.code)}
    <div class="row wrap status-row" data-ui="job-status.{row.code}" role="group" aria-label={defaultText(row.code)}>
      <div class="preview"><Badge text={label(row)} color={row.color} textColor={readableTextColor(row.color)} /></div>
      <input class="input text" maxlength={STATUS_TEXT_MAX} placeholder={defaultText(row.code)} aria-label={tr('ui.status.textFor', { status: defaultText(row.code) })} bind:value={row.text} />
      <input class="input color" type="color" aria-label={tr('ui.status.colorFor', { status: defaultText(row.code) })} bind:value={row.color} />
      <label class="check"><input type="checkbox" aria-label={tr('ui.status.checkFor', { status: defaultText(row.code) })} bind:checked={row.check} />{tr('ui.status.check')}</label>
      {#if builtin(row.code)}
        <Button variant="ghost" onclick={() => reset(row)}>{tr('ui.status.reset')}</Button>
      {:else}
        <Button variant="ghost" onclick={() => (rows = rows.filter((other) => other.code !== row.code))}>{tr('ui.jobStatus.delete')}</Button>
      {/if}
    </div>
  {/each}
  <div class="row wrap status-row" data-ui="job-status.add">
    <input class="input text" maxlength={STATUS_TEXT_MAX} placeholder={tr('ui.jobStatus.newText')} aria-label={tr('ui.jobStatus.newText')} bind:value={newText} />
    <input class="input color" type="color" aria-label={tr('ui.jobStatus.newColor')} bind:value={newColor} />
    <Button disabled={newText.trim() === ''} onclick={add}>{tr('ui.jobStatus.add')}</Button>
  </div>
  <div><Button variant="primary" ui="job-statuses.save" onclick={save}>{tr('ui.save')}</Button></div>
</div>

<style>
  .status-row { padding: var(--space-2) 0; border-bottom: 1px solid var(--border); }
  .preview { min-width: 120px; }
  .text { flex: 1 1 200px; width: auto; }
  .color { flex: none; }
  .check { display: flex; align-items: center; gap: var(--space-2); min-height: var(--tap); }
</style>
