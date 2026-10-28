import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { toDateTimeInput } from '../lib/format';
import { loadApp } from '../state/app.svelte';
import { useDevBackend } from '../test/transport';
import EmailDetail from './EmailDetail.svelte';

const ui = (name: string) => document.querySelector(`[data-ui="${name}"]`) as HTMLElement | null;
const dialog = () => screen.findByRole('dialog', { name: 'Add this e-mail to the communication' });

describe('E-mail popup: notice, date and time, parse again', () => {
  it('says that a suggestion is on its way while the mail is being read, then opens it', async () => {
    useDevBackend();
    await loadApp();
    const real = api.parseEmail;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    vi.spyOn(api, 'parseEmail').mockImplementation(async (id) => {
      await gate;
      return real(id);
    });
    render(EmailDetail, { id: 'mail-5' });
    const notice = await waitFor(() => {
      const found = ui('email-detail.parsing');
      expect(found).not.toBeNull();
      return found!;
    });
    expect(notice).toHaveTextContent('Reading the e-mail');
    expect(screen.queryByRole('dialog')).toBeNull();
    release();
    await dialog();
    await waitFor(() => expect(ui('email-detail.parsing')).toBeNull());
    vi.restoreAllMocks();
  });

  it('fills the date and time with the time the mail was received, in the time zone of the app', async () => {
    useDevBackend();
    await loadApp();
    render(EmailDetail, { id: 'mail-5' });
    await dialog();
    const when = ui('email-suggest.when') as HTMLInputElement;
    expect(when.value).toBe(toDateTimeInput('2026-10-17T10:00:00.000Z'));
    expect(when.value.startsWith('2026-10-17T')).toBe(true);
    expect(ui('email-suggest.when')!.closest('.field')).toHaveTextContent('The time the e-mail was received.');
  });

  it('parses a suggested mail again after the rules changed', async () => {
    useDevBackend();
    await loadApp();
    render(EmailDetail, { id: 'mail-5' });
    await dialog();
    await fireEvent.click(ui('email-suggest.cancel')!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await api.updateSettings({ email_rules: JSON.stringify({ confirmation: ['nothing matches this'], portal_confirmation: [] }) });
    await waitFor(() => expect(ui('email-detail.reparse')).not.toBeNull());
    await fireEvent.click(ui('email-detail.reparse')!);
    await dialog();
    expect((await api.getEmail('mail-5')).type).not.toBe('confirmation');
  });

  it('converts a date-time to the value of a datetime-local field and refuses garbage', () => {
    expect(toDateTimeInput('not a date')).toBe('');
    expect(toDateTimeInput('2026-10-17T10:00:00.000Z')).toMatch(/^2026-10-17T\d{2}:\d{2}$/);
  });
});
