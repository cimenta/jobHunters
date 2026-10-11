<script lang="ts">
  import { api } from '../api';
  import type { ApplicationRow, Job } from '../api/types';
  import Button from '../components/Button.svelte';
  import Dialog from '../components/Dialog.svelte';
  import Field from '../components/Field.svelte';
  import { describeWarning } from '../lib/errors';
  import { tr } from '../lib/i18n.svelte';
  import { paths } from '../lib/route';
  import { navigate } from '../lib/router.svelte';
  import { app } from '../state/app.svelte';
  import { invalidate } from '../state/invalidate.svelte';
  import { toast } from '../state/toast.svelte';

  interface Props {
    open: boolean;
    job: Job;
    applications: ApplicationRow[];
    onclose: () => void;
  }
  let { open, job, applications, onclose }: Props = $props();

  let language = $state('en');
  let from = $state('');

  $effect(() => {
    if (open) {
      language = app.settings?.default_document_language ?? 'en';
      from = '';
    }
  });

  async function create(): Promise<void> {
    const result = await api.createApplication({ jobId: job.id, language, fromApplicationId: from === '' ? undefined : from });
    invalidate();
    toast.success(tr('ui.createApp.created'));
    for (const warning of result.warnings) toast.warning(describeWarning(warning));
    onclose();
    navigate(paths.application(result.application.id));
  }
</script>

<Dialog {open} title={tr('ui.job.createApplication')} {onclose} ui="create-application-dialog">
  <div class="stack">
    <Field label={tr('ui.createApp.language')} for="create-language">
      <select id="create-language" class="input" bind:value={language}>
        <option value="en">{tr('ui.language.en')}</option>
        <option value="cs">{tr('ui.language.cs')}</option>
      </select>
    </Field>
    {#if applications.length > 0}
      <Field label={tr('ui.createApp.from')} for="create-from">
        <select id="create-from" class="input" bind:value={from}>
          <option value="">{tr('ui.createApp.fromNone')}</option>
          {#each applications as application (application.id)}
            <option value={application.id}>{application.label}</option>
          {/each}
        </select>
      </Field>
    {/if}
  </div>
  {#snippet footer()}
    <Button onclick={onclose}>{tr('ui.cancel')}</Button>
    <Button variant="primary" ui="create-application.submit" onclick={create}>{tr('ui.createApp.submit')}</Button>
  {/snippet}
</Dialog>
