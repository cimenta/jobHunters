<script lang="ts" module>
  export interface SearchOption {
    value: string;
    label: string;
    /** A second line (the status, the company); searched too. */
    hint?: string;
    /** Options of one group are listed together under its heading; keep them next to each other in `options`. */
    group?: string;
    /** A short mark after the label, for example the reason a suggestion was made. */
    mark?: string;
  }
</script>

<script lang="ts">
  import { foldDiacritics } from '@jobhunters/core';
  import { tr } from '../lib/i18n.svelte';

  interface Props {
    options: SearchOption[];
    value: string;
    onchange: (value: string) => void;
    label: string;
    ui?: string;
    placeholder?: string;
    emptyText?: string;
  }
  let { options, value, onchange, label, ui, placeholder = '', emptyText = tr('ui.searchSelect.empty') }: Props = $props();

  const fold = (text: string): string => foldDiacritics(text).toLowerCase();
  const uid = Math.random().toString(36).slice(2, 8);

  let open = $state(false);
  let query = $state('');
  let active = $state(0);
  let input = $state<HTMLInputElement>();

  const selected = $derived(options.find((option) => option.value === value));
  const shown = $derived.by(() => {
    const needle = fold(query.trim());
    return needle === '' ? options : options.filter((option) => fold(`${option.label} ${option.hint ?? ''}`).includes(needle));
  });

  function openList(): void {
    if (open) return;
    open = true;
    query = '';
    const index = shown.findIndex((option) => option.value === value);
    active = index === -1 ? 0 : index;
  }

  function choose(option: SearchOption): void {
    open = false;
    query = '';
    if (option.value !== value) onchange(option.value);
  }

  function key(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) openList();
      else if (shown.length > 0) active = (active + (event.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length;
    } else if (event.key === 'Enter') {
      if (open) {
        event.preventDefault();
        const option = shown[active];
        if (option) choose(option);
      }
    } else if (event.key === 'Escape') {
      if (open) {
        event.stopPropagation();
        open = false;
        query = '';
      }
    } else if (event.key === 'Tab') {
      open = false;
      query = '';
    }
  }

  function typed(): void {
    open = true;
    active = 0;
  }
</script>

<div class="field" data-ui={ui}>
  <label class="label" for="ss-{uid}">{label}</label>
  <div class="box">
    <input
      id="ss-{uid}"
      bind:this={input}
      class="input"
      data-ui={ui ? `${ui}.input` : undefined}
      role="combobox"
      aria-expanded={open}
      aria-controls="ss-list-{uid}"
      aria-autocomplete="list"
      autocomplete="off"
      {placeholder}
      value={open ? query : (selected?.label ?? '')}
      onclick={openList}
      oninput={(event) => {
        query = event.currentTarget.value;
        typed();
      }}
      onkeydown={key}
      onblur={() => {
        open = false;
        query = '';
      }}
    />
    {#if open}
      <ul id="ss-list-{uid}" class="list" role="listbox" aria-label={label} data-ui={ui ? `${ui}.list` : undefined}>
        {#each shown as option, index (option.value)}
          {#if option.group !== undefined && option.group !== shown[index - 1]?.group}
            <li class="group" role="presentation">{option.group}</li>
          {/if}
          <li
            class="option"
            class:active={index === active}
            role="option"
            aria-selected={option.value === value}
            data-ui={ui ? `${ui}.option.${option.value}` : undefined}
            onmousedown={(event) => event.preventDefault()}
            onclick={() => choose(option)}
            onkeydown={() => {}}
          >
            <span class="text">{option.label}{#if option.mark}<span class="mark">{option.mark}</span>{/if}</span>
            {#if option.hint}<span class="hint muted small">{option.hint}</span>{/if}
          </li>
        {:else}
          <li class="empty muted" role="presentation">{emptyText}</li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<style>
  .field { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
  .label { font-size: var(--text-s); font-weight: 600; }
  .box { position: relative; }
  .input { width: 100%; }
  .list { position: absolute; z-index: 30; inset-inline: 0; max-height: 18rem; overflow: auto; margin: var(--space-1) 0 0; padding: var(--space-1); list-style: none; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-m); box-shadow: var(--shadow-2, 0 4px 16px rgb(0 0 0 / 0.15)); }
  .group { padding: var(--space-1) var(--space-2); font-size: var(--text-s); font-weight: 600; color: var(--text-muted); }
  .option { display: flex; flex-direction: column; gap: 2px; padding: var(--space-2); border-radius: var(--radius-s); cursor: pointer; }
  .option.active, .option:hover { background: var(--accent-soft); }
  .option[aria-selected='true'] { font-weight: 600; }
  .mark { margin-left: var(--space-2); padding: 0 var(--space-1); font-size: var(--text-s); font-weight: 400; color: var(--success, var(--accent)); background: var(--surface-2); border-radius: var(--radius-s); }
  .empty { padding: var(--space-2); }
</style>
