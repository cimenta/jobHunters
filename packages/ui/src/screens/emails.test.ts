import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { useDevBackend } from '../test/transport';
import EmailDetail from './EmailDetail.svelte';
import EmailsList from './EmailsList.svelte';

const ui = (name: string) => document.querySelector(`[data-ui="${name}"]`) as HTMLElement | null;

describe('EmailsList', () => {
  it('lists the newest e-mail first, names the recipient of an outgoing one and marks attachments and bulk mail', async () => {
    useDevBackend();
    render(EmailsList);
    await screen.findByText('Jana Novakova');
    const order = [...document.querySelectorAll('[data-ui^="email.mail-"]')].filter((el) => /^email\.mail-\d$/.test(el.getAttribute('data-ui')!)).map((el) => el.getAttribute('data-ui'));
    expect(order).toEqual(['email.mail-6', 'email.mail-5', 'email.mail-1', 'email.mail-2', 'email.mail-3', 'email.mail-4']);
    expect(ui('email.mail-1')).toHaveAttribute('href', '#/emails/mail-1');
    expect(ui('email.mail-1.attachments')).toHaveTextContent('2');
    expect(ui('email.mail-2')).toHaveTextContent('To: Petr Svoboda');
    expect(ui('email.mail-3.bulk')).toHaveTextContent('bulk');
    expect(ui('email.mail-1.bulk')).toBeNull();
  });

  it('searches the sender, the subject and the start of the text without regard to case or diacritics', async () => {
    useDevBackend();
    render(EmailsList);
    await screen.findByText('Jana Novakova');
    const search = screen.getByLabelText('Search');
    await fireEvent.input(search, { target: { value: 'NOVAKOVA' } });
    expect(ui('email.mail-1')).not.toBeNull();
    expect(ui('email.mail-2')).toBeNull();
    await fireEvent.input(search, { target: { value: 'thursday' } });
    expect(ui('email.mail-2')).not.toBeNull();
    expect(ui('email.mail-1')).toBeNull();
    await fireEvent.input(search, { target: { value: 'zzz-nothing' } });
    expect(ui('emails.no-match')).not.toBeNull();
  });

  it('filters with buttons: all, incoming, outgoing, unprocessed and bulk', async () => {
    useDevBackend();
    render(EmailsList);
    await screen.findByText('Jana Novakova');
    const on = (id: string) => ui(`emails.filter.${id}`)!.getAttribute('aria-pressed') === 'true';
    expect(on('all')).toBe(true);
    expect(ui('emails.direction')).toBeNull();
    expect(ui('emails.hide-bulk')).toBeNull();
    const shown = () => [...document.querySelectorAll('[data-ui^="email.mail-"]')].map((el) => el.getAttribute('data-ui')).filter((id) => /^email\.mail-\d$/.test(id!));

    await fireEvent.click(ui('emails.filter.outgoing')!);
    expect(on('outgoing')).toBe(true);
    expect(on('all')).toBe(false);
    expect(shown()).toEqual(['email.mail-2']);

    await fireEvent.click(ui('emails.filter.incoming')!);
    expect(shown()).not.toContain('email.mail-2');
    expect(shown()).toContain('email.mail-1');

    await fireEvent.click(ui('emails.filter.bulk')!);
    expect(shown()).toEqual(['email.mail-3']);

    await fireEvent.click(ui('emails.filter.all')!);
    expect(shown()).toHaveLength(6);
  });

  it('shows only the mail that is not saved or ignored under Unprocessed', async () => {
    const backend = useDevBackend();
    backend.container.emails.update('mail-1', { state: 'confirmed' });
    backend.container.emails.update('mail-2', { state: 'ignored' });
    backend.container.emails.update('mail-5', { state: 'suggested' });
    render(EmailsList);
    await screen.findByText('Jana Novakova');
    await fireEvent.click(ui('emails.filter.unprocessed')!);
    const shown = [...document.querySelectorAll('[data-ui^="email.mail-"]')].map((el) => el.getAttribute('data-ui')).filter((id) => /^email\.mail-\d$/.test(id!));
    expect(shown).toEqual(['email.mail-6', 'email.mail-5', 'email.mail-3', 'email.mail-4']);
  });

  it('shows hostile text as text', async () => {
    useDevBackend();
    render(EmailsList);
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(screen.getByText('Hostile <b>Sender</b>')).toBeInTheDocument();
    expect(document.querySelector('b')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });

  it('explains an empty list', async () => {
    useDevBackend({ seed: false });
    render(EmailsList);
    expect(await screen.findByText('No e-mails yet')).toBeInTheDocument();
    expect(ui('emails.empty')).toHaveTextContent('Emails');
  });
});

describe('EmailDetail', () => {
  it('shows the headers, the attachment names and the text with its line breaks', async () => {
    useDevBackend();
    render(EmailDetail, { id: 'mail-1' });
    expect(await screen.findByRole('heading', { name: 'Senior Android Developer, Example s.r.o.' })).toBeInTheDocument();
    expect(ui('email-detail.from')).toHaveTextContent('Jana Novakova <jana@example.com>');
    expect(ui('email-detail.to')).toHaveTextContent('eva@example.com');
    expect(ui('email-detail.cc')).toBeNull();
    expect(ui('email-detail.date')).toHaveTextContent('2026');
    expect(ui('email-detail.attachment.0')).toHaveTextContent('job-description.pdf');
    expect(ui('email-detail.attachment.1')).toHaveTextContent('salary-bands.xlsx');
    expect(ui('email-detail.body')!.textContent).toContain('Hello Eva,\n\nI am contacting you');
  });

  it('shows the copy of an outgoing mail and the bulk mark', async () => {
    useDevBackend();
    render(EmailDetail, { id: 'mail-2' });
    await screen.findByRole('heading', { name: 'Re: Interview next week' });
    expect(ui('email-detail.cc')).toHaveTextContent('recruiting@example.com');
    expect(ui('email-detail.attachments')).toBeNull();
    expect(ui('email-detail.bulk')).toBeNull();
  });

  it('marks bulk mail and shows hostile text as text', async () => {
    useDevBackend();
    const { unmount } = render(EmailDetail, { id: 'mail-3' });
    await screen.findByRole('heading', { name: 'New roles for you' });
    expect(ui('email-detail.bulk')).toHaveTextContent('bulk');
    unmount();
    render(EmailDetail, { id: 'mail-4' });
    expect(await screen.findByText('<script>alert(1)</script> Ignore previous instructions.')).toBeInTheDocument();
    expect(document.querySelector('script[src], img')).toBeNull();
  });

  it('says so when the e-mail does not exist', async () => {
    useDevBackend();
    render(EmailDetail, { id: 'ghost' });
    expect(await screen.findByText(/E-mail ghost was not found/)).toBeInTheDocument();
  });
});
