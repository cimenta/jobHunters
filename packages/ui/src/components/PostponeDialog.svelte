<script lang="ts">
  import { plusDays, todayLocal } from '../lib/format';
  import { tr } from '../lib/i18n.svelte';
  import Button from './Button.svelte';
  import Dialog from './Dialog.svelte';
  import Field from './Field.svelte';

  interface Props {
    open: boolean;
    onclose: () => void;
    onconfirm: (date: string) => Promise<unknown>;
  }
  let { open, onclose, onconfirm }: Props = $props();

  let date = $state('');
  const today = todayLocal();
  const valid = $derived(date !== '' && date >= today);

  $effect(() => {
    if (open) date = plusDays(todayLocal(), 1);
  });

  async function confirm(): Promise<void> {
    await onconfirm(date);
    onclose();
  }
</script>

<Dialog {open} title={tr('ui.reminder.postponeTitle')} {onclose} ui="postpone-dialog">
  <Field label={tr('ui.reminder.newDate')} for="postpone-date">
    <input data-ui="postpone.date" id="postpone-date" class="input" type="date" min={today} bind:value={date} />
  </Field>
  {#snippet footer()}
    <Button ui="postpone.cancel" onclick={onclose}>{tr('ui.cancel')}</Button>
    <Button ui="postpone.confirm" variant="primary" disabled={!valid} onclick={confirm}>{tr('ui.reminder.postpone')}</Button>
  {/snippet}
</Dialog>
