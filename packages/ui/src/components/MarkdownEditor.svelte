<script lang="ts">
  import { parseMarkdown } from '@jobhunters/core';
  import { tick } from 'svelte';
  import { applyMarkdownTool, type MarkdownTool } from '../lib/markdown-edit';
  import { tr } from '../lib/i18n.svelte';
  import Button from './Button.svelte';
  import MarkdownView from './MarkdownView.svelte';

  /**
   * A text box for Markdown with a small toolbar and a preview. The text is in `value`; `maxlength` is a hard limit (a
   * longer paste is cut, a toolbar button that would pass it does nothing). `onchange` is told about every edit, typed
   * or made by a button. The preview draws the tree of `parseMarkdown`, so nothing the user typed becomes markup.
   */
  let {
    value = $bindable(''), maxlength, id, ui, placeholder = '', rows = 12, onchange,
  }: {
    value: string;
    maxlength: number;
    id: string;
    /** Base of the data-ui identifiers. */
    ui: string;
    placeholder?: string;
    rows?: number;
    onchange?: () => void;
  } = $props();

  let mode = $state<'edit' | 'preview'>('edit');
  let area = $state<HTMLTextAreaElement>();

  const tools: { tool: MarkdownTool; label: () => string; face: string }[] = [
    { tool: 'bold', label: () => tr('ui.md.bold'), face: 'B' },
    { tool: 'italic', label: () => tr('ui.md.italic'), face: 'I' },
    { tool: 'heading', label: () => tr('ui.md.heading'), face: 'H' },
    { tool: 'list', label: () => tr('ui.md.list'), face: '•' },
    { tool: 'link', label: () => tr('ui.md.link'), face: '↗' },
    { tool: 'code', label: () => tr('ui.md.code'), face: '</>' },
  ];

  function oninput(): void {
    if (value.length > maxlength) {
      value = value.slice(0, maxlength);
      if (area) area.value = value;
    }
    onchange?.();
  }

  async function apply(tool: MarkdownTool): Promise<void> {
    if (!area) return;
    const edit = applyMarkdownTool(value, area.selectionStart, area.selectionEnd, tool, tr('ui.md.text'));
    if (edit.value.length > maxlength) return;
    value = edit.value;
    onchange?.();
    await tick();
    area.focus();
    area.setSelectionRange(edit.start, edit.end);
  }

  function onkeydown(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key !== 'b' && key !== 'i') return;
    event.preventDefault();
    void apply(key === 'b' ? 'bold' : 'italic');
  }
</script>

<div class="editor" data-ui={ui}>
  <div class="bar">
    {#if mode === 'edit'}
      <div class="tools" role="toolbar" aria-label={tr('ui.md.tools')} data-ui="{ui}.tools">
        {#each tools as item (item.tool)}
          <Button label={item.label()} ui="{ui}.tool-{item.tool}" onclick={() => apply(item.tool)}><span class="face" class:bold={item.tool === 'bold'} class:italic={item.tool === 'italic'}>{item.face}</span></Button>
        {/each}
      </div>
    {:else}
      <span></span>
    {/if}
    <div class="modes" role="group" aria-label={tr('ui.md.mode')}>
      <button type="button" class="mode" data-ui="{ui}.mode-edit" aria-pressed={mode === 'edit'} onclick={() => (mode = 'edit')}>{tr('ui.md.edit')}</button>
      <button type="button" class="mode" data-ui="{ui}.mode-preview" aria-pressed={mode === 'preview'} onclick={() => (mode = 'preview')}>{tr('ui.md.preview')}</button>
    </div>
  </div>
  {#if mode === 'edit'}
    <textarea class="input text" data-ui="{ui}.text" {id} {rows} {maxlength} {placeholder} bind:this={area} bind:value {oninput} {onkeydown}></textarea>
  {:else}
    <div class="preview" data-ui="{ui}.preview" role="region" aria-label={tr('ui.md.preview')}>
      {#if value.trim() === ''}<p class="muted">{tr('ui.md.empty')}</p>{:else}<MarkdownView blocks={parseMarkdown(value)} />{/if}
    </div>
  {/if}
</div>

<style>
  .editor { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
  .bar { display: flex; justify-content: space-between; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
  .tools { display: flex; gap: var(--space-1); flex-wrap: wrap; }
  .tools :global(.btn) { min-width: var(--tap); padding-inline: var(--space-2); }
  .face { font-family: var(--font-mono, monospace); }
  .face.bold { font-weight: 700; }
  .face.italic { font-style: italic; }
  .modes { display: flex; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
  .mode { border: 0; background: transparent; color: var(--text); padding: var(--space-2) var(--space-3); min-height: var(--tap); cursor: pointer; font: inherit; }
  .mode[aria-pressed='true'] { background: var(--accent-soft); font-weight: 600; }
  .text { width: 100%; resize: vertical; font-family: var(--font-mono, monospace); }
  .preview { border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-2) var(--space-3); min-height: 12rem; overflow-wrap: anywhere; }
  .preview :global(h3), .preview :global(h4), .preview :global(h5) { margin: var(--space-3) 0 var(--space-1); }
  .preview :global(p), .preview :global(ul), .preview :global(ol), .preview :global(pre), .preview :global(blockquote) { margin: 0 0 var(--space-2); }
  .preview :global(ul), .preview :global(ol) { padding-left: var(--space-5, 1.5rem); }
  .preview :global(blockquote) { border-left: 3px solid var(--border); padding-left: var(--space-3); color: var(--text-muted); }
  .preview :global(code) { background: var(--surface-2); border-radius: 4px; padding: 0 var(--space-1); font-family: var(--font-mono, monospace); }
  .preview :global(pre) { background: var(--surface-2); border-radius: var(--radius); padding: var(--space-2) var(--space-3); overflow-x: auto; }
  .preview :global(pre code) { background: none; padding: 0; }
  .preview :global(hr) { border: 0; border-top: 1px solid var(--border); margin: var(--space-3) 0; }
</style>
