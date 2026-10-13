<script lang="ts">
  import { api } from '../api';
  import type { HistoryList } from '../api/types';
  import { tr } from '../lib/i18n.svelte';
  import Button from './Button.svelte';
  import HistoryDialog from './HistoryDialog.svelte';

  interface Props {
    /** The tracked setting key, for example candidate_experience. */
    historyKey: string;
    /** The human name of the text. */
    name: string;
    /** Base identifier of the button; the dialog adds .dialog. */
    ui: string;
    /** Change this number (after a save) to reload the count. */
    refreshKey?: number;
    /** Called after Use This saved a version, so the owner reloads the text. */
    onrestored?: () => Promise<unknown> | unknown;
  }
  let { historyKey, name, ui, refreshKey = 0, onrestored }: Props = $props();

  let list = $state<HistoryList>();
  let open = $state(false);

  async function load(): Promise<void> {
    try {
      list = await api.listHistory(historyKey);
    } catch {
      list = undefined;
    }
  }

  $effect(() => {
    void refreshKey;
    void load();
  });

  async function show(): Promise<void> {
    await load();
    open = true;
  }

  async function changed(restored: boolean): Promise<void> {
    await load();
    if (restored) await onrestored?.();
  }
</script>

<Button {ui} onclick={show}>{tr('ui.history.button', { count: list?.entries.length ?? 0 })}</Button>
<HistoryDialog {open} {historyKey} {name} {list} {ui} onclose={() => (open = false)} onchange={changed} />
