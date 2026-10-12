<script lang="ts">
  import { tr } from '../lib/i18n.svelte';
  import Button from './Button.svelte';
  import Dialog from './Dialog.svelte';

  interface Props {
    open: boolean;
    text: string;
    onconfirm: () => Promise<unknown> | unknown;
    onclose: () => void;
    /** Identifier shown by the identifier labels (data-ui); its two buttons add .cancel and .confirm. */
    ui?: string;
  }
  let { open, text, onconfirm, onclose, ui = 'confirm-dialog' }: Props = $props();

  async function confirm(): Promise<void> {
    await onconfirm();
    onclose();
  }
</script>

<Dialog {open} title={tr('ui.confirm')} {onclose} {ui}>
  <p>{text}</p>
  {#snippet footer()}
    <Button ui="{ui}.cancel" onclick={onclose}>{tr('ui.cancel')}</Button>
    <Button ui="{ui}.confirm" variant="danger" onclick={confirm}>{tr('ui.delete')}</Button>
  {/snippet}
</Dialog>
