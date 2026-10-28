<script lang="ts">
  import { DEFAULT_EMAIL_MARK_ICONS, EMAIL_MARK_ICONS, EMAIL_MARK_KEYS, resolveEmailMark, type EmailMarkKey } from '@jobhunters/core';
  import Button from '../components/Button.svelte';
  import Icon, { type IconName } from '../components/Icon.svelte';
  import { markName } from '../lib/email-state';
  import { tr } from '../lib/i18n.svelte';
  import { saveUiState, uiState } from '../state/ui-state';
  import { toast } from '../state/toast.svelte';

  type Choices = Record<EmailMarkKey, { icon: string; color: string }>;

  /** What the picker shows for a mark that has no color of its own. */
  const NEUTRAL = '#6b7280';

  function fromState(): Choices {
    const saved = uiState().email_marks;
    return Object.fromEntries(EMAIL_MARK_KEYS.map((key) => [key, { icon: saved[key]?.icon ?? '', color: saved[key]?.color ?? '' }])) as Choices;
  }

  let choices = $state<Choices>(fromState());

  // Follows the saved choice, so a saved change refreshes the form.
  $effect(() => {
    choices = fromState();
  });

  const shown = (key: EmailMarkKey): { icon: IconName; color: string } => resolveEmailMark({ [key]: choices[key] }, key) as { icon: IconName; color: string };

  function save(): void {
    const marks = Object.fromEntries(EMAIL_MARK_KEYS.filter((key) => choices[key].icon !== '' || choices[key].color !== '').map((key) => [key, { ...choices[key] }]));
    saveUiState({ email_marks: marks });
    toast.success(tr('ui.emailMarks.saved'));
  }

  function resetAll(): void {
    saveUiState({ email_marks: {} });
    toast.success(tr('ui.emailMarks.resetDone'));
  }
</script>

<div class="stack" data-ui="email-marks">
  <p class="muted small">{tr('ui.emailMarks.intro')}</p>
  {#each EMAIL_MARK_KEYS as key (key)}
    {@const look = shown(key)}
    <div class="mark-row" data-ui="email-marks.{key}">
      <span class="sample" class:custom={look.color !== ''} style:--mark-color={look.color || undefined} data-ui="email-marks.{key}.sample"><Icon name={look.icon} size={16} /></span>
      <span class="name">{markName(key)}</span>
      <select class="input" data-ui="email-marks.{key}.icon" aria-label={tr('ui.emailMarks.icon', { name: markName(key) })} bind:value={choices[key].icon}>
        <option value="">{tr('ui.emailMarks.default', { icon: tr(`ui.icon.${DEFAULT_EMAIL_MARK_ICONS[key]}`) })}</option>
        {#each EMAIL_MARK_ICONS as icon (icon)}<option value={icon}>{tr(`ui.icon.${icon}`)}</option>{/each}
      </select>
      <input
        type="color"
        data-ui="email-marks.{key}.color"
        aria-label={tr('ui.emailMarks.color', { name: markName(key) })}
        value={choices[key].color || NEUTRAL}
        oninput={(event) => (choices[key].color = event.currentTarget.value)}
      />
      <Button variant="ghost" ui="email-marks.{key}.reset-color" onclick={() => (choices[key].color = '')}>{tr('ui.emailMarks.themeColor')}</Button>
    </div>
  {/each}
  <div class="row wrap">
    <Button variant="primary" ui="email-marks.save" onclick={save}>{tr('ui.save')}</Button>
    <Button ui="email-marks.reset-all" onclick={resetAll}>{tr('ui.emailMarks.resetAll')}</Button>
  </div>
</div>

<style>
  .mark-row { display: grid; grid-template-columns: 28px 9rem minmax(10rem, 16rem) 40px auto; align-items: center; gap: var(--space-2) var(--space-3); }
  .mark-row .input { width: 100%; }
  input[type='color'] { width: 40px; height: 32px; padding: 0; border: 1px solid var(--border); border-radius: var(--radius-s); background: none; cursor: pointer; }
  @media (max-width: 720px) { .mark-row { grid-template-columns: 28px 1fr 40px; } .mark-row .input { grid-column: 1 / -1; } }
  .name { min-width: 0; }
  .sample { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; color: var(--text-muted); background: var(--surface-2); }
  .sample.custom { color: var(--mark-color); background: color-mix(in srgb, var(--mark-color) 16%, transparent); }
</style>
