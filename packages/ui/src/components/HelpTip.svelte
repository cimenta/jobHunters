<script lang="ts">
  import { tr } from '../lib/i18n.svelte';
  import Dialog from './Dialog.svelte';
  import Icon from './Icon.svelte';

  interface Props {
    /** The name of the setting, for the accessible name "Help: {label}" and the title of the dialog. */
    label: string;
    /** What the setting does, with the allowed values; shown as a tooltip and, on click or tap, in a dialog. */
    text: string;
    /** Identifier shown by the identifier labels (data-ui). */
    ui: string;
  }
  let { label, text, ui }: Props = $props();

  let open = $state(false);
</script>

<button type="button" class="tip" title={text} aria-label={tr('ui.settings.tipButton', { label })} data-ui={ui} onclick={() => (open = true)}>
  <Icon name="help" size={16} />
</button>
<Dialog {open} title={label} ui="settings.help-dialog" onclose={() => (open = false)}>
  <p>{text}</p>
</Dialog>

<style>
  .tip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 28px;
    height: 28px;
    padding: 0;
    color: var(--text-muted);
    background: transparent;
    border: 0;
    border-radius: 50%;
    cursor: help;
  }
  .tip:hover, .tip:focus-visible { color: var(--accent); }
</style>
