<script lang="ts">
  import { api } from '../api';
  import Button from '../components/Button.svelte';
  import Dialog from '../components/Dialog.svelte';
  import Field from '../components/Field.svelte';
  import { describeError } from '../lib/errors';
  import { tr } from '../lib/i18n.svelte';
  import { invalidate } from '../state/invalidate.svelte';
  import { toast } from '../state/toast.svelte';

  /** Asks for the link of an ad that has none and saves it; a link that is not a web address or that another ad has is refused here. */
  let { open, job, onclose }: { open: boolean; job: { id: string; title: string }; onclose: () => void } = $props();

  let url = $state('');
  let error = $state('');

  $effect(() => {
    if (open) {
      url = '';
      error = '';
    }
  });

  async function save(): Promise<void> {
    error = '';
    try {
      await api.updateJob(job.id, { url });
    } catch (failure) {
      error = describeError(failure);
      return;
    }
    toast.success(tr('ui.addLink.saved', { title: job.title }));
    invalidate();
    onclose();
  }
</script>

<Dialog {open} title={tr('ui.addLink.title')} {onclose} ui="add-link-dialog">
  <Field label={tr('ui.addLink.label')} for="add-link-url" {error}>
    <input
      id="add-link-url"
      data-ui="add-link.url"
      class="input"
      type="url"
      inputmode="url"
      autocomplete="off"
      placeholder="https://"
      bind:value={url}
      oninput={() => (error = '')}
      onkeydown={(event) => {
        if (event.key === 'Enter' && url.trim() !== '') void save();
      }}
    />
  </Field>
  {#snippet footer()}
    <Button ui="add-link.cancel" onclick={onclose}>{tr('ui.cancel')}</Button>
    <Button variant="primary" ui="add-link.save" disabled={url.trim() === ''} onclick={save}>{tr('ui.save')}</Button>
  {/snippet}
</Dialog>
