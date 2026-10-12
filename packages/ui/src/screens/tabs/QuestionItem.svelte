<script lang="ts">
  import { countSentences, type AiTask } from '@jobhunters/core';
  import { api } from '../../api';
  import type { Question } from '../../api/types';
  import Badge from '../../components/Badge.svelte';
  import Button from '../../components/Button.svelte';
  import Field from '../../components/Field.svelte';
  import Icon from '../../components/Icon.svelte';
  import { formatDate, shorten } from '../../lib/format';
  import { tr } from '../../lib/i18n.svelte';
  import { invalidate } from '../../state/invalidate.svelte';
  import { notifyError } from '../../lib/notify';
  import { toast } from '../../state/toast.svelte';

  let { question, task, ondelete }: { question: Question; task: AiTask | undefined; ondelete: () => void } = $props();

  let notes = $state('');
  const active = $derived(task?.status === 'pending' || task?.status === 'in_progress');

  let answer = $state('');
  $effect(() => {
    answer = question.answer;
  });

  const over = $derived(question.max_sentences !== null && countSentences(answer) > question.max_sentences);

  async function save(): Promise<void> {
    await api.answerQuestion(question.id, answer);
    toast.success(tr('ui.questions.answerSaved', { question: shorten(question.question, 40) }));
    invalidate();
  }

  async function toggleAi(checked: boolean): Promise<void> {
    try {
      if (checked) {
        await api.requestQuestionAi(question.id, notes);
        toast.success(tr('ui.questions.aiRequested', { question: shorten(question.question, 40) }));
      } else if (task?.status === 'pending') {
        await api.cancelAiTask(task.id);
        toast.success(tr('ui.questions.aiCancelled', { question: shorten(question.question, 40) }));
      }
    } catch (error) {
      notifyError(error);
    } finally {
      invalidate();
    }
  }

  function aiStatus(current: AiTask): string {
    switch (current.status) {
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

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(answer);
    toast.success(tr('ui.copied'));
  }
</script>

<li class="list-item item" data-ui="question.{question.id}">
  <div class="head">
    <strong class="grow">{question.question}</strong>
    <Badge
      text={question.status === 'answered' ? tr('ui.questions.statusAnswered') : tr('ui.questions.statusOpen')}
      color={question.status === 'answered' ? 'var(--success-soft)' : 'var(--surface-2)'}
      textColor="var(--text)"
    />
  </div>
  <Field label={tr('ui.questions.answer')} for="answer-{question.id}">
    <textarea id="answer-{question.id}" data-ui="question.answer.{question.id}" class="input" rows="4" aria-invalid={over} bind:value={answer}></textarea>
  </Field>
  <div class="ai" data-ui="question.ai.{question.id}">
    <label class="check">
      <input type="checkbox" checked={active} disabled={task?.status === 'in_progress'} onchange={(event) => toggleAi(event.currentTarget.checked)} />
      {tr('ui.questions.ai')}
    </label>
    {#if !active}
      <textarea class="input" rows="2" aria-label={tr('ui.docs.aiNotes')} placeholder={tr('ui.docs.aiNotes')} bind:value={notes}></textarea>
    {/if}
    {#if task}
      <div class="row wrap" data-ui="question.ai.status.{question.id}">
        <Badge text={aiStatus(task)} color={task.status === 'done' ? 'var(--success-soft)' : task.status === 'failed' ? 'var(--danger-soft)' : task.status === 'needs_input' ? 'var(--warning-soft)' : 'var(--surface-2)'} textColor="var(--text)" />
        {#if task.completed_at !== ''}<span class="muted small">{tr('ui.docs.aiProcessed', { date: formatDate(task.completed_at) })}</span>{/if}
        <Button variant="ghost" ui="question.ai.refresh.{question.id}" onclick={invalidate}><Icon name="refresh" size={16} />{tr('ui.match.refresh')}</Button>
      </div>
      {#if task.ai_note !== ''}<p class="muted small note">{task.ai_note}</p>{/if}
    {/if}
  </div>
  <div class="row wrap">
    <span class="small" class:over>
      {question.max_sentences === null ? tr('ui.questions.counterNoMax', { count: countSentences(answer) }) : tr('ui.questions.counter', { count: countSentences(answer), max: question.max_sentences })}
    </span>
    <span class="grow"></span>
    <Button onclick={copy} disabled={answer === ''}><Icon name="copy" size={16} />{tr('ui.copy')}</Button>
    <Button variant="danger" onclick={ondelete}><Icon name="trash" size={16} />{tr('ui.delete')}</Button>
    <Button variant="primary" ui="question.save.{question.id}" onclick={save}>{tr('ui.save')}</Button>
  </div>
</li>

<style>
  .item { flex-direction: column; align-items: stretch; }
  .head { display: flex; gap: var(--space-3); align-items: flex-start; }
  .ai { display: flex; flex-direction: column; gap: var(--space-2); }
  .check { display: flex; align-items: center; gap: var(--space-2); min-height: var(--tap); }
  .note { white-space: pre-wrap; margin: 0; }
  .over { color: var(--danger); font-weight: 700; }
</style>
