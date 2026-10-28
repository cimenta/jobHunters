import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { api } from '../api';
import { loadApp } from '../state/app.svelte';
import { useDevBackend } from '../test/transport';
import EmailDetail from './EmailDetail.svelte';

const ui = (name: string) => document.querySelector(`[data-ui="${name}"]`) as HTMLElement | null;

describe('E-mail popup: toggle between the suggestion and the e-mail', () => {
  it('shows the e-mail in place of the form and back, keeping what was typed, and saves from either view', async () => {
    useDevBackend();
    await loadApp();
    render(EmailDetail, { id: 'mail-5' });
    await screen.findByRole('dialog', { name: 'Add this e-mail to the communication' });
    expect(ui('email-suggest.preview')).toBeNull();
    expect(ui('email-suggest.toggle')).toHaveTextContent('Show the e-mail');
    await fireEvent.input(ui('email-suggest.notes')!, { target: { value: 'my note' } });

    await fireEvent.click(ui('email-suggest.toggle')!);
    expect(ui('email-suggest.preview.subject')).toHaveTextContent('Your application has been received');
    expect(ui('email-suggest.preview.body')).toHaveTextContent('successfully received your application');
    expect(ui('email-suggest.toggle')).toHaveTextContent('Show the suggestion');
    expect(ui('email-suggest.form')!.style.display).toBe('none');

    await fireEvent.click(ui('email-suggest.toggle')!);
    expect(ui('email-suggest.preview')).toBeNull();
    expect(ui('email-suggest.form')!.style.display).not.toBe('none');
    expect((ui('email-suggest.notes') as HTMLTextAreaElement).value).toBe('my note');

    await fireEvent.click(ui('email-suggest.toggle')!);
    await fireEvent.click(ui('email-suggest.save')!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const email = await api.getEmail('mail-5');
    const entry = (await api.getApplication(email.application_id)).communications.find((c) => c.id === email.communication_id)!;
    expect(entry.details.startsWith('my note')).toBe(true);
  });
});
