import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { DEMO_URL } from '@jobhunters/gas/dev';
import { api } from '../api';
import { loadApp } from '../state/app.svelte';
import { router } from '../lib/router.svelte';
import { toasts } from '../state/toast.svelte';
import { useDevBackend } from '../test/transport';
import JobDetail from './JobDetail.svelte';

async function idOf(title: string): Promise<string> {
  const jobs = await api.listJobs();
  return jobs.find((job) => job.title === title)!.id;
}

describe('JobDetail', () => {
  it('shows the facts, the applications of the job and safe links', async () => {
    useDevBackend();
    const id = await idOf('Android Developer');
    render(JobDetail, { id });
    expect(await screen.findByRole('heading', { name: 'Android Developer' })).toBeInTheDocument();
    expect(screen.getByText('Example s.r.o.')).toBeInTheDocument();
    const original = screen.getByRole('link', { name: /Open the ad/ });
    expect(original).toHaveAttribute('target', '_blank');
    expect(original).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: /Sent/ })).toHaveAttribute('href', expect.stringMatching(/^#\/applications\//));
  });

  it('shows hostile text as text', async () => {
    useDevBackend();
    const id = await idOf('<img src=x onerror=alert(1)>');
    render(JobDetail, { id });
    expect(await screen.findByRole('heading', { name: '<img src=x onerror=alert(1)>' })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('tab', { name: 'Description' }));
    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
  });

  it('saves notes and the gig flag', async () => {
    useDevBackend();
    const id = await idOf('Android Developer');
    render(JobDetail, { id });
    await fireEvent.click(await screen.findByRole('tab', { name: 'Notes' }));
    await fireEvent.input(await screen.findByRole('textbox', { name: 'Notes' }), { target: { value: 'Call on Monday' } });
    await fireEvent.click(screen.getByLabelText('Gig (short-term work)'));
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toasts.map((t) => t.text)).toContain('Notes of "Android Developer" saved'));
    const saved = await api.getJob(id);
    expect(saved.job).toMatchObject({ notes: 'Call on Monday', is_gig: true });
  });

  it('queues an AI evaluation of the match and shows its result', async () => {
    useDevBackend();
    const id = await idOf('Android Developer');
    render(JobDetail, { id });
    await fireEvent.click(await screen.findByRole('tab', { name: 'Match' }));
    expect(await screen.findByText(/describe your experience first/)).toBeInTheDocument();

    await api.updateSettings({ candidate_experience: 'Ten years of Kotlin' });
    await loadApp();
    const box = await screen.findByLabelText('Evaluate my match with AI');
    expect(box).not.toBeChecked();
    await fireEvent.click(box);
    await waitFor(() => expect(screen.getByLabelText('Evaluate my match with AI')).toBeChecked());
    expect(await screen.findByText(/Waiting for the AI/)).toBeInTheDocument();

    const task = (await api.getJob(id)).match!;
    expect(task).toMatchObject({ type: 'match_job', status: 'pending' });
    await fireEvent.click(screen.getByLabelText('Evaluate my match with AI'));
    await waitFor(() => expect(screen.getByLabelText('Evaluate my match with AI')).not.toBeChecked());
    expect((await api.getJob(id)).match).toBeUndefined();
  });

  it('lets the match be requested when the backend sends null for a missing task', async () => {
    useDevBackend();
    await api.updateSettings({ candidate_experience: 'Ten years of Kotlin' });
    await loadApp();
    const { default: MatchTab } = await import('./tabs/MatchTab.svelte');
    render(MatchTab, { jobId: 'j1', match: null });
    expect(await screen.findByLabelText('Evaluate my match with AI')).toBeEnabled();
  });

  it('creates an application and opens it, warning about an active one', async () => {
    useDevBackend();
    const id = await idOf('Android Developer');
    render(JobDetail, { id });
    await fireEvent.click(await screen.findByRole('button', { name: 'Create application' }));
    const dialog = screen.getByRole('dialog', { name: 'Create application' });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(router.current.name).toBe('application'));
    expect(toasts.some((t) => /already has an active application/.test(t.text))).toBe(true);
    expect((await api.getJob(id)).applications).toHaveLength(2);
  });

  it('can start from an earlier application', async () => {
    useDevBackend();
    const id = await idOf('Android Developer');
    const earlier = (await api.getJob(id)).applications[0]!;
    render(JobDetail, { id });
    await fireEvent.click(await screen.findByRole('button', { name: 'Create application' }));
    const dialog = screen.getByRole('dialog', { name: 'Create application' });
    await fireEvent.change(within(dialog).getByLabelText('Start from'), { target: { value: earlier.id } });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(router.current.name).toBe('application'));
    const created = (await api.getJob(id)).applications.find((a) => a.id !== earlier.id)!;
    expect((await api.getApplication(created.id)).documents.length).toBe((await api.getApplication(earlier.id)).documents.length);
  });

  it('shows an error block for a job that does not exist', async () => {
    useDevBackend();
    render(JobDetail, { id: 'ghost' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Job ghost was not found.');
  });
});

describe('JobDetail layout', () => {
  it('shortens the create button to the plus and the word Application, keeping the full accessible name', async () => {
    useDevBackend();
    const id = await idOf('Android Developer');
    render(JobDetail, { id });
    const button = await screen.findByRole('button', { name: 'Create application' });
    expect(button).toHaveTextContent(/^Application$/);
    expect(button).toHaveAttribute('data-ui', 'job-detail.create-application');
  });

  it('puts a two-column grid of icon actions under it, each with a tooltip and an accessible name', async () => {
    useDevBackend();
    const id = await idOf('Android Developer');
    render(JobDetail, { id });
    await screen.findByRole('heading', { name: 'Android Developer' });
    const grid = document.querySelector('[data-ui="job-detail.actions"]') as HTMLElement;
    expect(grid).not.toBeNull();
    const buttons = [...grid.querySelectorAll('button')];
    expect(buttons.map((b) => b.getAttribute('data-ui'))).toEqual(['job-detail.refresh', 'job-detail.check-availability']);
    expect(within(grid).getByRole('button', { name: 'Check availability' })).toHaveAttribute('title', 'Check availability');
    expect(within(grid).getByRole('button', { name: 'Refresh the ad' })).toHaveAttribute('title', 'Refresh the ad');
    expect(buttons.every((b) => b.textContent?.trim() === '')).toBe(true);
    const create = screen.getByRole('button', { name: 'Create application' });
    expect(create.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('puts the status select above the icons in a side column, and the link and folder icons beside the buttons', async () => {
    const backend = useDevBackend();
    const id = await idOf('Android Developer');
    backend.container.jobs.update(id, { url: DEMO_URL });
    render(JobDetail, { id });
    await screen.findByRole('heading', { name: 'Android Developer' });
    const status = document.querySelector('[data-ui="job-detail.status"]') as HTMLElement;
    const grid = document.querySelector('[data-ui="job-detail.actions"]') as HTMLElement;
    expect(status.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const link = grid.querySelector('[data-ui="job-detail.url-link"]') as HTMLElement;
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('title', 'Open the ad');
    expect(link.textContent?.trim()).toBe('');
  });

  it('shows salary, work mode, location, type and the AI salary, each labelled and only when filled', async () => {
    const backend = useDevBackend();
    const id = await idOf('Android Developer');
    render(JobDetail, { id });
    await screen.findByRole('heading', { name: 'Android Developer' });
    const info = document.querySelector('[data-ui="job-detail.info"]') as HTMLElement;
    expect(info).toHaveTextContent('Salary');
    expect(info).toHaveTextContent('60,000 – 80,000 CZK / month');
    expect(info).toHaveTextContent('Work mode');
    expect(info).toHaveTextContent('Hybrid');
    expect(info).toHaveTextContent('Location');
    expect(info).toHaveTextContent('Praha');
    expect(info).toHaveTextContent('Type');
    expect(info).toHaveTextContent('Full-time');
    expect(info).toHaveTextContent('75,000 (65,000–90,000) CZK/month, AI estimate');
    cleanup();

    const analyst = await idOf('Data Analyst (part time)');
    backend.container.jobs.update(analyst, { location: '', salary_min: null, salary_max: null });
    render(JobDetail, { id: analyst });
    await screen.findByRole('heading', { name: 'Data Analyst (part time)' });
    const empty = document.querySelector('[data-ui="job-detail.info"]');
    expect(empty === null || !/Salary|Work mode|Location|Type|AI/.test(empty.textContent ?? '')).toBe(true);
  });

  it('hides the actions of a job that waits for the AI', async () => {
    useDevBackend();
    await api.importJob('https://blocked.example/job/9');
    const job = (await api.listJobs()).find((j) => j.status === 'awaiting')!;
    render(JobDetail, { id: job.id });
    await screen.findByText('This job waits for the AI. Tell Claude: run the pending tasks.');
    expect(document.querySelector('[data-ui="job-detail.refresh"]')).toBeNull();
    expect(document.querySelector('[data-ui="job-detail.check-availability"]')).toBeNull();
  });
});

describe('JobDetail refresh', () => {
  it('reads the ad again, names the job and the changed fields, and shows the new data', async () => {
    const backend = useDevBackend();
    await loadApp();
    const id = await idOf('Android Developer');
    backend.container.jobs.update(id, { url: DEMO_URL });
    render(JobDetail, { id });
    await screen.findByRole('heading', { name: 'Android Developer' });
    await fireEvent.click(screen.getByRole('button', { name: 'Refresh the ad' }));
    await waitFor(() => expect(toasts.some((t) => /^Refreshed "Demo Engineer": .*salary.*location.* updated$/.test(t.text))).toBe(true));
    expect(await screen.findByRole('heading', { name: 'Demo Engineer' })).toBeInTheDocument();
    expect(backend.container.jobs.get(id)).toMatchObject({ title: 'Demo Engineer', location: 'Brno', notes: '', ai_salary: '75000 (65000-90000)' });
  });

  it('says when nothing changed', async () => {
    const backend = useDevBackend();
    await loadApp();
    const id = await idOf('Android Developer');
    backend.container.jobs.update(id, { url: DEMO_URL });
    render(JobDetail, { id });
    await screen.findByRole('heading', { name: 'Android Developer' });
    await fireEvent.click(screen.getByRole('button', { name: 'Refresh the ad' }));
    await screen.findByRole('heading', { name: 'Demo Engineer' });
    toasts.length = 0;
    await fireEvent.click(screen.getByRole('button', { name: 'Refresh the ad' }));
    await waitFor(() => expect(toasts.map((t) => t.text)).toContain('Refreshed "Demo Engineer": nothing changed'));
  });

  it('shows an error notice for an unreadable ad and leaves the page intact', async () => {
    const backend = useDevBackend();
    await loadApp();
    const id = await idOf('Android Developer');
    backend.container.jobs.update(id, { url: 'https://blocked.example/job/1' });
    render(JobDetail, { id });
    await screen.findByRole('heading', { name: 'Android Developer' });
    await fireEvent.click(screen.getByRole('button', { name: 'Refresh the ad' }));
    await waitFor(() => expect(toasts.some((t) => t.kind === 'error')).toBe(true));
    expect(screen.getByRole('heading', { name: 'Android Developer' })).toBeInTheDocument();
    expect(backend.container.jobs.get(id)!.title).toBe('Android Developer');
  });
});

describe('JobDetail availability', () => {
  it('checks the availability on demand and explains the result', async () => {
    useDevBackend();
    await loadApp();
    const id = await idOf('Android Developer');
    render(JobDetail, { id });
    await screen.findByRole('heading', { name: 'Android Developer' });
    await fireEvent.click(screen.getByRole('button', { name: 'Check availability' }));
    await waitFor(() => expect(toasts.some((t) => /may be gone/.test(t.text))).toBe(true));
    expect(await screen.findByText(/suspected: page not found \(answer 404\)/)).toBeInTheDocument();
    expect(screen.getByText(/^Checked /)).toBeInTheDocument();
  });
});

describe('JobDetail status', () => {
  it('changes the status of the ad and shows the match of a new ad in percent', async () => {
    const backend = useDevBackend();
    await loadApp();
    const id = await idOf('Android Developer');
    backend.container.jobs.update(id, { match_percent: 78 });
    render(JobDetail, { id });
    await screen.findByRole('heading', { name: 'Android Developer' });
    expect(await screen.findByText('Match 78 %')).toBeInTheDocument();
    await fireEvent.change(screen.getByLabelText('Status of the ad'), { target: { value: 'no' } });
    await waitFor(async () => expect((await api.getJob(id)).job.status).toBe('no'));
    expect(await screen.findByText('Match 78 %', { selector: 'span.muted' })).toBeInTheDocument();
    expect(screen.getAllByText('No').length).toBeGreaterThan(0);
  });
});

describe('JobDetail awaiting the AI', () => {
  async function awaiting() {
    await api.importJob('https://blocked.example/job/1');
    return (await api.listJobs()).find((job) => job.status === 'awaiting')!;
  }

  it('explains the wait, offers no matching or application and deletes the job after confirmation', async () => {
    useDevBackend();
    const job = await awaiting();
    render(JobDetail, { id: job.id });
    expect(await screen.findByText('This job waits for the AI. Tell Claude: run the pending tasks.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create application' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Match' })).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Delete job' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete job' });
    expect(within(dialog).getByText(/will be deleted together with its AI tasks/)).toBeInTheDocument();
    expect(document.querySelector('[data-ui="delete-job.trash-folder"]')).toBeNull();
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect((await api.listJobs()).some((j) => j.id === job.id)).toBe(false));
    expect(toasts.some((t) => t.text.startsWith('Job "') && t.text.endsWith('" deleted'))).toBe(true);
    await waitFor(() => expect(router.current.name).toBe('jobs'));
  });

  it('offers no availability check and no status picker', async () => {
    useDevBackend();
    const job = await awaiting();
    render(JobDetail, { id: job.id });
    await screen.findByText('This job waits for the AI. Tell Claude: run the pending tasks.');
    expect(screen.queryByRole('button', { name: 'Check availability' })).toBeNull();
    expect(screen.queryByLabelText('Status')).toBeNull();
  });

  it('does not offer deleting for a normal job', async () => {
    useDevBackend();
    const id = await idOf('Android Developer');
    render(JobDetail, { id });
    await screen.findByRole('heading', { name: 'Android Developer' });
    expect(screen.queryByRole('button', { name: 'Delete job' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Create application' })).toBeInTheDocument();
  });
});

describe('Delete job (detail)', () => {
  it('offers the trash icon under the status and the red button only for a job without an application', async () => {
    useDevBackend();
    const jobs = await api.listJobs();
    const free = jobs.find((j) => j.application_count === 0 && j.status !== 'awaiting')!;
    const used = jobs.find((j) => j.application_count > 0)!;
    const first = render(JobDetail, { id: used.id });
    await first.findByLabelText('Status of the ad');
    expect(document.querySelector('[data-ui="job-detail.delete-icon"]')).toBeNull();
    expect(document.querySelector('[data-ui="job-detail.delete-button"]')).toBeNull();
    first.unmount();
    const second = render(JobDetail, { id: free.id });
    await second.findByLabelText('Status of the ad');
    const icon = document.querySelector('[data-ui="job-detail.delete-icon"]')!;
    expect(icon.closest('[data-ui="job-detail.actions"]')).not.toBeNull();
    expect(document.querySelector('[data-ui="job-detail.delete-button"]')).not.toBeNull();
  });

  it('deletes the job from the icon and goes back to the list', async () => {
    useDevBackend();
    const free = (await api.listJobs()).find((j) => j.application_count === 0 && j.status !== 'awaiting')!;
    render(JobDetail, { id: free.id });
    await screen.findByLabelText('Status of the ad');
    await fireEvent.click(document.querySelector('[data-ui="job-detail.delete-icon"]')!);
    const dialog = await screen.findByRole('dialog', { name: 'Delete job' });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect((await api.listJobs()).some((j) => j.id === free.id)).toBe(false));
    await waitFor(() => expect(router.current.name).toBe('jobs'));
  });
});
