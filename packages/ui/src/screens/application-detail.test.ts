import { fileIdFromUrl } from '@jobhunters/core';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { navigate, router } from '../lib/router.svelte';
import { invalidate } from '../state/invalidate.svelte';
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
      expect.stringMatching(/^Communication/), expect.stringMatching(/^Interview/), expect.stringMatching(/^Reminders/), expect.stringMatching(/^Timeline/),
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
    await waitFor(() => expect(toasts.map((t) => t.text)).toContain('PDF of "Resume" exported'));
    // One click saves the file with Drive's direct download. The link works on the top window, so no tab is opened.
    const download = await within(row).findByRole('link', { name: /Download PDF/ });
    expect(download).toHaveAttribute('href', expect.stringMatching(/^https:\/\/drive\.google\.com\/uc\?export=download&id=[A-Za-z0-9_-]+$/));
    expect(download).toHaveAttribute('target', '_top');
    // Drawn like the Export PDF button beside it, not as a bare underlined link.
    expect(download).toHaveClass('btn');
    expect(within(row).getByRole('button', { name: 'Export PDF' })).toHaveClass('btn');
    await fireEvent.click(within(row).getByRole('button', { name: 'Export PDF' }));
    await waitFor(() => expect(toasts.filter((t) => t.text === 'PDF of "Resume" exported')).toHaveLength(2));
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

  it('shows the salary asked for right next to the AI salary and edits it on a double-click', async () => {
    useDevBackend();
    const id = await androidApplicationId();
    render(ApplicationDetail, { id });
    await screen.findByRole('heading', { level: 1 });
    const text = () => ui('application-detail.asked-salary.text') as HTMLElement | null;
    await waitFor(() => expect(text()).not.toBeNull());
    // Same row as the AI salary: both are children of one pair, in that order.
    const ai = ui('application-detail.info.ai-salary')!;
    expect(ai.nextElementSibling).toBe(ui('application-detail.asked-salary'));
    expect(text()).toHaveTextContent('Double-click to add');

    await fireEvent.dblClick(text()!);
    const input = ui('application-detail.asked-salary.input') as HTMLInputElement;
    expect(input).toHaveFocus();
    await fireEvent.input(input, { target: { value: '80 000 CZK / month' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(text()).toHaveTextContent('80 000 CZK / month'));
    expect((await api.getApplication(id)).application.salary).toBe('80 000 CZK / month');

    await fireEvent.dblClick(text()!);
    const again = ui('application-detail.asked-salary.input') as HTMLInputElement;
    await fireEvent.input(again, { target: { value: 'something else' } });
    await fireEvent.keyDown(again, { key: 'Escape' });
    expect(text()).toHaveTextContent('80 000 CZK / month');
    expect((await api.getApplication(id)).application.salary).toBe('80 000 CZK / month');
  });

  it('shows the contact person of the job and edits it on a double-click', async () => {
    useDevBackend();
    const id = await androidApplicationId();
    const jobId = (await api.getApplication(id)).job!.id;
    render(ApplicationDetail, { id });
    await screen.findByRole('heading', { level: 1 });
    const text = () => ui('application-detail.contact-person.text') as HTMLElement | null;
    await waitFor(() => expect(text()).toHaveTextContent('Double-click to add'));
    await fireEvent.dblClick(text()!);
    const input = ui('application-detail.contact-person.input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'Petr Svoboda, HR' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(text()).toHaveTextContent('Petr Svoboda, HR'));
    expect((await api.getJob(jobId)).job.contact_person).toBe('Petr Svoboda, HR');
  });

  it('changes the location of the job on a double-click', async () => {
    useDevBackend();
    const id = await androidApplicationId();
    const jobId = (await api.getApplication(id)).job!.id;
    render(ApplicationDetail, { id });
    await screen.findByRole('heading', { level: 1 });
    const text = () => ui('application-detail.location.text') as HTMLElement | null;
    await waitFor(() => expect(text()).toHaveTextContent('Praha'));
    await fireEvent.dblClick(text()!);
    const input = ui('application-detail.location.input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'Ostrava' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(text()).toHaveTextContent('Ostrava'));
    expect((await api.getJob(jobId)).job.location).toBe('Ostrava');
  });

  it('shows a red add-link icon when the job has no link, and saves the link from the window', async () => {
    const backend = useDevBackend();
    const id = await androidApplicationId();
    const jobId = (await api.getApplication(id)).job!.id;
    backend.container.jobs.update(jobId, { url: '' });
    render(ApplicationDetail, { id });
    await screen.findByRole('heading', { level: 1 });
    const icon = await waitFor(() => {
      const found = ui('application-detail.ad-link') as HTMLElement | null;
      expect(found).not.toBeNull();
      return found!;
    });
    expect(icon).toHaveClass('alert');
    await fireEvent.click(icon);
    const dialog = screen.getByRole('dialog', { name: 'Add link' });
    await fireEvent.input(within(dialog).getByLabelText('Link to the job ad'), { target: { value: 'https://example.com/jobs/from-application' } });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getJob(jobId)).job.url).toBe('https://example.com/jobs/from-application'));
    await waitFor(() => expect(ui('application-detail.ad-link')).toHaveAttribute('href', 'https://example.com/jobs/from-application'));
  });

  it('explains the badge "PDF is out of date" in a tooltip, and shows it only when the Doc is newer than the PDF', async () => {
    const backend = useDevBackend();
    const id = await androidApplicationId();
    const detail = await api.getApplication(id);
    const resume = detail.documents.find((doc) => doc.type === 'resume')!;
    await api.exportDocumentPdf(resume.id);
    render(ApplicationDetail, { id });
    await fireEvent.click(await screen.findByRole('tab', { name: /Documents/ }));
    await screen.findByText('Resume');
    expect(ui(`doc.${resume.id}.pdf-stale`)).toBeNull();
    backend.drive.documents.get(fileIdFromUrl(resume.doc_url))!.modifiedAt = '2100-01-01T00:00:00.000Z';
    // The Doc was edited in Drive: the next load of the application shows it.
    invalidate();
    const badge = await waitFor(() => {
      const found = ui(`doc.${resume.id}.pdf-stale`);
      expect(found).not.toBeNull();
      return found!;
    });
    expect(badge).toHaveTextContent('PDF is out of date');
    expect(badge.getAttribute('title')).toMatch(/edited after this PDF was exported/);
    expect(badge.getAttribute('title')).toMatch(/Export PDF/);
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

  it('opens the field Reason why not right after the status Withdrawn is confirmed, saves it on the job and archives the job', async () => {
    useDevBackend();
    const id = await androidApplicationId();
    const jobId = (await api.getApplication(id)).job!.id;
    render(ApplicationDetail, { id });
    const select = await screen.findByLabelText('New status');
    expect(ui('application-detail.no-reason')).toBeNull();
    await fireEvent.change(select, { target: { value: 'interview' } });
    await fireEvent.click(ui('status-control.change')!);
    await waitFor(async () => expect((await api.getApplication(id)).application.status).toBe('interview'));
    expect(ui('application-detail.no-reason')).toBeNull();
    await fireEvent.change(await screen.findByLabelText('New status'), { target: { value: 'withdrawn' } });
    await fireEvent.click(ui('status-control.change')!);
    const input = (await waitFor(() => ui('application-detail.no-reason.input'))) as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    await fireEvent.input(input, { target: { value: 'Salary too low' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(ui('application-detail.no-reason.text')).toHaveTextContent('Salary too low'));
    const job = (await api.getJob(jobId)).job;
    expect(job).toMatchObject({ no_reason: 'Salary too low', status: 'archived' });
  });

  it('shows the reason of a withdrawn application even when it was not typed yet, and the reason typed on the job', async () => {
    const backend = useDevBackend();
    const id = await androidApplicationId();
    const jobId = (await api.getApplication(id)).job!.id;
    backend.container.jobs.update(jobId, { no_reason: 'Not a fit' });
    render(ApplicationDetail, { id });
    await waitFor(() => expect(ui('application-detail.no-reason.text')).toHaveTextContent('Not a fit'));
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
