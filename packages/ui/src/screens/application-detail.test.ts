import { fileIdFromUrl } from '@jobhunters/core';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { api } from '../api';
import { navigate, router } from '../lib/router.svelte';
import { toasts } from '../state/toast.svelte';
import { useDevBackend } from '../test/transport';
import ApplicationDetail from './ApplicationDetail.svelte';
import ApplicationsScreen from './ApplicationsScreen.svelte';
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
    await fireEvent.click(within(screen.getByRole('group', { name: 'Status' })).getByLabelText('Waiting'));
    expect(await screen.findByText(/Android Developer – #1/)).toBeInTheDocument();
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
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent ?? '')).toEqual([
      expect.stringMatching(/^Ad/), expect.stringMatching(/^Documents/), expect.stringMatching(/^Questions/),
      expect.stringMatching(/^Communication/), expect.stringMatching(/^Reminders/), expect.stringMatching(/^Timeline/),
    ]);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    const options = within(screen.getByLabelText('New status')).getAllByRole('option').map((option) => option.textContent);
    expect(options).toContain('Interview');
    expect(options).not.toContain('Draft');
    expect(options).not.toContain('Sent');
  });

  it('shows the text of the ad with line breaks and a link to the original', async () => {
    useDevBackend();
    const id = await androidApplicationId();
    render(ApplicationDetail, { id });
    const text = await screen.findByText(/build and run services/);
    expect(text).toHaveStyle({ 'white-space': 'pre-wrap' });
    expect(document.querySelector('[data-ui="ad.link"]')).toHaveAttribute('href', 'https://example.com/jobs/android');
    expect(screen.queryByText('The text of the ad was not saved.')).toBeNull();
  });

  it('says so when the text of the ad was not saved and still links to it', async () => {
    const backend = useDevBackend();
    const id = await androidApplicationId();
    const jobId = (await api.getApplication(id)).job!.id;
    backend.container.jobs.update(jobId, { description: '' });
    render(ApplicationDetail, { id });
    expect(await screen.findByText('The text of the ad was not saved.')).toBeInTheDocument();
    expect(document.querySelector('[data-ui="ad.link"]')).not.toBeNull();
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
    expect(toasts.map((t) => t.text)).toContain('"Example s.r.o. – Android Developer – #1 (2026-10)": status changed from Sent to Waiting, reminder on Oct 20, 2026');
  });

  it('shows the documents, previews them in a sandboxed frame and exports a PDF', async () => {
    const backend = useDevBackend();
    const id = await androidApplicationId();
    const detail = await api.getApplication(id);
    const resume = detail.documents.find((doc) => doc.type === 'resume')!;
    backend.drive.documents.get(fileIdFromUrl(resume.doc_url))!.content = '<p onclick="steal()">Hi Eva</p><script>alert(1)</script>';
    render(ApplicationDetail, { id });
    await fireEvent.click(await screen.findByRole('tab', { name: /Documents/ }));
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
    expect(toasts.map((t) => t.text)).toContain('PDF of "Resume" exported');
  });

  it('adds another document from a template', async () => {
    useDevBackend();
    const id = await androidApplicationId();
    render(ApplicationDetail, { id });
    await fireEvent.click(await screen.findByRole('tab', { name: /Documents/ }));
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

describe('ApplicationsScreen', () => {
  it('opens the application in a dialog over the list and closes back to the list', async () => {
    useDevBackend();
    const id = await androidApplicationId();
    navigate(`#/applications/${id}`);
    render(ApplicationsScreen);
    const dialog = await screen.findByRole('dialog', { name: 'Application' });
    expect(await within(dialog).findByRole('heading', { name: /Android Developer – #1/ })).toBeInTheDocument();
    expect(document.querySelector('[data-ui="applications"]')).not.toBeNull();
    await fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Application' })).toBeNull());
    expect(router.current.name).toBe('applications');
  });

  it('shows the error block in the dialog for an unknown application', async () => {
    useDevBackend();
    navigate('#/applications/does-not-exist');
    render(ApplicationsScreen);
    const dialog = await screen.findByRole('dialog', { name: 'Application' });
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
  });
});

describe('ApplicationDetail summary', () => {
  const ui = (id: string) => document.querySelector(`[data-ui="${id}"]`) as HTMLElement | null;

  it('shows the facts of the job, the match in percent and the status badge on the left', async () => {
    const backend = useDevBackend();
    const id = await androidApplicationId();
    const jobId = (await api.getApplication(id)).job!.id;
    backend.container.jobs.update(jobId, { match_percent: 82 });
    render(ApplicationDetail, { id });
    await screen.findByRole('heading', { level: 1 });
    const info = await waitFor(() => {
      const found = ui('application-detail.info');
      expect(found).not.toBeNull();
      return found!;
    });
    expect(info).toHaveTextContent('60,000 – 80,000 CZK / month');
    expect(info).toHaveTextContent('Praha');
    expect(info).toHaveTextContent('Full-time');
    expect(ui('application-detail.header')).toHaveTextContent('Match 82 %');
    expect(ui('application-detail.header')).toHaveTextContent('Sent');
  });

  it('has editable Remote and Hybrid checkboxes of the job', async () => {
    useDevBackend();
    const id = await androidApplicationId();
    const jobId = (await api.getApplication(id)).job!.id;
    render(ApplicationDetail, { id });
    await screen.findByRole('heading', { level: 1 });
    const remote = await waitFor(() => {
      const found = ui('application-detail.work-mode.remote') as HTMLInputElement | null;
      expect(found).not.toBeNull();
      return found!;
    });
    expect(remote).not.toBeChecked();
    expect(ui('application-detail.work-mode.hybrid')).toBeChecked();
    await fireEvent.click(remote);
    await waitFor(async () => expect((await api.getJob(jobId)).job.is_remote).toBe(true));
  });

  it('has the status control and four icon buttons with a hover name in the right column', async () => {
    useDevBackend();
    const id = await androidApplicationId();
    render(ApplicationDetail, { id });
    await screen.findByLabelText('New status');
    const actions = ui('application-detail.actions')!;
    expect(['job-link', 'company-link', 'ad-link', 'folder-link'].map((name) => actions.querySelector(`[data-ui="application-detail.${name}"]`) !== null)).toEqual([true, true, true, true]);
    expect(actions.querySelector('[data-ui="application-detail.ad-link"]')).toHaveAttribute('href', 'https://example.com/jobs/android');
    expect(actions.querySelector('[data-ui="application-detail.ad-link"]')).toHaveAttribute('title', 'Open the ad on its website');
    expect(actions.querySelector('[data-ui="application-detail.job-link"]')).toHaveAttribute('title', 'Open the job');
    expect(actions.textContent?.trim()).toBe('');
    const target = ui('status-control.target')!;
    expect(target.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('confirms a new status with a check mark that appears only after choosing one, and can cancel', async () => {
    useDevBackend();
    const id = await androidApplicationId();
    render(ApplicationDetail, { id });
    const select = await screen.findByLabelText('New status');
    expect(ui('status-control.change')).toBeNull();
    await fireEvent.change(select, { target: { value: 'interview' } });
    expect(ui('status-control.change')).toBeEnabled();
    await fireEvent.click(ui('status-control.cancel')!);
    expect(ui('status-control.change')).toBeNull();
    await fireEvent.change(select, { target: { value: 'interview' } });
    await fireEvent.click(ui('status-control.change')!);
    await waitFor(async () => expect((await api.getApplication(id)).application.status).toBe('interview'));
  });

  it('leaves the delete button on the Timeline tab, not among the icons', async () => {
    useDevBackend();
    const id = await androidApplicationId();
    render(ApplicationDetail, { id });
    await screen.findByLabelText('New status');
    expect(ui('application-detail.actions')!.querySelector('[data-ui*="delete"]')).toBeNull();
    await fireEvent.click(screen.getByRole('tab', { name: /Timeline/ }));
    expect(await screen.findByRole('button', { name: /Delete/ })).toBeInTheDocument();
  });
});
