<script lang="ts">
  import { MAX_INTERVIEW_PREP } from '@jobhunters/core';
  import { api } from '../../api';
  import type { ApplicationDetail } from '../../api/types';
  import Button from '../../components/Button.svelte';
  import Field from '../../components/Field.svelte';
  import MarkdownEditor from '../../components/MarkdownEditor.svelte';
  import { tr, ui } from '../../lib/i18n.svelte';
  import { invalidate } from '../../state/invalidate.svelte';
  import { toast } from '../../state/toast.svelte';

  let { detail }: { detail: ApplicationDetail } = $props();

  const saved = $derived(detail.application.interview_prep ?? '');
  let draft = $state('');
  let edited = $state(false);

  // Follows the saved text until the user starts typing; after a save the draft equals the saved text again.
  $effect(() => {
    if (!edited) draft = saved;
  });

  const dirty = $derived(draft !== saved);
  const full = $derived(draft.length >= MAX_INTERVIEW_PREP);
  /** The whole number, not the abbreviated one the menu badges use. */
  const number = (value: number): string => value.toLocaleString(ui.locale);
  const warning = $derived(draft.length > MAX_INTERVIEW_PREP * 0.94);

  async function save(): Promise<void> {
    await api.updateApplication(detail.application.id, { interview_prep: draft });
    edited = false;
    toast.success(tr('ui.interview.saved', { label: detail.application.label }));
    invalidate();
  }
</script>

<div class="stack" data-ui="interview">
  <Field label={tr('ui.interview.label')} for="interview-prep">
    <MarkdownEditor
      ui="interview.editor"
      id="interview-prep"
      maxlength={MAX_INTERVIEW_PREP}
      placeholder={tr('ui.interview.placeholder')}
      bind:value={draft}
      onchange={() => (edited = true)}
    />
  </Field>
  {#if full}<p class="warn small" data-ui="interview.limit" role="status">{tr('ui.interview.limit', { max: number(MAX_INTERVIEW_PREP) })}</p>{/if}
  <div class="row bar">
    <span class="small" class:warn={warning} class:muted={!warning} data-ui="interview.count">{tr('ui.interview.count', { count: number(draft.length), max: number(MAX_INTERVIEW_PREP) })} · {tr('ui.md.name')}</span>
    <span class="row">
      {#if dirty}<span class="muted small" data-ui="interview.unsaved">{tr('ui.interview.unsaved')}</span>{/if}
      <Button variant="primary" ui="interview.save" disabled={!dirty} onclick={save}>{tr('ui.save')}</Button>
    </span>
  </div>
</div>

<style>
  .bar { justify-content: space-between; align-items: center; }
  .warn { color: var(--warning); }
</style>
