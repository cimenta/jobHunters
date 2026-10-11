<script lang="ts">
  import { tr } from '../lib/i18n.svelte';
  import Button from './Button.svelte';
  import Dialog from './Dialog.svelte';

  interface Props {
    open: boolean;
    text: string;
    onconfirm: () => Promise<unknown> | unknown;
    onclose: () => void;
  }
  let { open, text, onconfirm, onclose }: Props = $props();

  async function confirm(): Promise<void> {
    await onconfirm();
    onclose();
  }
</script>

<Dialog {open} title={tr('ui.confirm')} {onclose} ui="confirm-dialog">
  <p>{text}</p>
  {#snippet footer()}
    <Button onclick={onclose}>{tr('ui.cancel')}</Button>
    <Button variant="danger" onclick={confirm}>{tr('ui.delete')}</Button>
  {/snippet}
</Dialog>
