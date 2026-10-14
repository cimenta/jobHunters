<script lang="ts">
  import { api } from '../api';
  import { tr } from '../lib/i18n.svelte';
  import { notifyError } from '../lib/notify';
  import { invalidate } from '../state/invalidate.svelte';

  /**
   * The salary the user asks for in an application, as one cell of the facts grid (put it inside the `dl`). A double-click
   * (or Enter on the focused text) turns it into a field: Enter or leaving the field saves, Escape cancels.
   */
  let { applicationId, value, ui }: { applicationId: string; value: string; ui: string } = $props();

  let editing = $state(false);
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
      await api.updateApplication(applicationId, { salary: draft });
    } catch (error) {
      notifyError(error);
    } finally {
      saving = false;
      invalidate();
    }
  }
</script>

<div class="fact" data-ui="{ui}.asked-salary">
  <dt class="muted small">{tr('ui.app.askedSalary')}</dt>
  <dd>
    {#if editing}
      <input
        class="input"
        data-ui="{ui}.asked-salary.input"
        aria-label={tr('ui.app.askedSalary')}
        maxlength="200"
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
        data-ui="{ui}.asked-salary.text"
        title={value === '' ? tr('ui.app.askedSalaryAdd') : tr('ui.app.askedSalaryEdit')}
        ondblclick={edit}
        onkeydown={(event) => {
          if (event.key === 'Enter') edit();
        }}
      >{value === '' ? tr('ui.app.askedSalaryAdd') : value}</span>
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
