<script lang="ts">
  import { api } from '../../api';
  import type { ApplicationDetail } from '../../api/types';
  import Button from '../../components/Button.svelte';
  import ConfirmDialog from '../../components/ConfirmDialog.svelte';
  import Dialog from '../../components/Dialog.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Field from '../../components/Field.svelte';
  import Icon from '../../components/Icon.svelte';
  import { parseAmount } from '../../lib/job-draft';
  import { tr } from '../../lib/i18n.svelte';
  import { invalidate } from '../../state/invalidate.svelte';
  import { toast } from '../../state/toast.svelte';
  import QuestionItem from './QuestionItem.svelte';

  let { detail }: { detail: ApplicationDetail } = $props();

  let adding = $state(false);
  let text = $state('');
  let limit = $state('');
  let removing = $state<string>();

  const maxLength = $derived(parseAmount(limit));
  const valid = $derived(text.trim() !== '' && maxLength !== undefined && (maxLength === null || (Number.isInteger(maxLength) && maxLength >= 1)));

  function openAdd(): void {
    text = '';
    limit = '';
    adding = true;
  }

  async function add(): Promise<void> {
    await api.addQuestion(detail.application.id, text, maxLength ?? null);
    toast.success(tr('ui.questions.added'));
    adding = false;
    invalidate();
  }

  async function remove(): Promise<void> {
    if (removing === undefined) return;
    await api.removeQuestion(removing);
    toast.success(tr('ui.questions.removed'));
    invalidate();
  }
</script>

<div class="stack" data-ui="questions">
  <div><Button ui="questions.add" onclick={openAdd}><Icon name="plus" size={18} />{tr('ui.questions.add')}</Button></div>
  {#if detail.questions.length === 0}
    <EmptyState icon="file" title={tr('ui.questions.empty')} />
  {:else}
    <ul class="list">
      {#each detail.questions as question (question.id)}
        <QuestionItem {question} ondelete={() => (removing = question.id)} />
      {/each}
    </ul>
  {/if}
</div>

<Dialog open={adding} title={tr('ui.questions.add')} onclose={() => (adding = false)} ui="add-question-dialog">
  <div class="stack">
    <Field label={tr('ui.questions.text')} for="question-text"><textarea id="question-text" class="input" rows="3" bind:value={text}></textarea></Field>
    <Field label={tr('ui.questions.maxLength')} for="question-limit"><input id="question-limit" class="input" inputmode="numeric" bind:value={limit} /></Field>
  </div>
  {#snippet footer()}
    <Button onclick={() => (adding = false)}>{tr('ui.cancel')}</Button>
    <Button variant="primary" disabled={!valid} onclick={add}>{tr('ui.add')}</Button>
  {/snippet}
</Dialog>

<ConfirmDialog open={removing !== undefined} text={tr('ui.questions.removeConfirm')} onconfirm={remove} onclose={() => (removing = undefined)} />
