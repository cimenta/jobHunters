<script lang="ts">
  import {
    checkEmailPatterns,
    cleanEmailLines,
    compileEmailRules,
    DEFAULT_EMAIL_RULES,
    EMAIL_RULE_CATEGORIES,
    effectiveEmailRules,
    parseEmail,
    serializeEmailRules,
    type EmailParse,
    type EmailRuleCategory,
    type EmailRules,
    type EmailRulesOverride,
  } from '@jobhunters/core';
  import { api } from '../api';
  import Button from '../components/Button.svelte';
  import Field from '../components/Field.svelte';
  import { tr } from '../lib/i18n.svelte';
  import { kindLabel } from '../lib/labels';
  import { app, reloadSettings } from '../state/app.svelte';
  import { toast } from '../state/toast.svelte';

  const toText = (lines: readonly string[]): string => lines.join('\n');
  const toLines = (text: string): string[] => cleanEmailLines(text.split(/\r?\n/));

  function fromSettings(): Record<EmailRuleCategory, string> {
    const rules = effectiveEmailRules(app.settings?.email_rules);
    return Object.fromEntries(EMAIL_RULE_CATEGORIES.map((category) => [category, toText(rules[category])])) as Record<EmailRuleCategory, string>;
  }

  /** The category shown in the editor; the others keep their text while it is not shown. */
  let selected = $state<EmailRuleCategory>(EMAIL_RULE_CATEGORIES[0]);
  let drafts = $state<Record<EmailRuleCategory, string>>(fromSettings());
  let errors = $state<Partial<Record<EmailRuleCategory, string>>>({});

  // Follows the saved settings, so a saved change refreshes the form.
  $effect(() => {
    drafts = fromSettings();
    errors = {};
  });

  const isDefault = (category: EmailRuleCategory): boolean => toText(toLines(drafts[category])) === toText(DEFAULT_EMAIL_RULES[category]);
  const regex = $derived(selected !== 'relay_domains');

  function draftRules(): EmailRules {
    return Object.fromEntries(EMAIL_RULE_CATEGORIES.map((category) => [category, toLines(drafts[category])])) as EmailRules;
  }

  /** The first problem of every category, by name; empty when all patterns compile. */
  function validate(): Partial<Record<EmailRuleCategory, string>> {
    const problems: Partial<Record<EmailRuleCategory, string>> = {};
    for (const category of EMAIL_RULE_CATEGORIES) {
      if (category === 'relay_domains') continue;
      const problem = checkEmailPatterns(toLines(drafts[category]));
      if (problem) problems[category] = tr('ui.emailRules.lineError', { line: problem.line, message: problem.message });
    }
    return problems;
  }

  async function save(): Promise<void> {
    errors = validate();
    const wrong = EMAIL_RULE_CATEGORIES.find((category) => errors[category] !== undefined);
    if (wrong !== undefined) {
      selected = wrong;
      return;
    }
    const rules = draftRules();
    const override: EmailRulesOverride = {};
    for (const category of EMAIL_RULE_CATEGORIES) if (!isDefault(category)) override[category] = rules[category];
    await api.updateSettings({ email_rules: serializeEmailRules(override) });
    await reloadSettings();
    toast.success(tr('ui.emailRules.saved'));
  }

  async function resetAll(): Promise<void> {
    await api.updateSettings({ email_rules: '{}' });
    await reloadSettings();
    toast.success(tr('ui.emailRules.resetDone'));
  }

  function resetCategory(): void {
    drafts[selected] = toText(DEFAULT_EMAIL_RULES[selected]);
    errors = { ...errors, [selected]: undefined };
  }

  const optionLabel = (category: EmailRuleCategory): string => `${tr(`ui.emailRules.cat.${category}`)}${isDefault(category) ? '' : ` • ${tr('ui.emailRules.changedMark')}`}`;

  // "Try it": the parser, with the rules as they are in the form (saved or not), on a text typed here. Nothing is saved.
  let trySubject = $state('');
  let tryBody = $state('');
  let tryDirection = $state('incoming');
  let tried = $state<EmailParse | 'invalid' | undefined>();

  function tryIt(): void {
    if (Object.keys(validate()).length > 0) {
      tried = 'invalid';
      return;
    }
    tried = parseEmail({ subject: trySubject, body: tryBody, direction: tryDirection, from_email: 'sender@example.invalid', from_name: '', is_bulk: false }, compileEmailRules(draftRules()));
  }
</script>

<div class="stack" data-ui="email-rules">
  <p class="muted small">{tr('ui.emailRules.intro')}</p>
  <p class="muted small" data-ui="email-rules.where">{tr('ui.emailRules.where')}</p>

  <Field label={tr('ui.emailRules.category')} for="rules-category">
    <select data-ui="email-rules.category" id="rules-category" class="input" bind:value={selected}>
      {#each EMAIL_RULE_CATEGORIES as category (category)}<option value={category}>{optionLabel(category)}</option>{/each}
    </select>
  </Field>

  <div class="rule" data-ui="email-rules.{selected}">
    <Field label={tr(`ui.emailRules.cat.${selected}`)} for="rules-text" hint={tr(`ui.emailRules.hint.${selected}`)} error={errors[selected]}>
      <textarea data-ui="email-rules.{selected}.text" id="rules-text" class="input mono" rows={regex ? 8 : 5} spellcheck="false" bind:value={drafts[selected]}></textarea>
    </Field>
    <div class="row wrap">
      {#if !isDefault(selected)}<span class="muted small" data-ui="email-rules.{selected}.custom">{tr('ui.emailRules.custom')}</span>{/if}
      <Button ui="email-rules.{selected}.reset" onclick={resetCategory}>{tr('ui.emailRules.resetCategory')}</Button>
    </div>
  </div>

  <div class="row wrap">
    <Button variant="primary" ui="email-rules.save" onclick={save}>{tr('ui.save')}</Button>
    <Button ui="email-rules.reset-all" onclick={resetAll}>{tr('ui.emailRules.resetAll')}</Button>
  </div>

  <div class="try stack" data-ui="email-rules.try">
    <h3>{tr('ui.emailRules.try')}</h3>
    <p class="muted small">{tr('ui.emailRules.tryHint')}</p>
    <Field label={tr('ui.emailRules.subject')} for="rules-try-subject"><input data-ui="email-rules.try.subject" id="rules-try-subject" class="input" bind:value={trySubject} /></Field>
    <Field label={tr('ui.emailRules.tryText')} for="rules-try-body"><textarea data-ui="email-rules.try.body" id="rules-try-body" class="input" rows="5" bind:value={tryBody}></textarea></Field>
    <Field label={tr('ui.emails.direction')} for="rules-try-direction">
      <select data-ui="email-rules.try.direction" id="rules-try-direction" class="input" bind:value={tryDirection}>
        <option value="incoming">{tr('ui.emails.dirIncoming')}</option>
        <option value="outgoing">{tr('ui.emails.dirOutgoing')}</option>
      </select>
    </Field>
    <div><Button variant="primary" ui="email-rules.try.run" onclick={tryIt}>{tr('ui.emailRules.tryButton')}</Button></div>
    {#if tried === 'invalid'}
      <p class="muted" data-ui="email-rules.try.result">{tr('ui.emailRules.tryInvalid')}</p>
    {:else if tried}
      <p data-ui="email-rules.try.result">
        {tr('ui.emailRules.tryResult', {
          type: tried.type,
          kind: tried.kind === undefined ? tr('ui.emailRules.nothing') : kindLabel(tried.kind),
          confidence: tried.confidence === 'high' ? tr('ui.emails.high') : tr('ui.emails.low'),
          rule: tried.signals.join(', '),
        })}
        {#if tried.statusHint}<br />{tr('ui.emailRules.tryStatus', { status: tried.statusHint })}{/if}
        {#if tried.meetingAt}<br />{tr('ui.emailRules.tryTime', { at: tried.meetingAt })}{/if}
        {#if tried.titleHints.length > 0 || tried.companyHints.length > 0}
          <br />{tr('ui.emailRules.tryNames', { titles: tried.titleHints.join('; ') || '-', companies: tried.companyHints.join('; ') || '-' })}
        {/if}
      </p>
    {/if}
  </div>
</div>

<style>
  .mono { font-family: var(--font-mono, ui-monospace, monospace); font-size: var(--text-s); }
  .rule { display: flex; flex-direction: column; gap: var(--space-1); }
  .try { padding-top: var(--space-3); border-top: 1px solid var(--border); }
</style>
