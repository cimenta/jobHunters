import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { api } from '../api';
import { loadApp } from '../state/app.svelte';
import { toasts } from '../state/toast.svelte';
import { useDevBackend } from '../test/transport';
import EmailDetail from './EmailDetail.svelte';
import EmailsList from './EmailsList.svelte';

const ui = (name: string) => document.querySelector(`[data-ui="${name}"]`) as HTMLElement | null;
const tone = (id: string) => ui(`email.${id}.mark`)?.getAttribute('data-tone');
const dialog = () => screen.findByRole('dialog', { name: 'Add this e-mail to the communication' });
const targetText = () => (ui('email-suggest.target.input') as HTMLInputElement).value;

async function open(id: string, prepare?: (backend: ReturnType<typeof useDevBackend>) => void): Promise<void> {
  const backend = useDevBackend();
  prepare?.(backend);
  await loadApp();
  render(EmailDetail, { id });
  await dialog();
}

describe('E-mails parsed into communication entries', () => {
  it('shows a bell on new mail, parses every new mail with one button and marks the suggestions', async () => {
    useDevBackend();
    await loadApp();
    render(EmailsList);
    await screen.findByText('Jana Novakova');
    expect(tone('mail-5')).toBe('new');
    expect(ui('emails.parse')).toHaveTextContent('Parse e-mails (6)');
    await fireEvent.click(ui('emails.parse')!);
    await waitFor(() => expect(tone('mail-5')).toBe('suggested'));
    expect(ui('email.mail-5.mark')).toHaveAttribute('title', 'Suggested: Confirmation');
    expect(ui('email.mail-6.mark')).toHaveAttribute('title', 'Suggested: Meeting');
    await waitFor(() => expect(ui('emails.parse')).toHaveTextContent('Parse e-mails (0)'));
    expect(toasts.some((t) => t.text.startsWith('Parsed 6:'))).toBe(true);
    await fireEvent.click(ui('emails.parse')!);
    expect(toasts.some((t) => t.text === 'There are no new e-mails to parse.')).toBe(true);
  });

  it('opens the suggestion when a new mail is opened, with the application found and the type suggested', async () => {
    await open('mail-5');
    await waitFor(() => expect(targetText()).toContain('Android Developer'));
    expect(ui('email-suggest.kind.confirmation')).toHaveAttribute('aria-pressed', 'true');
    expect((await api.getEmail('mail-5')).state).toBe('suggested');
  });

  it('saves the entry with the notes and the text of the mail, and the mail becomes saved', async () => {
    await open('mail-5');
    await waitFor(() => expect(targetText()).toContain('Android Developer'));
    await fireEvent.input(ui('email-suggest.notes')!, { target: { value: 'Call them on Monday' } });
    await fireEvent.click(ui('email-suggest.save')!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const email = await api.getEmail('mail-5');
    expect(email).toMatchObject({ state: 'confirmed', type: 'confirmation' });
    const entry = (await api.getApplication(email.application_id)).communications.find((c) => c.id === email.communication_id)!;
    expect(entry).toMatchObject({ kind: 'confirmation', direction: 'incoming' });
    expect(entry.details.startsWith('Call them on Monday\n\n--- E-mail ---')).toBe(true);
    expect(entry.details).toContain('successfully received your application');
    await waitFor(() => expect(ui('email-detail.entry-link')).not.toBeNull());
    expect(ui('email-detail.state')).toHaveAttribute('data-tone', 'saved');
  });

  it('can leave the text of the mail out and offers the status Interview for a meeting', async () => {
    await open('mail-6');
    await waitFor(() => expect(targetText()).toContain('Android Developer'));
    expect(ui('email-suggest.kind.meeting')).toHaveAttribute('aria-pressed', 'true');
    const box = ui('email-suggest.set-status') as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(ui('email-suggest.status')).toHaveTextContent('Set the status Interview');
    expect((ui('email-suggest.when') as HTMLInputElement).value).toBe('2026-10-20T16:00');
    await fireEvent.click(ui('email-suggest.include-text')!);
    await fireEvent.click(ui('email-suggest.save')!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const email = await api.getEmail('mail-6');
    const detail = await api.getApplication(email.application_id);
    expect(detail.application.status).toBe('interview');
    expect(detail.communications.find((c) => c.id === email.communication_id)).toMatchObject({ kind: 'meeting', details: '', datetime: '2026-10-20T16:00' });
  });

  it('lets the user pick another application or job in the searchable list, and Cancel keeps the mail unsaved', async () => {
    await open('mail-1');
    await fireEvent.click(ui('email-suggest.target.input')!);
    await fireEvent.input(ui('email-suggest.target.input')!, { target: { value: 'analyst' } });
    const option = await waitFor(() => {
      const found = document.querySelector('[data-ui^="email-suggest.target.option."]') as HTMLElement | null;
      expect(found).not.toBeNull();
      return found!;
    });
    await fireEvent.click(option);
    expect(targetText().toLowerCase()).toContain('analyst');
    await fireEvent.click(ui('email-suggest.cancel')!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((await api.getEmail('mail-1')).state).toBe('suggested');
    expect(ui('email-detail.add-entry')).not.toBeNull();
  });

  it('ignores a mail and restores it', async () => {
    await open('mail-3');
    await fireEvent.click(ui('email-suggest.ignore')!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((await api.getEmail('mail-3')).state).toBe('ignored');
    await waitFor(() => expect(ui('email-detail.restore')).not.toBeNull());
    await fireEvent.click(ui('email-detail.restore')!);
    await waitFor(async () => expect((await api.getEmail('mail-3')).state).toBe(''));
  });

  it('asks for a job or an application when nothing was found and cannot save without one', async () => {
    await open('mail-x', (backend) => {
      backend.container.emails.insert({
        id: 'mail-x', thread_id: '', received_at: '2026-10-19T09:00:00.000Z', direction: 'incoming', from_email: 'someone@unknown.invalid', from_name: 'Someone', to: 'eva@example.com', cc: '',
        subject: 'Hello there', body: 'A message about nothing in particular.', attachments: '', is_bulk: false, type: '', type_confidence: '', signals: '', application_id: '', job_id: '', match_method: '', state: '', communication_id: '',
      });
    });
    expect(ui('email-suggest.no-target')).not.toBeNull();
    expect(ui('email-suggest.save')).toBeDisabled();
    expect(within(await dialog()).getByRole('combobox', { name: 'Belongs to' })).toBeInTheDocument();
  });
});
