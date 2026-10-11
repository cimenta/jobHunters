<script lang="ts">
  import { api } from '../api';
  import Button from '../components/Button.svelte';
  import Card from '../components/Card.svelte';
  import ErrorBlock from '../components/ErrorBlock.svelte';
  import Field from '../components/Field.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import { tr } from '../lib/i18n.svelte';
  import { documentTypeLabel } from '../lib/labels';
  import { useResource } from '../lib/resource.svelte';
  import { app, reloadSettings } from '../state/app.svelte';
  import { ids, setIdsVisible } from '../state/ids.svelte';
  import { invalidate } from '../state/invalidate.svelte';
  import { toast } from '../state/toast.svelte';
  import StatusStylesEditor from './StatusStylesEditor.svelte';

  const PROFILE_KEYS = ['name', 'email', 'phone', 'address', 'links'] as const;
  const DOCUMENT_TYPES = ['resume', 'cover_letter', 'other'] as const;
  const PLACEHOLDERS = ['{{name}}', '{{email}}', '{{phone}}', '{{address}}', '{{links}}', '{{company}}', '{{position}}', '{{location}}', '{{date}}', '{{body}}'];

  function profileLabel(key: (typeof PROFILE_KEYS)[number]): string {
    switch (key) {
      case 'name':
        return tr('ui.profile.name');
      case 'email':
        return tr('ui.profile.email');
      case 'phone':
        return tr('ui.profile.phone');
      case 'address':
        return tr('ui.profile.address');
      case 'links':
        return tr('ui.profile.links');
    }
  }

  const profile = useResource(() => api.getProfile());
  const templates = useResource(() => api.listTemplates());

  let uiLanguage = $state('en');
  let docLanguage = $state('en');
  let documentSet = $state<string[]>([]);
  let profileValues = $state<Record<string, string>>({ name: '', email: '', phone: '', address: '', links: '' });
  let templateType = $state('resume');
  let templateLanguage = $state('');
  let templateName = $state('');
  let templateUrl = $state('');

  $effect(() => {
    const settings = app.settings;
    if (settings) {
      uiLanguage = settings.ui_language;
      docLanguage = settings.default_document_language;
      documentSet = [...settings.default_document_set];
    }
  });
  $effect(() => {
    if (profile.data) profileValues = { ...profile.data };
  });

  async function saveLanguage(): Promise<void> {
    await api.updateSettings({ ui_language: uiLanguage, default_document_language: docLanguage });
    await reloadSettings();
    toast.success(tr('ui.saved'));
  }

  async function saveDocuments(): Promise<void> {
    await api.updateSettings({ default_document_set: documentSet.join(',') });
    await reloadSettings();
    toast.success(tr('ui.saved'));
  }

  async function saveProfile(): Promise<void> {
    await api.updateProfile(profileValues);
    toast.success(tr('ui.saved'));
    invalidate();
  }

  async function addTemplate(): Promise<void> {
    await api.addTemplate({ type: templateType, language: templateLanguage, name: templateName, docUrl: templateUrl });
    toast.success(tr('ui.template.added'));
    templateName = '';
    templateUrl = '';
    invalidate();
  }
</script>

<div class="stack-lg" data-ui="settings">
  <div class="page-title"><h1>{tr('ui.nav.settings')}</h1></div>

  <Card ui="settings.language">
    <h2>{tr('ui.settings.language')}</h2>
    <Field label={tr('ui.settings.uiLanguage')} for="set-ui-language">
      <select id="set-ui-language" class="input" bind:value={uiLanguage}>
        <option value="en">{tr('ui.language.en')}</option>
        <option value="cs">{tr('ui.language.cs')}</option>
      </select>
    </Field>
    <Field label={tr('ui.settings.docLanguage')} for="set-doc-language">
      <select id="set-doc-language" class="input" bind:value={docLanguage}>
        <option value="en">{tr('ui.language.en')}</option>
        <option value="cs">{tr('ui.language.cs')}</option>
      </select>
    </Field>
    <div><Button variant="primary" ui="settings.language.save" onclick={saveLanguage}>{tr('ui.save')}</Button></div>
  </Card>

  <Card ui="settings.documents">
    <h2>{tr('ui.settings.documents')}</h2>
    <fieldset class="checks">
      <legend>{tr('ui.settings.documentSet')}</legend>
      {#each DOCUMENT_TYPES as type (type)}
        <label class="check"><input type="checkbox" value={type} bind:group={documentSet} />{documentTypeLabel(type)}</label>
      {/each}
    </fieldset>
    <div><Button variant="primary" ui="settings.documents.save" onclick={saveDocuments}>{tr('ui.save')}</Button></div>
  </Card>

  <Card ui="settings.profile">
    <h2>{tr('ui.settings.profile')}</h2>
    <p class="muted small">{tr('ui.settings.profileHint')}</p>
    {#if profile.status === 'error'}
      <ErrorBlock error={profile.error} onretry={invalidate} />
    {:else if profile.status === 'loading'}
      <Skeleton lines={4} />
    {:else}
      <div class="grid">
        {#each PROFILE_KEYS as key (key)}
          <Field label={profileLabel(key)} for="profile-{key}"><input id="profile-{key}" class="input" bind:value={profileValues[key]} /></Field>
        {/each}
      </div>
      <div><Button variant="primary" ui="settings.profile.save" onclick={saveProfile}>{tr('ui.save')}</Button></div>
    {/if}
  </Card>

  <Card ui="settings.templates">
    <h2>{tr('ui.settings.templates')}</h2>
    <p class="muted small">{tr('ui.settings.templatesHint')} {#each PLACEHOLDERS as placeholder (placeholder)}<code>{placeholder}</code>{' '}{/each}</p>
    {#if templates.status === 'error'}
      <ErrorBlock error={templates.error} onretry={invalidate} />
    {:else if templates.status === 'loading'}
      <Skeleton lines={3} />
    {:else if (templates.data ?? []).length === 0}
      <p class="muted">{tr('ui.settings.noTemplates')}</p>
    {:else}
      <ul class="list">
        {#each templates.data ?? [] as template (template.id)}
          <li class="list-item">
            <span class="grow">{template.name}</span>
            <span class="muted small">{documentTypeLabel(template.type)} · {template.language === '' ? tr('ui.template.allLanguages') : template.language}</span>
            <a href={template.doc_url} target="_blank" rel="noopener noreferrer">{tr('ui.open')}</a>
          </li>
        {/each}
      </ul>
    {/if}
    <div class="grid">
      <Field label={tr('ui.template.type')} for="template-type">
        <select id="template-type" class="input" bind:value={templateType}>
          {#each DOCUMENT_TYPES as type (type)}<option value={type}>{documentTypeLabel(type)}</option>{/each}
        </select>
      </Field>
      <Field label={tr('ui.template.language')} for="template-language">
        <select id="template-language" class="input" bind:value={templateLanguage}>
          <option value="">{tr('ui.template.allLanguages')}</option>
          <option value="en">{tr('ui.language.en')}</option>
          <option value="cs">{tr('ui.language.cs')}</option>
        </select>
      </Field>
      <Field label={tr('ui.template.name')} for="template-name"><input id="template-name" class="input" bind:value={templateName} /></Field>
      <Field label={tr('ui.template.url')} for="template-url"><input id="template-url" class="input" inputmode="url" bind:value={templateUrl} /></Field>
    </div>
    <div><Button variant="primary" ui="settings.templates.add" onclick={addTemplate}>{tr('ui.template.add')}</Button></div>
  </Card>

  <Card ui="settings.status-labels">
    <h2>{tr('ui.settings.statusLabels')}</h2>
    <p class="muted small">{tr('ui.settings.statusLabelsHint')}</p>
    <StatusStylesEditor />
  </Card>

  <Card ui="settings.about">
    <h2>{tr('ui.settings.about')}</h2>
    <p>JobHunters</p>
    <p class="muted">{tr('ui.settings.version', { version: app.version })}</p>
    <label class="check" data-ui="settings.show-ids">
      <input type="checkbox" checked={ids.visible} onchange={(event) => setIdsVisible(event.currentTarget.checked)} />{tr('ui.settings.showIds')}
    </label>
    <p class="muted small">{tr('ui.settings.showIdsHint')}</p>
  </Card>
</div>

<style>
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-3); }
  .checks { display: flex; flex-direction: column; gap: var(--space-1); padding: 0; margin: 0; border: 0; }
  legend { padding: 0; margin-bottom: var(--space-2); font-weight: 600; font-size: var(--text-s); }
  .check { display: flex; align-items: center; gap: var(--space-2); min-height: var(--tap); }
  code { padding: 1px var(--space-1); background: var(--surface-2); border-radius: var(--radius-s); }
</style>
