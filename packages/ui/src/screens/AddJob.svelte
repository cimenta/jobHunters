<script lang="ts">
  import { api } from '../api';
  import type { JobPreview } from '../api/types';
  import Button from '../components/Button.svelte';
  import Card from '../components/Card.svelte';
  import Field from '../components/Field.svelte';
  import Icon from '../components/Icon.svelte';
  import { describeWarning } from '../lib/errors';
  import { tr } from '../lib/i18n.svelte';
  import { emptyDraft, toDraft, toOverrides, type JobDraft } from '../lib/job-draft';
  import { notifyError } from '../lib/notify';
  import { paths } from '../lib/route';
  import { navigate } from '../lib/router.svelte';
  import { invalidate } from '../state/invalidate.svelte';
  import { toast } from '../state/toast.svelte';

  let url = $state('');
  let loading = $state(false);
  let preview = $state<JobPreview>();
  let reviewing = $state(false);
  let pasting = $state(false);
  let pasted = $state('');
  let usedText = $state(false);
  let draft = $state<JobDraft>(emptyDraft());
  let formError = $state<string>();

  const missing = (field: string): boolean => preview?.parsed.missing.includes(field) ?? false;

  async function read(text?: string): Promise<void> {
    loading = true;
    formError = undefined;
    try {
      const result = await api.previewJob(text === undefined ? { url } : { url, text });
      preview = result;
      usedText = text !== undefined;
      if (result.duplicateOf !== '') {
        reviewing = false;
      } else if (result.fetched || usedText) {
        draft = toDraft(result.parsed);
        reviewing = true;
        pasting = false;
      } else {
        reviewing = false;
        pasting = true;
      }
    } catch (error) {
      notifyError(error);
    } finally {
      loading = false;
    }
  }

  async function save(): Promise<void> {
    if (!preview) return;
    const { overrides, valid } = toOverrides(draft);
    if (!valid) {
      formError = tr('ui.addJob.badNumber');
      return;
    }
    formError = undefined;
    const result = await api.saveJob({ url: preview.url, text: usedText ? pasted : undefined, overrides });
    invalidate();
    if (result.status === 'created') toast.success(tr('ui.addJob.saved'));
    for (const warning of result.warnings) toast.warning(describeWarning(warning));
    navigate(paths.job(result.job.id));
  }
</script>

<div class="stack" data-ui="add-job">
  <div class="page-title">
    <Button variant="ghost" onclick={() => navigate(paths.jobs)}><Icon name="back" size={18} />{tr('ui.back')}</Button>
    <h1>{tr('ui.addJob.title')}</h1>
  </div>

  <Card>
    <form
      class="stack"
      onsubmit={(event) => {
        event.preventDefault();
        void read();
      }}
    >
      <Field label={tr('ui.addJob.url')} for="job-url" hint={tr('ui.addJob.urlHint')}>
        <input id="job-url" data-ui="add-job.url" class="input" type="url" inputmode="url" autocomplete="off" bind:value={url} />
      </Field>
      <div class="row wrap">
        <Button type="submit" variant="primary" ui="add-job.read" {loading} disabled={url.trim() === ''}>{tr('ui.addJob.find')}</Button>
        {#if !pasting && preview && preview.duplicateOf === ''}
          <Button onclick={() => (pasting = true)}>{tr('ui.addJob.pasteInstead')}</Button>
        {/if}
      </div>
    </form>
  </Card>

  {#if preview && preview.duplicateOf !== ''}
    <Card ui="add-job.duplicate">
      <h2>{tr('ui.addJob.duplicateTitle')}</h2>
      <div><Button variant="primary" onclick={() => navigate(paths.job(preview!.duplicateOf))}>{tr('ui.addJob.openExisting')}</Button></div>
    </Card>
  {/if}

  {#if pasting}
    <Card ui="add-job.paste">
      {#if preview && !preview.fetched}
        <p class="muted">{tr('ui.addJob.notFetched', { status: preview.fetchStatus })}</p>
      {/if}
      <Field label={tr('ui.addJob.pasteLabel')} for="job-text">
        <textarea id="job-text" class="input" rows="8" bind:value={pasted}></textarea>
      </Field>
      <div><Button variant="primary" disabled={pasted.trim() === ''} onclick={() => read(pasted)}>{tr('ui.addJob.usePaste')}</Button></div>
    </Card>
  {/if}

  {#if reviewing}
    <Card ui="add-job.review">
      <h2>{tr('ui.addJob.review')}</h2>
      <div class="grid">
        <Field label={tr('ui.job.title')} for="draft-title" hint={missing('title') ? tr('ui.addJob.missing') : undefined} warn>
          <input id="draft-title" class="input" bind:value={draft.title} />
        </Field>
        <Field label={tr('ui.job.company')} for="draft-company" hint={missing('company') ? tr('ui.addJob.missing') : undefined} warn>
          <input id="draft-company" class="input" bind:value={draft.company} />
        </Field>
        <Field label={tr('ui.job.location')} for="draft-location" hint={missing('location') ? tr('ui.addJob.missing') : undefined} warn>
          <input id="draft-location" class="input" bind:value={draft.location} />
        </Field>
        <Field label={tr('ui.job.salaryMin')} for="draft-min"><input id="draft-min" class="input" inputmode="decimal" bind:value={draft.salary_min} /></Field>
        <Field label={tr('ui.job.salaryMax')} for="draft-max"><input id="draft-max" class="input" inputmode="decimal" bind:value={draft.salary_max} /></Field>
        <Field label={tr('ui.job.currency')} for="draft-currency"><input id="draft-currency" class="input" maxlength="3" bind:value={draft.salary_currency} /></Field>
        <Field label={tr('ui.job.period')} for="draft-period">
          <select id="draft-period" class="input" bind:value={draft.salary_period}>
            <option value=""></option>
            <option value="hour">{tr('ui.period.hour')}</option>
            <option value="day">{tr('ui.period.day')}</option>
            <option value="week">{tr('ui.period.week')}</option>
            <option value="month">{tr('ui.period.month')}</option>
            <option value="year">{tr('ui.period.year')}</option>
          </select>
        </Field>
      </div>
      <label class="check"><input type="checkbox" bind:checked={draft.is_gig} />{tr('ui.job.gig')}</label>
      <Field label={tr('ui.job.description')} for="draft-description" hint={missing('description') ? tr('ui.addJob.missing') : undefined} warn>
        <textarea id="draft-description" class="input" rows="8" bind:value={draft.description}></textarea>
      </Field>
      <Field label={tr('ui.job.notes')} for="draft-notes"><textarea id="draft-notes" class="input" rows="3" bind:value={draft.notes}></textarea></Field>
      {#if formError}<p class="error" role="alert">{formError}</p>{/if}
      <div><Button variant="primary" ui="add-job.save" onclick={save}>{tr('ui.addJob.save')}</Button></div>
    </Card>
  {/if}
</div>

<style>
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-3); }
  .check { display: flex; align-items: center; gap: var(--space-2); min-height: var(--tap); }
  .error { color: var(--danger); }
</style>
