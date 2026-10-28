import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { api } from '../api';
import { loadApp } from '../state/app.svelte';
import { useDevBackend } from '../test/transport';
import EmailDetail from './EmailDetail.svelte';

const ui = (name: string) => document.querySelector(`[data-ui="${name}"]`) as HTMLElement | null;
const pressed = (name: string) => ui(name)!.getAttribute('aria-pressed') === 'true';
const targetText = () => (ui('email-suggest.target.input') as HTMLInputElement).value;

async function open(id: string): Promise<void> {
  useDevBackend();
  await loadApp();
  render(EmailDetail, { id });
  await screen.findByRole('dialog', { name: 'Add this e-mail to the communication' });
  await waitFor(() => expect(targetText()).toContain('Android Developer'));
}

describe('E-mail popup: Rejected button', () => {
  it('fills the form as a rejection, ticks the status Rejected, and saves the entry and the status', async () => {
    await open('mail-5');
    expect(ui('email-suggest.rejected')).toHaveTextContent('Rejected');
    expect(pressed('email-suggest.rejected')).toBe(false);
    await fireEvent.click(ui('email-suggest.rejected')!);
    expect(pressed('email-suggest.rejected')).toBe(true);
    expect(pressed('email-suggest.kind.message')).toBe(true);
    expect(pressed('email-suggest.kind.confirmation')).toBe(false);
    expect((ui('email-suggest.summary') as HTMLInputElement).value).toBe('Rejection from the company');
    expect((ui('email-suggest.direction') as HTMLSelectElement).value).toBe('incoming');
    expect(ui('email-suggest.status')).toHaveTextContent('Set the status Rejected');
    expect((ui('email-suggest.set-status') as HTMLInputElement).checked).toBe(true);
    expect(ui('email-suggest.reject-note')).toHaveTextContent('the application becomes Rejected');

    await fireEvent.click(ui('email-suggest.save')!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const email = await api.getEmail('mail-5');
    const detail = await api.getApplication(email.application_id);
    expect(detail.application.status).toBe('rejected');
    expect(detail.communications.find((c) => c.id === email.communication_id)).toMatchObject({ kind: 'message', direction: 'incoming', summary: 'Rejection from the company' });
  });

  it('puts back what it replaced when it is clicked again, and is off when another type is chosen', async () => {
    await open('mail-5');
    const summary = (ui('email-suggest.summary') as HTMLInputElement).value;
    await fireEvent.click(ui('email-suggest.rejected')!);
    await fireEvent.click(ui('email-suggest.rejected')!);
    expect(pressed('email-suggest.rejected')).toBe(false);
    expect(pressed('email-suggest.kind.confirmation')).toBe(true);
    expect((ui('email-suggest.summary') as HTMLInputElement).value).toBe(summary);
    expect(ui('email-suggest.reject-note')).toBeNull();

    await fireEvent.click(ui('email-suggest.rejected')!);
    await fireEvent.click(ui('email-suggest.kind.meeting')!);
    expect(pressed('email-suggest.rejected')).toBe(false);
    expect(ui('email-suggest.status')).not.toHaveTextContent('Rejected');
  });

  it('records only the message when the target is a job without an application', async () => {
    useDevBackend();
    const backend = useDevBackend();
    await loadApp();
    const job = (await api.listJobs()).find((candidate) => candidate.application_count === 0)!;
    backend.container.emails.update('mail-5', { state: '' });
    render(EmailDetail, { id: 'mail-5' });
    await screen.findByRole('dialog', { name: 'Add this e-mail to the communication' });
    await fireEvent.click(ui('email-suggest.target.input')!);
    await fireEvent.input(ui('email-suggest.target.input')!, { target: { value: job.title.slice(0, 12) } });
    await fireEvent.click(await waitFor(() => {
      const found = document.querySelector(`[data-ui="email-suggest.target.option.j:${job.id}"]`) as HTMLElement | null;
      expect(found).not.toBeNull();
      return found!;
    }));
    await fireEvent.click(ui('email-suggest.rejected')!);
    expect(ui('email-suggest.status')).toBeNull();
    expect(ui('email-suggest.reject-note')).toHaveTextContent('The status is not changed');
    await fireEvent.click(ui('email-suggest.save')!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((await api.getEmail('mail-5')).job_id).toBe(job.id);
  });
});
