<script lang="ts">
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
  import { toast } from '../../state/toast.svelte';

  let { detail }: { detail: ApplicationDetail } = $props();

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

  async function exportPdf(doc: DocumentView): Promise<void> {
    await api.exportDocumentPdf(doc.id);
    toast.success(tr('ui.docs.pdfExported'));
    invalidate();
  }

  async function openAdd(): Promise<void> {
    templates = await api.listTemplates();
    templateId = templates[0]?.id ?? '';
    adding = true;
  }

  async function add(): Promise<void> {
    await api.addApplicationDocument(detail.application.id, templateId);
    toast.success(tr('ui.docs.added'));
    adding = false;
    invalidate();
  }
</script>

<div class="stack" data-ui="documents">
  <div><Button ui="documents.add" onclick={openAdd}><Icon name="plus" size={18} />{tr('ui.docs.add')}</Button></div>

  {#if detail.documents.length === 0}
    <EmptyState icon="file" title={tr('ui.docs.empty')} />
  {:else}
    <ul class="list">
      {#each detail.documents as doc (doc.id)}
        <li class="list-item doc" data-ui="doc.{doc.id}">
          <div class="head">
            <strong class="grow">{documentTypeLabel(doc.type)}</strong>
            {#if doc.pdf_stale}<Badge text={tr('ui.docs.pdfStale')} color="var(--warning-soft)" textColor="var(--text)" />{/if}
          </div>
          <div class="actions">
            <a href={doc.doc_url} target="_blank" rel="noopener noreferrer" class="row"><Icon name="external" size={16} />{tr('ui.docs.openDoc')}</a>
            <Button ui="doc.preview.{doc.id}" onclick={() => togglePreview(doc)}>{previewId === doc.id ? tr('ui.docs.hidePreview') : tr('ui.docs.preview')}</Button>
            <Button ui="doc.export.{doc.id}" onclick={() => exportPdf(doc)}><Icon name="download" size={16} />{tr('ui.docs.exportPdf')}</Button>
            {#if doc.pdf_url !== ''}
              <a href={doc.pdf_url} target="_blank" rel="noopener noreferrer" class="row"><Icon name="download" size={16} />{tr('ui.docs.downloadPdf')}</a>
              <span class="muted small">{formatDate(doc.pdf_exported_at)}</span>
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
      <select id="doc-template" class="input" bind:value={templateId}>
        {#each templates as template (template.id)}
          <option value={template.id}>{template.name} ({documentTypeLabel(template.type)})</option>
        {/each}
      </select>
    </Field>
  {/if}
  {#snippet footer()}
    <Button onclick={() => (adding = false)}>{tr('ui.cancel')}</Button>
    <Button variant="primary" ui="add-document.submit" disabled={templateId === ''} onclick={add}>{tr('ui.add')}</Button>
  {/snippet}
</Dialog>

<style>
  .doc { flex-direction: column; align-items: stretch; }
  .head, .actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
  .preview { width: 100%; height: 420px; background: #fff; border: 1px solid var(--border); border-radius: var(--radius-s); }
</style>
