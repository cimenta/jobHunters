import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { DEFAULT_EMAIL_RULES, EMAIL_RULE_CATEGORIES } from '@jobhunters/core';
import { api } from '../api';
import { loadApp } from '../state/app.svelte';
import { toasts } from '../state/toast.svelte';
import { useDevBackend } from '../test/transport';
import Settings from './Settings.svelte';

const ui = (name: string) => document.querySelector(`[data-ui="${name}"]`) as HTMLElement | null;
const area = () => document.querySelector('#rules-text') as HTMLTextAreaElement;
const choose = (category: string) => fireEvent.change(ui('email-rules.category')!, { target: { value: category } });

async function open(): Promise<void> {
  useDevBackend();
  await loadApp();
  render(Settings);
  await screen.findByRole('heading', { name: 'Settings' });
  await fireEvent.click(screen.getByRole('tab', { name: 'E-mails' }));
}

describe('Settings, e-mail rules', () => {
  it('chooses the category in a dropdown and shows its patterns, one per line', async () => {
    await open();
    const select = ui('email-rules.category') as HTMLSelectElement;
    expect([...select.options].map((option) => option.value)).toEqual([...EMAIL_RULE_CATEGORIES]);
    expect(document.querySelectorAll('#rules-text')).toHaveLength(1);
    await choose('rejection');
    expect(area().value).toBe(DEFAULT_EMAIL_RULES.rejection.join('\n'));
    await choose('relay_domains');
    expect(area().value).toContain('startupjobs.cz');
    expect(ui('email-rules.relay_domains.custom')).toBeNull();
    expect(ui('email-rules.where')).toHaveTextContent('Where the rules are applied');
  });

  it('keeps the text of a category while another one is shown, marks the changed one and saves only changed ones', async () => {
    await open();
    await choose('rejection');
    await fireEvent.input(area(), { target: { value: 'nechceme vas\n\n  nechceme vas  \nne diky' } });
    expect(ui('email-rules.rejection.custom')).not.toBeNull();
    await choose('offer');
    expect(area().value).toBe(DEFAULT_EMAIL_RULES.offer.join('\n'));
    expect([...(ui('email-rules.category') as HTMLSelectElement).options].find((option) => option.value === 'rejection')!.textContent).toContain('changed');
    await choose('rejection');
    expect(area().value).toContain('nechceme vas');
    await fireEvent.click(ui('email-rules.save')!);
    await waitFor(() => expect(toasts.some((t) => t.text === 'E-mail rules saved.')).toBe(true));
    expect((await api.getSettings()).settings.email_rules).toEqual({ rejection: ['nechceme vas', 'ne diky'] });
  });

  it('refuses a pattern that is not valid, shows the category with the line and saves nothing', async () => {
    await open();
    await choose('offer');
    await fireEvent.input(area(), { target: { value: 'fine\nbroken(' } });
    await choose('homework');
    await fireEvent.click(ui('email-rules.save')!);
    await waitFor(() => expect((ui('email-rules.category') as HTMLSelectElement).value).toBe('offer'));
    await waitFor(() => expect(ui('email-rules.offer')!.textContent).toContain('Line 2:'));
    expect((await api.getSettings()).settings.email_rules).toEqual({});
  });

  it('resets one category in the form and all categories in the settings', async () => {
    await open();
    await choose('homework');
    await fireEvent.input(area(), { target: { value: 'my homework word' } });
    await fireEvent.click(ui('email-rules.homework.reset')!);
    expect(area().value).toBe(DEFAULT_EMAIL_RULES.homework.join('\n'));
    await choose('offer');
    await fireEvent.input(area(), { target: { value: 'my offer word' } });
    await fireEvent.click(ui('email-rules.save')!);
    await waitFor(async () => expect((await api.getSettings()).settings.email_rules).toEqual({ offer: ['my offer word'] }));
    await fireEvent.click(ui('email-rules.reset-all')!);
    await waitFor(async () => expect((await api.getSettings()).settings.email_rules).toEqual({}));
    await waitFor(() => expect(area().value).toBe(DEFAULT_EMAIL_RULES.offer.join('\n')));
  });
});

describe('Settings, try the e-mail rules', () => {
  const run = () => fireEvent.click(ui('email-rules.try.run')!);

  it('has a visible Try it button that applies the rules, saved or not, to the text typed there', async () => {
    await open();
    expect(ui('email-rules.try.run')).toHaveTextContent('Try it');
    expect(ui('email-rules.try.result')).toBeNull();
    await fireEvent.input(ui('email-rules.try.subject')!, { target: { value: 'Hello' } });
    await fireEvent.input(ui('email-rules.try.body')!, { target: { value: 'After careful review we have decided to move forward with other candidates.' } });
    await run();
    expect(ui('email-rules.try.result')!.textContent).toContain('Type: rejection');
    expect(ui('email-rules.try.result')!.textContent).toContain('Entry: Message');

    await choose('rejection');
    await fireEvent.input(area(), { target: { value: 'zzzz never matches' } });
    await run();
    expect(ui('email-rules.try.result')!.textContent).not.toContain('Type: rejection');
    expect((await api.getSettings()).settings.email_rules).toEqual({});

    await fireEvent.input(area(), { target: { value: 'broken(' } });
    await run();
    expect(ui('email-rules.try.result')!.textContent).toContain('Fix the patterns');
  });

  it('shows the names it found in the text', async () => {
    await open();
    await fireEvent.input(ui('email-rules.try.subject')!, { target: { value: 'Application received' } });
    await fireEvent.input(ui('email-rules.try.body')!, { target: { value: 'We have received your application.\n\nThe Acme Talent Acquisition Team' } });
    await run();
    expect(ui('email-rules.try.result')!.textContent).toContain('company Acme');
  });
});

describe('Settings, automatic saving of e-mails', () => {
  it('saves the switch', async () => {
    await open();
    const box = ui('settings.email-auto-save.box') as HTMLInputElement;
    expect(box.checked).toBe(false);
    await fireEvent.click(box);
    await fireEvent.click(ui('settings.email-auto-save.save')!);
    await waitFor(async () => expect((await api.getSettings()).settings.email_auto_save).toBe(true));
    expect(toasts.some((t) => t.text === 'Automatic saving of e-mails is on.')).toBe(true);
  });
});

