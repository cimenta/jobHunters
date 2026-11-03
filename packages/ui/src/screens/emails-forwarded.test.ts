import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { loadApp } from '../state/app.svelte';
import { useDevBackend } from '../test/transport';
import EmailDetail from './EmailDetail.svelte';

const ui = (name: string) => document.querySelector(`[data-ui="${name}"]`) as HTMLElement | null;

describe('E-mail popup: forwarded mark', () => {
  it('shows the Forwarded mark beside the toggle only for a mail the user forwarded, with the original sender', async () => {
    const backend = useDevBackend();
    await loadApp();
    backend.container.emails.update('mail-5', {
      from_email: 'me.other@example.invalid', from_name: 'Me', subject: 'Fwd: Your application has been received',
      body: '---------- Forwarded message ---------\nFrom: Example HR <hr@example.com>\nDate: 17. 10. 2026 10:00:00\nSubject: Your application has been received\n\nWe have successfully received your application for the Android Developer role at Example s.r.o.',
    });
    render(EmailDetail, { id: 'mail-5' });
    await screen.findByRole('dialog', { name: 'Add this e-mail to the communication' });
    expect(ui('email-suggest.forwarded')).toHaveTextContent('Forwarded');
    expect(ui('email-detail.forwarded')).toHaveTextContent('Forwarded');
    expect(ui('email-suggest.mail')).toHaveTextContent('Example HR');
    expect(ui('email-suggest.mail')).toHaveTextContent('Your application has been received');
  });

  it('shows no mark for an ordinary mail', async () => {
    useDevBackend();
    await loadApp();
    render(EmailDetail, { id: 'mail-5' });
    await screen.findByRole('dialog', { name: 'Add this e-mail to the communication' });
    expect(ui('email-suggest.forwarded')).toBeNull();
  });
});
