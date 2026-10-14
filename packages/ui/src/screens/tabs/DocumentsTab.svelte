<script lang="ts">
  import { driveDownloadUrl, type AiTask } from '@jobhunters/core';
  import { api } from '../../api';
  import type { ApplicationDetail, DocumentView } from '../../api/types';
  import Badge from '../../components/Badge.svelte';
  import Button from '../../components/Button.svelte';
  import Dialog from '../../components/Dialog.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Field from '../../components/Field.svelte';
  import Icon from '../../components/Icon.svelte';
  import { formatDate } from '../../lib/format';
  import { tr } from '../../lib/i18n.svelte';
  import { documentTypeLabel } from '../../lib/labels';
  import { invalidate } from '../../state/invalidate.svelte';
  import { notifyError } from '../../lib/notify';
  import { toast } from '../../state/toast.svelte';

  let { detail }: { detail: ApplicationDetail } = $props();

  let notes = $state<Record<string, string>>({});
  let previewId = $state<string>();
  let previewHtml = $state('');
  let adding = $state(false);
  let templates = $state<{ id: string; name: string; type: string }[]>([]);
  let templateId = $state('');

  async function togglePreview(doc: DocumentView): Promise<void> {
    if (previewId === doc.id) {
      previewId = undefined;
      return;
    }
    const { html } = await api.previewDocument(doc.id);
    previewHtml = html;
    previewId = doc.id;
  }

  /** The documents whose PDF is being exported; the button waits, so a double click does not start a second export. */
  let exporting = $state<string[]>([]);

  async function exportPdf(doc: DocumentView): Promise<void> {
    if (exporting.includes(doc.id)) return;
    exporting = [...exporting, doc.id];
    try {
      await api.exportDocumentPdf(doc.id);
      toast.success(tr('ui.docs.pdfExported', { name: documentTypeLabel(doc.type) }));
      invalidate();
    } catch (error) {
      notifyError(error);
    } finally {
      exporting = exporting.filter((id) => id !== doc.id);
    }
  }

  /** The newest AI task that writes this document. */
  function taskOf(doc: DocumentView): AiTask | undefined {
    return detail.tasks.find((task) => task.target_type === 'document' && task.target_id === doc.id);
  }

  async function toggleAi(doc: DocumentView, checked: boolean): Promise<void> {
    const task = taskOf(doc);
    try {
      if (checked) {
        await api.requestDocumentAi(doc.id, notes[doc.id] ?? '');
        toast.success(tr('ui.docs.aiRequested', { name: documentTypeLabel(doc.type) }));
      } else if (task?.status === 'pending') {
        await api.cancelAiTask(task.id);
        toast.success(tr('ui.docs.aiCancelled', { name: documentTypeLabel(doc.type) }));
      }
    } catch (error) {
      notifyError(error);
    } finally {
      invalidate();
    }
  }

  function aiStatus(task: AiTask): string {
    switch (task.status) {
      case 'pending':
        return tr('ui.docs.aiPending');
      case 'in_progress':
        return tr('ui.tasks.status.in_progress');
      case 'done':
        return tr('ui.tasks.status.done');
      case 'needs_input':
        return tr('ui.tasks.status.needs_input');
      default:
        return tr('ui.tasks.status.failed');
    }
  }

  async function openAdd(): Promise<void> {
    templates = await api.listTemplates();
    templateId = templates[0]?.id ?? '';
    adding = true;
  }

  async function add(): Promise<void> {
    await api.addApplicationDocument(detail.application.id, templateId);
    toast.success(tr('ui.docs.added', { name: templates.find((template) => template.id === templateId)?.name ?? '', label: detail.application.label }));
    adding = false;
    invalidate();
  }
</script>

<div class="stack" data-ui="documents">
  <div><Button ui="documents.add" onclick={openAdd}><Icon name="plus" size={18} />{tr('ui.docs.add')}</Button></div>

  {#if detail.documents.length === 0}
    <EmptyState ui="documents.empty" icon="file" title={tr('ui.docs.empty')} />
  {:else}
    <ul class="list">
      {#each detail.documents as doc (doc.id)}
        {@const task = taskOf(doc)}
        {@const active = task?.status === 'pending' || task?.status === 'in_progress'}
        <li class="list-item doc" data-ui="doc.{doc.id}">
          <div class="head">
            <strong class="grow">{documentTypeLabel(doc.type)}</strong>
            {#if doc.pdf_stale}<Badge text={tr('ui.docs.pdfStale')} color="var(--warning-soft)" textColor="var(--text)" />{/if}
          </div>
          <div class="actions">
            <a data-ui="doc.{doc.id}.doc-link" href={doc.doc_url} target="_blank" rel="noopener noreferrer" class="row"><Icon name="external" size={16} />{tr('ui.docs.openDoc')}</a>
            <Button ui="doc.preview.{doc.id}" onclick={() => togglePreview(doc)}>{previewId === doc.id ? tr('ui.docs.hidePreview') : tr('ui.docs.preview')}</Button>
            <Button ui="doc.export.{doc.id}" loading={exporting.includes(doc.id)} onclick={() => exportPdf(doc)}><Icon name="file" size={16} />{tr('ui.docs.exportPdf')}</Button>
            {#if doc.pdf_url !== ''}
              <Button ui="doc.{doc.id}.pdf-link" href={driveDownloadUrl(doc.pdf_url)} target="_top" rel="noopener"><Icon name="download" size={16} />{tr('ui.docs.downloadPdf')}</Button>
              <span class="muted small">{formatDate(doc.pdf_exported_at)}</span>
            {/if}
          </div>
          <div class="ai" data-ui="doc.ai.{doc.id}">
            <label class="check">
              <input data-ui="doc.{doc.id}.ai-toggle" type="checkbox" checked={active} disabled={task?.status === 'in_progress'} onchange={(event) => toggleAi(doc, event.currentTarget.checked)} />
              {tr('ui.docs.ai')}
            </label>
            {#if !active}
              <textarea data-ui="doc.{doc.id}.ai-notes" class="input" rows="2" aria-label={tr('ui.docs.aiNotes')} placeholder={tr('ui.docs.aiNotes')} bind:value={notes[doc.id]}></textarea>
            {/if}
            {#if task}
              <div class="row wrap" data-ui="doc.ai.status.{doc.id}">
                <Badge text={aiStatus(task)} color={task.status === 'done' ? 'var(--success-soft)' : task.status === 'failed' ? 'var(--danger-soft)' : task.status === 'needs_input' ? 'var(--warning-soft)' : 'var(--surface-2)'} textColor="var(--text)" />
                {#if task.completed_at !== ''}<span class="muted small">{tr('ui.docs.aiProcessed', { date: formatDate(task.completed_at) })}</span>{/if}
                <Button variant="ghost" ui="doc.ai.refresh.{doc.id}" onclick={invalidate}><Icon name="refresh" size={16} />{tr('ui.match.refresh')}</Button>
              </div>
              {#if task.ai_note !== ''}<p class="muted small note">{task.ai_note}</p>{/if}
            {/if}
          </div>
          {#if previewId === doc.id}
            <iframe class="preview" data-ui="doc.frame.{doc.id}" title={tr('ui.docs.previewFrame')} sandbox="" srcdoc={previewHtml}></iframe>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<Dialog open={adding} title={tr('ui.docs.add')} onclose={() => (adding = false)} ui="add-document-dialog">
  {#if templates.length === 0}
    <p class="muted">{tr('ui.docs.noTemplates')}</p>
  {:else}
    <Field label={tr('ui.docs.template')} for="doc-template">
      <select data-ui="add-document.template" id="doc-template" class="input" bind:value={templateId}>
        {#each templates as template (template.id)}
          <option value={template.id}>{template.name} ({documentTypeLabel(template.type)})</option>
        {/each}
      </select>
    </Field>
  {/if}
  {#snippet footer()}
    <Button ui="add-document.cancel" onclick={() => (adding = false)}>{tr('ui.cancel')}</Button>
    <Button variant="primary" ui="add-document.submit" disabled={templateId === ''} onclick={add}>{tr('ui.add')}</Button>
  {/snippet}
</Dialog>

<style>
  .doc { flex-direction: column; align-items: stretch; }
  .head, .actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
  .note { white-space: pre-wrap; margin: 0; }
  .ai { display: flex; flex-direction: column; gap: var(--space-2); }
  .check { display: flex; align-items: center; gap: var(--space-2); min-height: var(--tap); }
  .preview { width: 100%; height: 420px; background: #fff; border: 1px solid var(--border); border-radius: var(--radius-s); }
</style>
