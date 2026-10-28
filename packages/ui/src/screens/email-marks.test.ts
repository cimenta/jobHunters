import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { DEFAULT_EMAIL_MARK_ICONS, EMAIL_MARK_ICONS, EMAIL_MARK_KEYS } from '@jobhunters/core';
import { api } from '../api';
import { ICON_NAMES } from '../components/Icon.svelte';
import { emailMark } from '../lib/email-state';
import { loadApp } from '../state/app.svelte';
import { useDevBackend } from '../test/transport';
import { invalidate } from '../state/invalidate.svelte';
import { saveUiState } from '../state/ui-state';
import EmailsList from './EmailsList.svelte';
import EmailsScreen from './EmailsScreen.svelte';
import { navigate } from '../lib/router.svelte';
import Settings from './Settings.svelte';

const ui = (name: string) => document.querySelector(`[data-ui="${name}"]`) as HTMLElement | null;

describe('marks of e-mails', () => {
  it('has a different default icon for every kind, and every icon on offer exists', () => {
    const icons = EMAIL_MARK_KEYS.map((key) => DEFAULT_EMAIL_MARK_ICONS[key]);
    expect(new Set(icons).size).toBe(EMAIL_MARK_KEYS.length);
    for (const icon of EMAIL_MARK_ICONS) expect(ICON_NAMES, icon).toContain(icon);
  });

  it('picks the mark by the state, the type and the stored kind', async () => {
    useDevBackend();
    await loadApp();
    const stored = (kind: string) => JSON.stringify({ rule: 'x', kind, dir: 'incoming', at: '', hint: '', titles: [], companies: [], summary: '' });
    expect(emailMark({ state: '', type: '', signals: '' })).toMatchObject({ key: 'new', tone: 'new', icon: 'bell' });
    expect(emailMark({ state: 'suggested', type: 'confirmation', signals: stored('confirmation') })).toMatchObject({ key: 'confirmation', tone: 'suggested', icon: 'check' });
    expect(emailMark({ state: 'suggested', type: 'interview_invite', signals: stored('meeting') })).toMatchObject({ key: 'meeting', icon: 'calendar' });
    expect(emailMark({ state: 'suggested', type: 'rejection', signals: stored('message') })).toMatchObject({ key: 'rejection', icon: 'reject' });
    expect(emailMark({ state: 'suggested', type: 'offer', signals: stored('message') })).toMatchObject({ key: 'offer', icon: 'sparkle' });
    expect(emailMark({ state: 'confirmed', type: 'rejection', signals: stored('meeting') })).toMatchObject({ key: 'meeting', tone: 'saved' });
    expect(emailMark({ state: 'suggested', type: 'noise', signals: stored('') })).toMatchObject({ key: 'ignored', tone: 'suggested' });
    expect(emailMark({ state: 'ignored', type: '', signals: '' })).toMatchObject({ key: 'ignored', tone: 'ignored', icon: 'eye-off' });
  });

  it('refreshes the icon in the list at once after the popup is saved', async () => {
    useDevBackend();
    await loadApp();
    navigate('#/emails/mail-6');
    render(EmailsScreen);
    await screen.findByRole('dialog', { name: 'Add this e-mail to the communication' });
    await waitFor(() => expect(ui('email.mail-6.mark')).toHaveAttribute('data-tone', 'suggested'));
    expect(ui('email.mail-6.mark')).toHaveAttribute('data-icon', 'calendar');
    await waitFor(() => expect((ui('email-suggest.target.input') as HTMLInputElement).value).toContain('Android Developer'));
    await fireEvent.click(ui('email-suggest.save')!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(ui('email.mail-6.mark')).toHaveAttribute('data-tone', 'saved'));
    expect(ui('email.mail-6.mark')).toHaveAttribute('title', 'Saved as Meeting');
    expect(ui('email.mail-6.mark')).toHaveAttribute('data-icon', 'calendar');
  });

  it('puts the color the user chose on the mark of a saved mail and on a suggested one', async () => {
    useDevBackend();
    await loadApp();
    saveUiState({ email_marks: { confirmation: { icon: 'flag', color: '#ff0000' } } });
    render(EmailsList);
    await screen.findByText('Jana Novakova');
    await fireEvent.click(ui('emails.parse')!);
    await waitFor(() => expect(ui('email.mail-5.mark')).toHaveAttribute('data-tone', 'suggested'));
    const mark = ui('email.mail-5.mark')!;
    expect(mark).toHaveAttribute('data-icon', 'flag');
    expect(mark.style.getPropertyValue('--mark-color')).toBe('#ff0000');
    expect(mark.classList.contains('custom')).toBe(true);
    expect(ui('email.mail-6.mark')!.classList.contains('custom')).toBe(false);
    await api.confirmEmail({ id: 'mail-5', applicationId: (await api.getEmail('mail-5')).application_id, kind: 'confirmation', direction: 'incoming' });
    invalidate();
    await waitFor(() => expect(ui('email.mail-5.mark')).toHaveAttribute('data-tone', 'saved'));
    expect(ui('email.mail-5.mark')!.style.getPropertyValue('--mark-color')).toBe('#ff0000');
    expect(ui('email.mail-5.mark')!.classList.contains('custom')).toBe(true);
  });

  it('lets the user choose the icon and the color of every kind in Settings, and the list follows', async () => {
    useDevBackend();
    await loadApp();
    render(Settings);
    await screen.findByRole('heading', { name: 'Settings' });
    await fireEvent.click(screen.getByRole('tab', { name: 'E-mails' }));
    for (const key of EMAIL_MARK_KEYS) expect(ui(`email-marks.${key}`)).not.toBeNull();
    const icon = ui('email-marks.confirmation.icon') as HTMLSelectElement;
    expect(icon.value).toBe('');
    expect(icon.options[0]!.textContent).toBe('Default (Check mark)');
    await fireEvent.change(icon, { target: { value: 'flag' } });
    await fireEvent.input(ui('email-marks.confirmation.color')!, { target: { value: '#ff0000' } });
    await fireEvent.click(ui('email-marks.save')!);
    await waitFor(async () => expect((await api.getSettings()).settings.ui_state.email_marks).toEqual({ confirmation: { icon: 'flag', color: '#ff0000' } }));
    expect(emailMark({ state: 'confirmed', type: 'confirmation', signals: JSON.stringify({ rule: 'x', kind: 'confirmation', dir: '', at: '', hint: '', titles: [], companies: [], summary: '' }) })).toMatchObject({ icon: 'flag', color: '#ff0000' });
    await fireEvent.click(ui('email-marks.confirmation.reset-color')!);
    await fireEvent.click(ui('email-marks.save')!);
    await waitFor(async () => expect((await api.getSettings()).settings.ui_state.email_marks).toEqual({ confirmation: { icon: 'flag', color: '' } }));
    await fireEvent.click(ui('email-marks.reset-all')!);
    await waitFor(async () => expect((await api.getSettings()).settings.ui_state.email_marks).toEqual({}));
  });
});
