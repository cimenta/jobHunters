import { fileIdFromUrl } from '@jobhunters/core';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { api } from '../api';
import { navigate, router } from '../lib/router.svelte';
import { toasts } from '../state/toast.svelte';
import { useDevBackend } from '../test/transport';
import ApplicationDetail from './ApplicationDetail.svelte';
import ApplicationsList from './ApplicationsList.svelte';

async function androidApplicationId(): Promise<string> {
  const rows = await api.listApplications();
  return rows.find((row) => row.job_title === 'Android Developer')!.id;
}

describe('ApplicationsList', () => {
  it('lists applications with status, job and company', async () => {
    useDevBackend();
    render(ApplicationsList);
    const row = (await screen.findByText(/Android Developer – #1/)).closest('a')!;
    expect(row).toHaveAttribute('href', expect.stringMatching(/^#\/applications\//));
    expect(within(row).getByText('Sent')).toBeInTheDocument();
    expect(within(row).getAllByText(/Example s\.r\.o\./).length).toBeGreaterThan(0);
  });

  it('follows the status given in the link and can be changed', async () => {
    useDevBackend();
    navigate('#/applications?status=waiting');
    render(ApplicationsList);
    expect(await screen.findByText(/Data Analyst \(part time\) – #1/)).toBeInTheDocument();
    expect(screen.queryByText(/Android Developer – #1/)).toBeNull();
    await fireEvent.change(screen.getByLabelText('Status'), { target: { value: '' } });
    expect(screen.getByText(/Android Developer – #1/)).toBeInTheDocument();
  });

  it('explains an empty list and leads to the jobs', async () => {
    useDevBackend({ seed: false });
    render(ApplicationsList);
    expect(await screen.findByText('No applications yet')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Go to jobs' }));
    expect(router.current.name).toBe('jobs');
  });
});

describe('ApplicationDetail', () => {
  it('shows the application with its tabs and offers only allowed status changes', async () => {
    useDevBackend();
    const id = await androidApplicationId();
    render(ApplicationDetail, { id });
    expect(await screen.findByRole('heading', { name: /Android Developer – #1/ })).toBeInTheDocument();
    for (const name of [/Documents/, /Questions/, /Communication/, /Reminders/, /Timeline/]) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('tab', { name: /Documents/ })).toHaveAttribute('aria-selected', 'true');
    const options = within(screen.getByLabelText('New status')).getAllByRole('option').map((option) => option.textContent);
    expect(options).toContain('Interview');
    expect(options).not.toContain('Draft');
    expect(options).not.toContain('Sent');
  });

  it('changes the status and requires a date for "waiting"', async () => {
    useDevBackend();
    const id = await androidApplicationId();
    render(ApplicationDetail, { id });
    const select = await screen.findByLabelText('New status');
    await fireEvent.change(select, { target: { value: 'waiting' } });
    const button = screen.getByRole('button', { name: 'Change status' });
    expect(button).toBeDisabled();
    await fireEvent.input(screen.getByLabelText('Remind me on'), { target: { value: '2026-10-20' } });
    expect(button).toBeEnabled();
    await fireEvent.click(button);
    await waitFor(async () => expect((await api.getApplication(id)).application.status).toBe('waiting'));
    expect(toasts.map((t) => t.text)).toContain('Status changed');
  });

  it('shows the documents, previews them in a sandboxed frame and exports a PDF', async () => {
    const backend = useDevBackend();
    const id = await androidApplicationId();
    const detail = await api.getApplication(id);
    const resume = detail.documents.find((doc) => doc.type === 'resume')!;
    backend.drive.documents.get(fileIdFromUrl(resume.doc_url))!.content = '<p onclick="steal()">Hi Eva</p><script>alert(1)</script>';
    render(ApplicationDetail, { id });
    const row = (await screen.findByText('Resume')).closest('li')!;
    await fireEvent.click(within(row).getByRole('button', { name: 'Preview' }));
    const frame = await screen.findByTitle('Document preview');
    expect(frame).toHaveAttribute('sandbox', '');
    const srcdoc = frame.getAttribute('srcdoc') ?? '';
    expect(srcdoc).toContain('Hi Eva');
    expect(srcdoc).not.toContain('<script');
    expect(srcdoc).not.toContain('onclick');
    expect(within(row).getByRole('link', { name: /Open in Google Docs/ })).toHaveAttribute('rel', 'noopener noreferrer');

    await fireEvent.click(within(row).getByRole('button', { name: 'Export PDF' }));
    expect(await within(row).findByRole('link', { name: /Download PDF/ })).toHaveAttribute('href', expect.stringMatching(/^https:/));
    expect(toasts.map((t) => t.text)).toContain('PDF exported');
  });

  it('adds another document from a template', async () => {
    useDevBackend();
    const id = await androidApplicationId();
    render(ApplicationDetail, { id });
    await fireEvent.click(await screen.findByRole('button', { name: 'Add document' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add document' });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    await waitFor(async () => expect((await api.getApplication(id)).documents).toHaveLength(3));
  });

  it('shows an error block for an application that does not exist', async () => {
    useDevBackend();
    render(ApplicationDetail, { id: 'ghost' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Application ghost was not found.');
  });
});
