<script lang="ts">
  import { tr } from '../lib/i18n.svelte';
  import { notifyError } from '../lib/notify';
  import { invalidate } from '../state/invalidate.svelte';

  /**
   * A labelled text of the facts grid (put it inside the `dl`) that is changed in place: a double-click, or Enter on the
   * focused text, turns it into a field; Enter or leaving the field saves, Escape cancels. A parent can open it by
   * binding `editing`, for example to ask for a reason right after a status was chosen.
   */
  let {
    value, label, ui, maxlength = 200, wide, placeholder = '', editing = $bindable(false), onsave,
  }: {
    value: string;
    label: string;
    /** Base of the data-ui identifiers: `<ui>`, `<ui>.text` and `<ui>.input`. */
    ui: string;
    maxlength?: number;
    /** Takes two columns of the grid, or the whole row. */
    wide?: 'two' | 'full';
    placeholder?: string;
    editing?: boolean;
    onsave: (text: string) => Promise<unknown>;
  } = $props();

  let draft = $state('');
  let saving = false;

  function edit(): void {
    draft = value;
    editing = true;
  }

  function focusOnMount(node: HTMLInputElement): void {
    node.focus();
    node.select();
  }

  async function save(): Promise<void> {
    if (!editing || saving) return;
    editing = false;
    if (draft.trim() === value.trim()) return;
    saving = true;
    try {
      await onsave(draft);
    } catch (error) {
      notifyError(error);
    } finally {
      saving = false;
      invalidate();
    }
  }
</script>

<div class="fact" style:grid-column={wide === 'full' ? '1 / -1' : wide === 'two' ? 'span 2' : undefined} data-ui={ui}>
  <dt class="muted small">{label}</dt>
  <dd>
    {#if editing}
      <input
        class="input"
        data-ui="{ui}.input"
        aria-label={label}
        {maxlength}
        {placeholder}
        bind:value={draft}
        use:focusOnMount
        onblur={save}
        onkeydown={(event) => {
          if (event.key === 'Enter') void save();
          else if (event.key === 'Escape') editing = false;
        }}
      />
    {:else}
      <span
        class="text"
        class:empty={value === ''}
        role="button"
        tabindex="0"
        data-ui="{ui}.text"
        title={value === '' ? tr('ui.inline.add') : tr('ui.inline.edit')}
        ondblclick={edit}
        onkeydown={(event) => {
          if (event.key === 'Enter') edit();
        }}
      >{value === '' ? tr('ui.inline.add') : value}</span>
    {/if}
  </dd>
</div>

<style>
  .fact { min-width: 0; overflow-wrap: anywhere; }
  dd { margin: 0; }
  .text { cursor: text; display: inline-block; min-width: 4rem; }
  .text.empty { color: var(--text-muted); }
  .input { width: 100%; }
</style>
