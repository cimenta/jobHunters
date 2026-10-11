<script lang="ts">
  import { APPLICATION_STATUSES, DEFAULT_STATUS_COLORS, STATUS_TEXT_MAX, readableTextColor, serializeStatusStyles, t, type ApplicationStatus } from '@jobhunters/core';
  import { api } from '../api';
  import Badge from '../components/Badge.svelte';
  import Button from '../components/Button.svelte';
  import { tr, ui } from '../lib/i18n.svelte';
  import { buildStatusStyles, initialEdits, type StatusEdit } from '../lib/status-edit';
  import { app, reloadSettings } from '../state/app.svelte';
  import { toast } from '../state/toast.svelte';

  let edits = $state<Record<ApplicationStatus, StatusEdit>>(initialEdits({}, 'en'));

  // Follows the saved settings and the language, so a saved change or a language switch refreshes the form.
  $effect(() => {
    edits = initialEdits(app.settings?.status_styles ?? {}, ui.locale);
  });

  const defaultText = (status: ApplicationStatus): string => t(`status.${status}`, {}, ui.locale);
  const previewText = (status: ApplicationStatus): string => edits[status].text.trim() || defaultText(status);

  function reset(status: ApplicationStatus): void {
    edits[status] = { text: '', color: DEFAULT_STATUS_COLORS[status] };
  }

  async function save(): Promise<void> {
    const next = buildStatusStyles(app.settings?.status_styles ?? {}, edits, ui.locale);
    await api.updateSettings({ status_styles: serializeStatusStyles(next) });
    await reloadSettings();
    toast.success(tr('ui.saved'));
  }
</script>

<div class="stack">
  {#each APPLICATION_STATUSES as status (status)}
    <div class="row wrap status-row" data-ui="status.{status}" role="group" aria-label={defaultText(status)}>
      <div class="preview"><Badge text={previewText(status)} color={edits[status].color} textColor={readableTextColor(edits[status].color)} /></div>
      <input class="input text" maxlength={STATUS_TEXT_MAX} placeholder={defaultText(status)} aria-label={tr('ui.status.textFor', { status: defaultText(status) })} bind:value={edits[status].text} />
      <input class="input color" type="color" aria-label={tr('ui.status.colorFor', { status: defaultText(status) })} bind:value={edits[status].color} />
      <Button variant="ghost" onclick={() => reset(status)}>{tr('ui.status.reset')}</Button>
    </div>
  {/each}
  <div><Button variant="primary" ui="status-styles.save" onclick={save}>{tr('ui.save')}</Button></div>
</div>

<style>
  .status-row { padding: var(--space-2) 0; border-bottom: 1px solid var(--border); }
  .preview { min-width: 120px; }
  .text { flex: 1 1 200px; width: auto; }
  .color { flex: none; }
</style>
