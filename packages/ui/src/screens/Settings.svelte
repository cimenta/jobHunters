<script lang="ts">
  import { tick } from 'svelte';
  import { EXPERIENCE_MAX, OFFLINE_RULES, parseRefreshSeconds, PROFILE_KEYS, PROMPT_MAX, PROMPT_PLACEHOLDERS, PROMPT_TYPES, PROMPTS_VERSION, SETTINGS_DEFAULTS, STATUS_TEXT_MAX, type PromptType } from '@jobhunters/core';
  import { api } from '../api';
  import Button from '../components/Button.svelte';
  import Card from '../components/Card.svelte';
  import Dialog from '../components/Dialog.svelte';
  import ErrorBlock from '../components/ErrorBlock.svelte';
  import Field from '../components/Field.svelte';
  import HelpTip from '../components/HelpTip.svelte';
  import HistoryButton from '../components/HistoryButton.svelte';
  import Tabs from '../components/Tabs.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import { tr } from '../lib/i18n.svelte';
  import { documentTypeLabel } from '../lib/labels';
  import { useResource } from '../lib/resource.svelte';
  import type { SetupResult } from '../api/types';
  import { app, promptsOutdated, reloadSettings, reloadSetupStatus } from '../state/app.svelte';
  import { ids, setIdsVisible } from '../state/ids.svelte';
  import { invalidate } from '../state/invalidate.svelte';
  import { toast } from '../state/toast.svelte';
  import JobStatusStylesEditor from './JobStatusStylesEditor.svelte';
  import StatusStylesEditor from './StatusStylesEditor.svelte';
  import TransitionsEditor from './TransitionsEditor.svelte';

  /** The order of the prompt tabs; the tab names are short, the full name stays on the text field. */
  const PROMPT_TAB_ORDER: PromptType[] = ['resume_tailor', 'cover_letter', 'answer_question', 'match_job', 'other', 'import_job', 'import_match_job'];
  const DOCUMENT_TYPES = ['resume', 'cover_letter', 'other'] as const;
  const PLACEHOLDERS = ['{{name}}', '{{email}}', '{{phone}}', '{{address}}', '{{portfolio}}', '{{linkedin}}', '{{github}}', '{{website}}', '{{links}}', '{{company}}', '{{position}}', '{{location}}', '{{date}}', '{{body}}'];

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
      case 'portfolio':
        return tr('ui.profile.portfolio');
      case 'linkedin':
        return tr('ui.profile.linkedin');
      case 'github':
        return tr('ui.profile.github');
      case 'website':
        return tr('ui.profile.website');
      case 'links':
        return tr('ui.profile.links');
    }
  }

  const profile = useResource(() => api.getProfile());
  const templates = useResource(() => api.listTemplates());

  let tab = $state('general');
  let statusesTab = $state('statuses.jobs');
  let applicationStatusesTab = $state('statuses.applications.labels');
  let promptTab = $state('prompts.resume_tailor');
  let experience = $state('');
  let historyRevision = $state(0);
  let historyMax = $state('50');
  let historyMaxError = $state('');
  let prompts = $state<Record<PromptType, string>>({ resume_tailor: '', cover_letter: '', other: '', answer_question: '', match_job: '', import_job: '', import_match_job: '' });
  let checkEnabled = $state(false);
  let checkHours = $state('18');
  let immediateRules = $state<string[]>([]);
  let offlineTexts = $state('');
  let uiLanguage = $state('en');
  let uiTheme = $state('system');
  let resultNotices = $state(true);
  let menuNormal = $state('60');
  let menuBusy = $state('15');
  let menuNormalError = $state('');
  let menuBusyError = $state('');
  let docLanguage = $state('en');
  let documentSet = $state<string[]>([]);
  let profileValues = $state<Record<string, string>>({ name: '', email: '', phone: '', address: '', portfolio: '', linkedin: '', github: '', website: '', links: '' });
  let templateType = $state('resume');
  let templateLanguage = $state('');
  let templateName = $state('');
  let templateUrl = $state('');
  let setupResult = $state<SetupResult | undefined>();

  $effect(() => {
    const settings = app.settings;
    if (settings) {
      uiLanguage = settings.ui_language;
      uiTheme = settings.ui_theme;
      resultNotices = settings.result_notices;
      experience = settings.candidate_experience;
      historyMax = String(settings.history_max_versions);
      historyMaxError = '';
      checkEnabled = settings.availability_check_enabled;
      checkHours = settings.availability_check_hours.join(', ');
      immediateRules = [...settings.availability_immediate_rules];
      offlineTexts = settings.offline_texts.join('\n');
      prompts = Object.fromEntries(PROMPT_TYPES.map((type) => [type, settings[`ai_prompt_${type}`]])) as Record<PromptType, string>;
      menuNormalError = '';
      menuBusyError = '';
      menuNormal = String(settings.menu_refresh_seconds);
      menuBusy = String(settings.menu_refresh_busy_seconds);
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

  async function saveMenuRefresh(): Promise<void> {
    const normal = parseRefreshSeconds(String(menuNormal).trim());
    const busy = parseRefreshSeconds(String(menuBusy).trim());
    menuNormalError = normal === undefined ? tr('ui.settings.menuRefreshInvalid') : '';
    menuBusyError = busy === undefined ? tr('ui.settings.menuRefreshInvalid') : '';
    if (normal === undefined || busy === undefined) return;
    await api.updateSettings({ menu_refresh_seconds: String(normal), menu_refresh_busy_seconds: String(busy) });
    await reloadSettings();
    const key =
      normal === 0 && busy === 0
        ? 'ui.settings.savedMenuRefreshOff'
        : busy === 0
          ? 'ui.settings.savedMenuRefreshBusyOff'
          : normal === 0
            ? 'ui.settings.savedMenuRefreshNormalOff'
            : 'ui.settings.savedMenuRefresh';
    toast.success(tr(key, { normal, busy }));
  }

  async function saveExperience(): Promise<void> {
    await api.updateSettings({ candidate_experience: experience });
    await reloadSettings();
    historyRevision += 1;
    toast.success(tr('ui.settings.savedExperience'));
  }

  async function saveHistoryMax(): Promise<void> {
    const text = String(historyMax).trim();
    const valid = /^\d{1,4}$/.test(text) && Number(text) >= 1 && Number(text) <= 1000;
    historyMaxError = valid ? '' : tr('ui.settings.historyMaxInvalid');
    if (!valid) return;
    await api.updateSettings({ history_max_versions: text });
    await reloadSettings();
    toast.success(tr('ui.settings.savedHistoryMax'));
  }

  async function savePrompts(): Promise<void> {
    await api.updateSettings(Object.fromEntries(PROMPT_TYPES.map((type) => [`ai_prompt_${type}`, prompts[type]])));
    await reloadSettings();
    historyRevision += 1;
    toast.success(tr('ui.settings.savedPrompts'));
  }

  async function resetPrompts(): Promise<void> {
    await api.resetPrompts();
    await reloadSettings();
    historyRevision += 1;
    toast.success(tr('ui.settings.resetPrompts'));
  }

  /** After Use This on one prompt: take that prompt from the settings and keep what is typed in the others and not saved yet. */
  async function restorePrompt(type: PromptType): Promise<void> {
    const keep = { ...prompts };
    await reloadSettings();
    await tick();
    if (app.settings) prompts = { ...keep, [type]: app.settings[`ai_prompt_${type}`] };
    historyRevision += 1;
  }

  /** The user keeps their own prompts: the notice about the new defaults is taken as read. */
  async function keepPrompts(): Promise<void> {
    await api.updateSettings({ ai_prompts_version: String(PROMPTS_VERSION) });
    await reloadSettings();
    toast.success(tr('ui.settings.promptsKept'));
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
      case 'import_job':
        return tr('ui.settings.promptImport');
      case 'import_match_job':
        return tr('ui.settings.promptImportMatch');
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
    historyRevision += 1;
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

  async function runSetup(): Promise<void> {
    setupResult = await api.runSetup();
    await reloadSetupStatus();
    if (setupResult.ok) invalidate();
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
      { id: 'general', label: tr('ui.settings.tab.general'), alert: app.setupNeeded },
      { id: 'documents', label: tr('ui.settings.tab.documents') },
      { id: 'experience', label: tr('ui.settings.tab.experience') },
      { id: 'prompts', label: tr('ui.settings.tab.prompts'), alert: promptsOutdated() },
      { id: 'availability', label: tr('ui.settings.tab.availability') },
      { id: 'profile', label: tr('ui.settings.tab.profile') },
      { id: 'templates', label: tr('ui.settings.tab.templates') },
      { id: 'statuses', label: tr('ui.settings.tab.statuses') },
      { id: 'about', label: tr('ui.settings.tab.about') },
    ]}
    bind:active={tab}
    label={tr('ui.settings.tabs')}
  />

  <div class="stack-lg" role="tabpanel" data-ui="settings.panel" id="panel-{tab}" aria-labelledby="tab-{tab}">
  {#if tab === 'general'}
  <div class="general-grid" data-ui="settings.general.grid">
  <Card ui="settings.language">
    <h2>{tr('ui.settings.language')}</h2>
    <Field label={tr('ui.settings.uiLanguage')} for="set-ui-language">
      <select data-ui="settings.ui-language" id="set-ui-language" class="input" bind:value={uiLanguage}>
        <option value="en">{tr('ui.language.en')}</option>
        <option value="cs">{tr('ui.language.cs')}</option>
      </select>
    </Field>
    <Field label={tr('ui.settings.docLanguage')} for="set-doc-language">
      <select data-ui="settings.doc-language" id="set-doc-language" class="input" bind:value={docLanguage}>
        <option value="en">{tr('ui.language.en')}</option>
        <option value="cs">{tr('ui.language.cs')}</option>
      </select>
    </Field>
    <div><Button variant="primary" ui="settings.language.save" onclick={saveLanguage}>{tr('ui.save')}</Button></div>
  </Card>

  <Card ui="settings.appearance">
    <h2>{tr('ui.settings.appearance')}</h2>
    <Field label={tr('ui.settings.theme')} for="set-ui-theme">
      <select data-ui="settings.theme" id="set-ui-theme" class="input" bind:value={uiTheme}>
        <option value="system">{tr('ui.theme.system')}</option>
        <option value="light">{tr('ui.theme.light')}</option>
        <option value="dark">{tr('ui.theme.dark')}</option>
      </select>
    </Field>
    <div><Button variant="primary" ui="settings.appearance.save" onclick={saveTheme}>{tr('ui.save')}</Button></div>
  </Card>

  <Card ui="settings.notices">
    <div class="head">
      <h2>{tr('ui.settings.notices')}</h2>
      <HelpTip ui="settings.help.notices" label={tr('ui.settings.notices')} text={tr('ui.settings.tip.notices')} />
    </div>
    <label class="check"><input data-ui="settings.result-notices" type="checkbox" bind:checked={resultNotices} />{tr('ui.settings.resultNotices')}</label>
    <div><Button variant="primary" ui="settings.notices.save" onclick={saveNotices}>{tr('ui.save')}</Button></div>
  </Card>

  <Card ui="settings.menu-refresh">
    <div class="head">
      <h2>{tr('ui.settings.menuRefresh')}</h2>
      <HelpTip ui="settings.help.menu-refresh" label={tr('ui.settings.menuRefresh')} text={tr('ui.settings.tip.menuRefresh', { normal: SETTINGS_DEFAULTS.menu_refresh_seconds, busy: SETTINGS_DEFAULTS.menu_refresh_busy_seconds })} />
    </div>
    <Field label={tr('ui.settings.menuRefreshNormal')} for="set-menu-normal" error={menuNormalError}>
      <input data-ui="settings.menu-refresh.normal" id="set-menu-normal" class="input" type="number" min="0" max="3600" step="1" inputmode="numeric" bind:value={menuNormal} oninput={() => { menuNormalError = ''; menuBusyError = ''; }} />
    </Field>
    <Field label={tr('ui.settings.menuRefreshBusy')} for="set-menu-busy" error={menuBusyError}>
      <input data-ui="settings.menu-refresh.busy" id="set-menu-busy" class="input" type="number" min="0" max="3600" step="1" inputmode="numeric" bind:value={menuBusy} oninput={() => { menuNormalError = ''; menuBusyError = ''; }} />
    </Field>
    <div><Button variant="primary" ui="settings.menu-refresh.save" onclick={saveMenuRefresh}>{tr('ui.save')}</Button></div>
  </Card>

  <Card ui="settings.history">
    <div class="head">
      <h2>{tr('ui.settings.history')}</h2>
      <HelpTip ui="settings.help.history" label={tr('ui.settings.history')} text={tr('ui.settings.tip.history', { default: SETTINGS_DEFAULTS.history_max_versions })} />
    </div>
    <Field label={tr('ui.settings.historyMax')} for="set-history-max" error={historyMaxError}>
      <input data-ui="settings.history.max" id="set-history-max" class="input" type="number" min="1" max="1000" step="1" inputmode="numeric" bind:value={historyMax} oninput={() => (historyMaxError = '')} />
    </Field>
    <div><Button variant="primary" ui="settings.history.save" onclick={saveHistoryMax}>{tr('ui.save')}</Button></div>
  </Card>

  <Card ui="settings.setup">
    <div class="head">
      <h2>{tr('ui.settings.setup')}</h2>
      <HelpTip ui="settings.help.setup" label={tr('ui.settings.setup')} text={tr('ui.settings.tip.setup')} />
      {#if app.setupNeeded}
        <span class="needed" data-ui="settings.setup.needed" role="img" aria-label={tr('ui.settings.setupNeeded')} title={[tr('ui.settings.setupNeeded'), ...app.setupReasons].join('\n')}>!</span>
      {/if}
    </div>
    {#if app.setupNeeded && app.setupReasons.length > 0}
      <ul class="reasons small" data-ui="settings.setup.reasons">
        {#each app.setupReasons as reason (reason)}<li>{reason}</li>{/each}
      </ul>
    {/if}
    <div><Button ui="settings.setup.run" onclick={runSetup}>{tr('ui.settings.setupRun')}</Button></div>
  </Card>
  </div>
  <Dialog open={setupResult !== undefined} title={tr('ui.settings.setupResultTitle')} ui="settings.setup-result" onclose={() => (setupResult = undefined)}>
    {#if setupResult}
      <p class={setupResult.ok ? 'ok' : 'warn'} data-ui="settings.setup-result.verdict">{tr(setupResult.ok ? 'ui.settings.setupOk' : 'ui.settings.setupFailed')}</p>
      <pre class="setup-log" data-ui="settings.setup-result.log">{setupResult.lines.join('\n')}</pre>
    {/if}
    {#snippet footer()}
      <Button variant="primary" ui="settings.setup-result.done" onclick={() => (setupResult = undefined)}>{tr('ui.settings.setupClose')}</Button>
    {/snippet}
  </Dialog>


  {:else if tab === 'documents'}
  <Card ui="settings.documents">
    <div class="head">
      <h2>{tr('ui.settings.documents')}</h2>
      <HelpTip ui="settings.help.documents" label={tr('ui.settings.documents')} text={tr('ui.settings.tip.documents')} />
    </div>
    <fieldset class="checks">
      <legend>{tr('ui.settings.documentSet')}</legend>
      {#each DOCUMENT_TYPES as type (type)}
        <label class="check"><input data-ui="settings.document.{type}" type="checkbox" value={type} bind:group={documentSet} />{documentTypeLabel(type)}</label>
      {/each}
    </fieldset>
    <div><Button variant="primary" ui="settings.documents.save" onclick={saveDocuments}>{tr('ui.save')}</Button></div>
  </Card>

  {:else if tab === 'experience'}
  <Card ui="settings.experience">
    <div class="head">
      <h2>{tr('ui.settings.experience')}</h2>
      <HelpTip ui="settings.help.experience" label={tr('ui.settings.experience')} text={tr('ui.settings.tip.experience', { max: EXPERIENCE_MAX })} />
    </div>
    <p class="muted small">{tr('ui.settings.experienceHint')}</p>
    <Field label={tr('ui.settings.experience')} for="set-experience">
      <textarea data-ui="settings.experience.text" id="set-experience" class="input" rows="14" maxlength={EXPERIENCE_MAX} bind:value={experience}></textarea>
    </Field>
    <div class="actions">
      <Button variant="primary" ui="settings.experience.save" onclick={saveExperience}>{tr('ui.save')}</Button>
      <HistoryButton historyKey="candidate_experience" name={tr('ui.settings.experience')} ui="settings.experience.history" refreshKey={historyRevision} onrestored={reloadSettings} />
    </div>
  </Card>
  {:else if tab === 'prompts'}
  <Card ui="settings.prompts">
    <div class="head">
      <h2>{tr('ui.settings.prompts')}</h2>
      <HelpTip ui="settings.help.prompts" label={tr('ui.settings.prompts')} text={tr('ui.settings.tip.prompts', { max: PROMPT_MAX })} />
    </div>
    {#if promptsOutdated()}
      <div class="attention" role="alert" data-ui="settings.prompts.update">
        <p><strong>{tr('ui.settings.promptsUpdateTitle')}</strong> {tr('ui.settings.promptsUpdateText')}</p>
        <div class="actions">
          <Button variant="primary" ui="settings.prompts.update.reset" onclick={resetPrompts}>{tr('ui.settings.promptsReset')}</Button>
          <Button ui="settings.prompts.update.keep" onclick={keepPrompts}>{tr('ui.settings.promptsKeep')}</Button>
        </div>
      </div>
    {/if}
    <p class="muted small">{tr('ui.settings.promptsHint')}</p>
    <Tabs
      items={PROMPT_TAB_ORDER.map((type) => ({ id: `prompts.${type}`, label: tr(`ui.settings.promptTab.${type}`) }))}
      bind:active={promptTab}
      label={tr('ui.settings.promptTabs')}
      ui="settings.prompts.tabs"
    />
    <div class="stack" role="tabpanel" data-ui="settings.prompts.panel" id="panel-{promptTab}" aria-labelledby="tab-{promptTab}">
      {#each PROMPT_TYPES.filter((type) => `prompts.${type}` === promptTab) as type (type)}
        <Field label={promptLabel(type)} for="set-prompt-{type}">
          <textarea data-ui="settings.prompt.{type}" id="set-prompt-{type}" class="input" rows="14" maxlength={PROMPT_MAX} bind:value={prompts[type]}></textarea>
        </Field>
        <p class="muted small">{tr('ui.settings.promptPlaceholders')} {#each PROMPT_PLACEHOLDERS[type] as name (name)}<code>{'{{' + name + '}}'}</code>{' '}{/each}</p>
      {/each}
    </div>
    <div class="actions">
      <Button variant="primary" ui="settings.prompts.save" onclick={savePrompts}>{tr('ui.save')}</Button>
      <Button variant="ghost" ui="settings.prompts.reset" onclick={resetPrompts}>{tr('ui.settings.promptsReset')}</Button>
      {#each PROMPT_TYPES.filter((type) => `prompts.${type}` === promptTab) as type (type)}
        <HistoryButton historyKey={`ai_prompt_${type}`} name={promptLabel(type)} ui="settings.prompt.{type}.history" refreshKey={historyRevision} onrestored={() => restorePrompt(type)} />
      {/each}
    </div>
  </Card>
  {:else if tab === 'availability'}
  <Card ui="settings.availability">
    <div class="head">
      <h2>{tr('ui.settings.availability')}</h2>
      <HelpTip ui="settings.help.availability" label={tr('ui.settings.availability')} text={tr('ui.settings.tip.availability', { zone: app.timeZone })} />
    </div>
    <p class="muted small">{tr('ui.settings.availabilityHint')}</p>
    <label class="check"><input data-ui="settings.check-enabled" type="checkbox" bind:checked={checkEnabled} />{tr('ui.settings.availabilityEnabled')}</label>
    <Field label={tr('ui.settings.availabilityHours')} for="set-check-hours">
      <input data-ui="settings.check-hours" id="set-check-hours" class="input" inputmode="numeric" bind:value={checkHours} />
    </Field>
    <p class="muted small">{tr('ui.settings.availabilityHoursHint', { zone: app.timeZone })}</p>
    <fieldset class="checks">
      <legend>{tr('ui.settings.availabilityRules')}</legend>
      {#each OFFLINE_RULES as rule (rule)}
        <label class="check"><input data-ui="settings.immediate-rule.{rule}" type="checkbox" value={rule} bind:group={immediateRules} />{tr(`ui.availability.rule.${rule}`)}</label>
      {/each}
    </fieldset>
    <p class="muted small">{tr('ui.settings.availabilityRulesHint')}</p>
    <Field label={tr('ui.settings.offlineTexts')} for="set-offline-texts">
      <textarea data-ui="settings.offline-texts" id="set-offline-texts" class="input" rows="5" bind:value={offlineTexts}></textarea>
    </Field>
    <div class="actions">
      <Button variant="primary" ui="settings.availability.save" onclick={saveAvailability}>{tr('ui.save')}</Button>
      <HistoryButton historyKey="offline_texts" name={tr('ui.settings.offlineTexts')} ui="settings.offline-texts.history" refreshKey={historyRevision} onrestored={reloadSettings} />
    </div>
  </Card>
  {:else if tab === 'profile'}
  <Card ui="settings.profile">
    <div class="head">
      <h2>{tr('ui.settings.profile')}</h2>
      <HelpTip ui="settings.help.profile-links" label={tr('ui.settings.profile')} text={tr('ui.settings.tip.profileLinks')} />
    </div>
    <p class="muted small">{tr('ui.settings.profileHint')}</p>
    {#if profile.status === 'error'}
      <ErrorBlock error={profile.error} onretry={invalidate} />
    {:else if profile.status === 'loading'}
      <Skeleton lines={4} />
    {:else}
      <div class="grid">
        {#each PROFILE_KEYS as key (key)}
          <Field label={profileLabel(key)} for="profile-{key}"><input data-ui="settings.profile.{key}" id="profile-{key}" class="input" bind:value={profileValues[key]} /></Field>
        {/each}
      </div>
      <div><Button variant="primary" ui="settings.profile.save" onclick={saveProfile}>{tr('ui.save')}</Button></div>
    {/if}
  </Card>

  {:else if tab === 'templates'}
  <Card ui="settings.templates">
    <div class="head">
      <h2>{tr('ui.settings.templates')}</h2>
      <HelpTip ui="settings.help.templates" label={tr('ui.settings.templates')} text={tr('ui.settings.tip.templates')} />
    </div>
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
            <a data-ui="settings.template.{template.id}.link" href={template.doc_url} target="_blank" rel="noopener noreferrer">{tr('ui.open')}</a>
          </li>
        {/each}
      </ul>
    {/if}
    <div class="grid">
      <Field label={tr('ui.template.type')} for="template-type">
        <select data-ui="settings.template-type" id="template-type" class="input" bind:value={templateType}>
          {#each DOCUMENT_TYPES as type (type)}<option value={type}>{documentTypeLabel(type)}</option>{/each}
        </select>
      </Field>
      <Field label={tr('ui.template.language')} for="template-language">
        <select data-ui="settings.template-language" id="template-language" class="input" bind:value={templateLanguage}>
          <option value="">{tr('ui.template.allLanguages')}</option>
          <option value="en">{tr('ui.language.en')}</option>
          <option value="cs">{tr('ui.language.cs')}</option>
        </select>
      </Field>
      <Field label={tr('ui.template.name')} for="template-name"><input data-ui="settings.template-name" id="template-name" class="input" bind:value={templateName} /></Field>
      <Field label={tr('ui.template.url')} for="template-url"><input data-ui="settings.template-url" id="template-url" class="input" inputmode="url" bind:value={templateUrl} /></Field>
    </div>
    <div><Button variant="primary" ui="settings.templates.add" onclick={addTemplate}>{tr('ui.template.add')}</Button></div>
  </Card>

  {:else if tab === 'statuses'}
  <Tabs
    items={[
      { id: 'statuses.jobs', label: tr('ui.settings.tab.statusesJobs') },
      { id: 'statuses.applications', label: tr('ui.settings.tab.statusesApplications') },
    ]}
    bind:active={statusesTab}
    label={tr('ui.settings.statusesTabs')}
    ui="settings.statuses.tabs"
  />
  <div class="stack-lg" role="tabpanel" data-ui="settings.statuses.panel" id="panel-{statusesTab}" aria-labelledby="tab-{statusesTab}">
  {#if statusesTab === 'statuses.jobs'}
  <Card ui="settings.job-statuses">
    <div class="head">
      <h2>{tr('ui.settings.jobStatuses')}</h2>
      <HelpTip ui="settings.help.job-statuses" label={tr('ui.settings.jobStatuses')} text={tr('ui.settings.tip.jobStatuses')} />
    </div>
    <p class="muted small">{tr('ui.settings.jobStatusesHint')}</p>
    <JobStatusStylesEditor />
  </Card>
  {:else}
  <Tabs
    items={[
      { id: 'statuses.applications.labels', label: tr('ui.settings.tab.statusesLabels') },
      { id: 'statuses.applications.transitions', label: tr('ui.settings.tab.statusesTransitions') },
    ]}
    bind:active={applicationStatusesTab}
    label={tr('ui.settings.applicationStatusesTabs')}
    ui="settings.statuses.applications.tabs"
  />
  <div class="stack-lg" role="tabpanel" data-ui="settings.statuses.applications.panel" id="panel-{applicationStatusesTab}" aria-labelledby="tab-{applicationStatusesTab}">
  {#if applicationStatusesTab === 'statuses.applications.labels'}
  <Card ui="settings.status-labels">
    <div class="head">
      <h2>{tr('ui.settings.statusLabels')}</h2>
      <HelpTip ui="settings.help.status-labels" label={tr('ui.settings.statusLabels')} text={tr('ui.settings.tip.statusLabels', { max: STATUS_TEXT_MAX })} />
    </div>
    <p class="muted small">{tr('ui.settings.statusLabelsHint')}</p>
    <StatusStylesEditor />
  </Card>
  {:else}
  <Card ui="settings.transitions">
    <div class="head">
      <h2>{tr('ui.settings.transitions')}</h2>
      <HelpTip ui="settings.help.transitions" label={tr('ui.settings.transitions')} text={tr('ui.settings.tip.transitions')} />
    </div>
    <p class="muted small">{tr('ui.settings.transitionsHint')}</p>
    <TransitionsEditor />
  </Card>
  {/if}
  </div>
  {/if}
  </div>

  {:else}
  <Card ui="settings.about">
    <h2>{tr('ui.settings.about')}</h2>
    <p>JobHunters</p>
    <p class="muted">{tr('ui.settings.version', { version: app.version })}</p>
    <label class="check" data-ui="settings.show-ids">
      <input data-ui="settings.show-ids-toggle" type="checkbox" checked={ids.visible} onchange={(event) => setIdsVisible(event.currentTarget.checked)} />{tr('ui.settings.showIds')}
    </label>
    <p class="muted small">{tr('ui.settings.showIdsHint')}</p>
  </Card>
  {/if}
  </div>
</div>

<style>
  /* Columns, not a grid: the cards stack under each other without gaps from rows of different heights. */
  .general-grid { columns: 260px; column-gap: var(--space-2); }
  .general-grid :global(.card) { gap: var(--space-2); padding: var(--space-3); margin-bottom: var(--space-2); break-inside: avoid; }
  .general-grid :global(h2) { font-size: var(--text-m); margin: 0; }
  .reasons { margin: 0; padding-left: var(--space-4); color: var(--danger); }
  .attention { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-3); color: var(--text); background: var(--danger-soft); border: 1px solid var(--danger); border-radius: var(--radius-s); }
  .attention p { margin: 0; }
  .attention strong { color: var(--danger); }
  .head { display: flex; align-items: center; gap: var(--space-2); }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-3); }
  .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .checks { display: flex; flex-direction: column; gap: var(--space-1); padding: 0; margin: 0; border: 0; }
  legend { padding: 0; margin-bottom: var(--space-2); font-weight: 600; font-size: var(--text-s); }
  .check { display: flex; align-items: center; gap: var(--space-2); min-height: var(--tap); }
  .needed { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; color: #fff; background: var(--danger); border-radius: 50%; font-size: var(--text-s); font-weight: 800; cursor: help; }
  .ok, .warn { margin: 0; padding: var(--space-2) var(--space-3); border-radius: var(--radius-s); font-weight: 600; }
  .ok { color: var(--success); background: var(--success-soft); }
  .warn { color: var(--danger); background: var(--danger-soft); }
  .setup-log { margin: 0; padding: var(--space-2) var(--space-3); max-height: 260px; overflow: auto; font-size: var(--text-s); white-space: pre-wrap; overflow-wrap: anywhere; background: var(--surface-2); border-radius: var(--radius-s); }
  code { padding: 1px var(--space-1); background: var(--surface-2); border-radius: var(--radius-s); }
</style>
