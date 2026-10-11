<script lang="ts">
  import { api } from '../../api';
  import type { Question } from '../../api/types';
  import Badge from '../../components/Badge.svelte';
  import Button from '../../components/Button.svelte';
  import Field from '../../components/Field.svelte';
  import Icon from '../../components/Icon.svelte';
  import { tr } from '../../lib/i18n.svelte';
  import { invalidate } from '../../state/invalidate.svelte';
  import { toast } from '../../state/toast.svelte';

  let { question, ondelete }: { question: Question; ondelete: () => void } = $props();

  let answer = $state('');
  $effect(() => {
    answer = question.answer;
  });

  const over = $derived(question.max_length !== null && answer.length > question.max_length);

  async function save(): Promise<void> {
    await api.answerQuestion(question.id, answer);
    toast.success(tr('ui.questions.answerSaved'));
    invalidate();
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
  <div class="row wrap">
    <span class="small" class:over>
      {question.max_length === null ? tr('ui.questions.counterNoMax', { count: answer.length }) : tr('ui.questions.counter', { count: answer.length, max: question.max_length })}
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
  .over { color: var(--danger); font-weight: 700; }
</style>
