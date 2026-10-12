<script lang="ts">
  import { OFFLINE_RULES, PROMPT_PLACEHOLDERS, PROMPT_TYPES, SETTINGS_DEFAULTS, type PromptType } from '@jobhunters/core';
  import { api } from '../api';
  import Button from '../components/Button.svelte';
  import Card from '../components/Card.svelte';
  import ErrorBlock from '../components/ErrorBlock.svelte';
  import Field from '../components/Field.svelte';
  import Tabs from '../components/Tabs.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import { tr } from '../lib/i18n.svelte';
  import { documentTypeLabel } from '../lib/labels';
  import { useResource } from '../lib/resource.svelte';
  import { app, reloadSettings } from '../state/app.svelte';
  import { ids, setIdsVisible } from '../state/ids.svelte';
  import { invalidate } from '../state/invalidate.svelte';
  import { toast } from '../state/toast.svelte';
  import JobStatusStylesEditor from './JobStatusStylesEditor.svelte';
  import StatusStylesEditor from './StatusStylesEditor.svelte';
  import TransitionsEditor from './TransitionsEditor.svelte';

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

  let tab = $state('general');
  let experience = $state('');
  let prompts = $state<Record<PromptType, string>>({ resume_tailor: '', cover_letter: '', other: '', answer_question: '', match_job: '' });
  let checkEnabled = $state(false);
  let checkHours = $state('18');
  let immediateRules = $state<string[]>([]);
  let offlineTexts = $state('');
  let uiLanguage = $state('en');
  let uiTheme = $state('system');
  let resultNotices = $state(true);
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
      uiTheme = settings.ui_theme;
      resultNotices = settings.result_notices;
      experience = settings.candidate_experience;
      checkEnabled = settings.availability_check_enabled;
      checkHours = settings.availability_check_hours.join(', ');
      immediateRules = [...settings.availability_immediate_rules];
      offlineTexts = settings.offline_texts.join('\n');
      prompts = Object.fromEntries(PROMPT_TYPES.map((type) => [type, settings[`ai_prompt_${type}`]])) as Record<PromptType, string>;
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
    toast.success(tr('ui.settings.savedLanguage'));
  }

  async function saveTheme(): Promise<void> {
    await api.updateSettings({ ui_theme: uiTheme });
    await reloadSettings();
    toast.success(tr('ui.settings.savedTheme', { mode: tr(`ui.theme.${uiTheme}`) }));
  }

  async function saveNotices(): Promise<void> {
    await api.updateSettings({ result_notices: String(resultNotices) });
    await reloadSettings();
    toast.success(tr(resultNotices ? 'ui.settings.noticesOn' : 'ui.settings.noticesOff'));
  }

  async function saveExperience(): Promise<void> {
    await api.updateSettings({ candidate_experience: experience });
    await reloadSettings();
    toast.success(tr('ui.settings.savedExperience'));
  }

  async function savePrompts(): Promise<void> {
    await api.updateSettings(Object.fromEntries(PROMPT_TYPES.map((type) => [`ai_prompt_${type}`, prompts[type]])));
    await reloadSettings();
    toast.success(tr('ui.settings.savedPrompts'));
  }

  async function resetPrompts(): Promise<void> {
    await api.updateSettings(Object.fromEntries(PROMPT_TYPES.map((type) => [`ai_prompt_${type}`, SETTINGS_DEFAULTS[`ai_prompt_${type}`]])));
    await reloadSettings();
    toast.success(tr('ui.settings.resetPrompts'));
  }

  function promptLabel(type: PromptType): string {
    switch (type) {
      case 'resume_tailor':
        return tr('ui.settings.promptResume');
      case 'cover_letter':
        return tr('ui.settings.promptCoverLetter');
      case 'other':
        return tr('ui.settings.promptOther');
      case 'answer_question':
        return tr('ui.settings.promptAnswer');
      case 'match_job':
        return tr('ui.settings.promptMatch');
    }
  }

  async function saveAvailability(): Promise<void> {
    await api.updateSettings({
      availability_check_enabled: String(checkEnabled),
      availability_check_hours: checkHours,
      availability_immediate_rules: immediateRules.join(','),
      offline_texts: offlineTexts,
    });
    await reloadSettings();
    toast.success(tr('ui.settings.savedAvailability'));
  }

  async function saveDocuments(): Promise<void> {
    await api.updateSettings({ default_document_set: documentSet.join(',') });
    await reloadSettings();
    toast.success(tr('ui.settings.savedDocuments'));
  }

  async function saveProfile(): Promise<void> {
    await api.updateProfile(profileValues);
    toast.success(tr('ui.settings.savedProfile'));
    invalidate();
  }

  async function addTemplate(): Promise<void> {
    await api.addTemplate({ type: templateType, language: templateLanguage, name: templateName, docUrl: templateUrl });
    toast.success(tr('ui.template.added', { name: templateName }));
    templateName = '';
    templateUrl = '';
    invalidate();
  }
</script>

<div class="stack-lg" data-ui="settings">
  <div class="page-title"><h1>{tr('ui.nav.settings')}</h1></div>

  <Tabs
    items={[
      { id: 'general', label: tr('ui.settings.tab.general') },
      { id: 'documents', label: tr('ui.settings.tab.documents') },
      { id: 'experience', label: tr('ui.settings.tab.experience') },
      { id: 'prompts', label: tr('ui.settings.tab.prompts') },
      { id: 'availability', label: tr('ui.settings.tab.availability') },
      { id: 'profile', label: tr('ui.settings.tab.profile') },
      { id: 'templates', label: tr('ui.settings.tab.templates') },
      { id: 'statuslabels', label: tr('ui.settings.tab.statusLabels') },
      { id: 'transitions', label: tr('ui.settings.tab.transitions') },
      { id: 'jobstatuses', label: tr('ui.settings.tab.jobStatuses') },
      { id: 'about', label: tr('ui.settings.tab.about') },
    ]}
    bind:active={tab}
    label={tr('ui.settings.tabs')}
  />

  <div class="stack-lg" role="tabpanel" data-ui="settings.panel" id="panel-{tab}" aria-labelledby="tab-{tab}">
  {#if tab === 'general'}
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

  <Card ui="settings.appearance">
    <h2>{tr('ui.settings.appearance')}</h2>
    <Field label={tr('ui.settings.theme')} for="set-ui-theme">
      <select id="set-ui-theme" class="input" bind:value={uiTheme}>
        <option value="system">{tr('ui.theme.system')}</option>
        <option value="light">{tr('ui.theme.light')}</option>
        <option value="dark">{tr('ui.theme.dark')}</option>
      </select>
    </Field>
    <div><Button variant="primary" ui="settings.appearance.save" onclick={saveTheme}>{tr('ui.save')}</Button></div>
  </Card>

  <Card ui="settings.notices">
    <h2>{tr('ui.settings.notices')}</h2>
    <label class="check"><input type="checkbox" bind:checked={resultNotices} />{tr('ui.settings.resultNotices')}</label>
    <p class="muted small">{tr('ui.settings.resultNoticesHint')}</p>
    <div><Button variant="primary" ui="settings.notices.save" onclick={saveNotices}>{tr('ui.save')}</Button></div>
  </Card>

  {:else if tab === 'documents'}
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

  {:else if tab === 'experience'}
  <Card ui="settings.experience">
    <h2>{tr('ui.settings.experience')}</h2>
    <p class="muted small">{tr('ui.settings.experienceHint')}</p>
    <Field label={tr('ui.settings.experience')} for="set-experience">
      <textarea id="set-experience" class="input" rows="14" maxlength="40000" bind:value={experience}></textarea>
    </Field>
    <div><Button variant="primary" ui="settings.experience.save" onclick={saveExperience}>{tr('ui.save')}</Button></div>
  </Card>
  {:else if tab === 'prompts'}
  <Card ui="settings.prompts">
    <h2>{tr('ui.settings.prompts')}</h2>
    <p class="muted small">{tr('ui.settings.promptsHint')}</p>
    {#each PROMPT_TYPES as type (type)}
      <Field label={promptLabel(type)} for="set-prompt-{type}">
        <textarea id="set-prompt-{type}" class="input" rows="9" maxlength="10000" bind:value={prompts[type]}></textarea>
      </Field>
      <p class="muted small">{tr('ui.settings.promptPlaceholders')} {#each PROMPT_PLACEHOLDERS[type] as name (name)}<code>{'{{' + name + '}}'}</code>{' '}{/each}</p>
    {/each}
    <div class="actions">
      <Button variant="primary" ui="settings.prompts.save" onclick={savePrompts}>{tr('ui.save')}</Button>
      <Button variant="ghost" ui="settings.prompts.reset" onclick={resetPrompts}>{tr('ui.settings.promptsReset')}</Button>
    </div>
  </Card>
  {:else if tab === 'availability'}
  <Card ui="settings.availability">
    <h2>{tr('ui.settings.availability')}</h2>
    <p class="muted small">{tr('ui.settings.availabilityHint')}</p>
    <label class="check"><input type="checkbox" bind:checked={checkEnabled} />{tr('ui.settings.availabilityEnabled')}</label>
    <Field label={tr('ui.settings.availabilityHours')} for="set-check-hours">
      <input id="set-check-hours" class="input" inputmode="numeric" bind:value={checkHours} />
    </Field>
    <p class="muted small">{tr('ui.settings.availabilityHoursHint', { zone: app.timeZone })}</p>
    <fieldset class="checks">
      <legend>{tr('ui.settings.availabilityRules')}</legend>
      {#each OFFLINE_RULES as rule (rule)}
        <label class="check"><input type="checkbox" value={rule} bind:group={immediateRules} />{tr(`ui.availability.rule.${rule}`)}</label>
      {/each}
    </fieldset>
    <p class="muted small">{tr('ui.settings.availabilityRulesHint')}</p>
    <Field label={tr('ui.settings.offlineTexts')} for="set-offline-texts">
      <textarea id="set-offline-texts" class="input" rows="5" bind:value={offlineTexts}></textarea>
    </Field>
    <div><Button variant="primary" ui="settings.availability.save" onclick={saveAvailability}>{tr('ui.save')}</Button></div>
  </Card>
  {:else if tab === 'profile'}
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

  {:else if tab === 'templates'}
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

  {:else if tab === 'statuslabels'}
  <Card ui="settings.status-labels">
    <h2>{tr('ui.settings.statusLabels')}</h2>
    <p class="muted small">{tr('ui.settings.statusLabelsHint')}</p>
    <StatusStylesEditor />
  </Card>

  {:else if tab === 'transitions'}
  <Card ui="settings.transitions">
    <h2>{tr('ui.settings.transitions')}</h2>
    <p class="muted small">{tr('ui.settings.transitionsHint')}</p>
    <TransitionsEditor />
  </Card>

  {:else if tab === 'jobstatuses'}
  <Card ui="settings.job-statuses">
    <h2>{tr('ui.settings.jobStatuses')}</h2>
    <p class="muted small">{tr('ui.settings.jobStatusesHint')}</p>
    <JobStatusStylesEditor />
  </Card>

  {:else}
  <Card ui="settings.about">
    <h2>{tr('ui.settings.about')}</h2>
    <p>JobHunters</p>
    <p class="muted">{tr('ui.settings.version', { version: app.version })}</p>
    <label class="check" data-ui="settings.show-ids">
      <input type="checkbox" checked={ids.visible} onchange={(event) => setIdsVisible(event.currentTarget.checked)} />{tr('ui.settings.showIds')}
    </label>
    <p class="muted small">{tr('ui.settings.showIdsHint')}</p>
  </Card>
  {/if}
  </div>
</div>

<style>
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-3); }
  .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .checks { display: flex; flex-direction: column; gap: var(--space-1); padding: 0; margin: 0; border: 0; }
  legend { padding: 0; margin-bottom: var(--space-2); font-weight: 600; font-size: var(--text-s); }
  .check { display: flex; align-items: center; gap: var(--space-2); min-height: var(--tap); }
  code { padding: 1px var(--space-1); background: var(--surface-2); border-radius: var(--radius-s); }
</style>
