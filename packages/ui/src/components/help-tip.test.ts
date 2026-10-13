import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { EXPERIENCE_MAX, PROMPT_MAX, STATUS_TEXT_MAX } from '@jobhunters/core';
import { describe, expect, it } from 'vitest';
import Settings from '../screens/Settings.svelte';
import { loadApp } from '../state/app.svelte';
import { useDevBackend } from '../test/transport';
import HelpTip from './HelpTip.svelte';

describe('HelpTip', () => {
  it('is an icon button with the text as tooltip and "Help: <label>" as its name', async () => {
    useDevBackend();
    await loadApp();
    render(HelpTip, { label: 'Notices', text: 'Shows a short message.', ui: 'settings.help.test' });
    const button = screen.getByRole('button', { name: 'Help: Notices' });
    expect(button).toHaveAttribute('title', 'Shows a short message.');
    expect(button).toHaveAttribute('data-ui', 'settings.help.test');
    expect(button.textContent?.trim()).toBe('');
  });

  it('opens a dialog with the same text, closes it with Escape and gives the focus back', async () => {
    useDevBackend();
    await loadApp();
    render(HelpTip, { label: 'Notices', text: 'Shows a short message.', ui: 'settings.help.test' });
    const button = screen.getByRole('button', { name: 'Help: Notices' });
    button.focus();
    await fireEvent.click(button);
    const dialog = await screen.findByRole('dialog', { name: 'Notices' });
    expect(within(dialog).getByText('Shows a short message.')).toBeInTheDocument();
    expect(dialog).toHaveAttribute('data-ui', 'settings.help-dialog');
    await fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(button).toHaveFocus();
  });

  it('two tips open independently', async () => {
    useDevBackend();
    await loadApp();
    render(HelpTip, { label: 'First', text: 'Text one.', ui: 'settings.help.one' });
    render(HelpTip, { label: 'Second', text: 'Text two.', ui: 'settings.help.two' });
    await fireEvent.click(screen.getByRole('button', { name: 'Help: Second' }));
    const dialog = await screen.findByRole('dialog', { name: 'Second' });
    expect(within(dialog).getByText('Text two.')).toBeInTheDocument();
    expect(screen.queryByText('Text one.', { selector: 'p' })).toBeNull();
  });
});

describe('Settings help tips', () => {
  const tip = (name: string): HTMLElement | null => document.querySelector(`[data-ui="settings.help.${name}"]`);
  async function open(tab?: string): Promise<void> {
    useDevBackend();
    await loadApp();
    render(Settings);
    await screen.findByRole('heading', { name: 'Settings' });
    if (tab) await fireEvent.click(screen.getByRole('tab', { name: tab }));
  }

  it('General: tips on Notices, Menu numbers and Setup, none on the obvious language and colour mode', async () => {
    await open();
    for (const name of ['notices', 'menu-refresh', 'setup']) expect(tip(name), name).not.toBeNull();
    expect(tip('language')).toBeNull();
    expect(tip('appearance')).toBeNull();
    expect(tip('menu-refresh')!.getAttribute('title')).toContain('0');
    expect(tip('menu-refresh')!.getAttribute('title')).toContain('5 to 3600');
  });

  it('the quoted limits equal the real validators', async () => {
    await open('Experience');
    expect(tip('experience')!.getAttribute('title')).toContain(String(EXPERIENCE_MAX));
    await fireEvent.click(screen.getByRole('tab', { name: 'AI prompts' }));
    expect(tip('prompts')!.getAttribute('title')).toContain(String(PROMPT_MAX));
    await fireEvent.click(screen.getByRole('tab', { name: 'Statuses' }));
    await fireEvent.click(screen.getByRole('tab', { name: 'Application statuses' }));
    expect(tip('status-labels')!.getAttribute('title')).toContain(String(STATUS_TEXT_MAX));
    await fireEvent.click(screen.getByRole('tab', { name: 'Allowed changes' }));
    expect(tip('transitions')).not.toBeNull();
    await fireEvent.click(screen.getByRole('tab', { name: 'Ad (job) statuses' }));
    expect(tip('job-statuses')).not.toBeNull();
  });

  it('Documents, Availability, Profile and Templates have tips; the availability one names hours 0 to 23', async () => {
    await open('Documents');
    expect(tip('documents')).not.toBeNull();
    await fireEvent.click(screen.getByRole('tab', { name: 'Availability' }));
    expect(tip('availability')!.getAttribute('title')).toContain('0 to 23');
    await fireEvent.click(screen.getByRole('tab', { name: 'Profile' }));
    expect(tip('profile-links')).not.toBeNull();
    await fireEvent.click(screen.getByRole('tab', { name: 'Templates' }));
    expect(tip('templates')).not.toBeNull();
  });
});
