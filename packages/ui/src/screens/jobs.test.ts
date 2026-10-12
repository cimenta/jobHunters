import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { navigate, router } from '../lib/router.svelte';
import { loadApp } from '../state/app.svelte';
import { toasts } from '../state/toast.svelte';
import { useDevBackend } from '../test/transport';
import AddJob from './AddJob.svelte';
import JobsList from './JobsList.svelte';
import JobsScreen from './JobsScreen.svelte';

describe('JobsList', () => {
  it('lists jobs with company, availability and the number of applications', async () => {
    useDevBackend();
    render(JobsList);
    const row = (await screen.findByText('Android Developer')).closest('a')!;
    expect(row).toHaveAttribute('href', expect.stringMatching(/^#\/jobs\//));
    expect(within(row).getByText('Example s.r.o.', { exact: false })).toBeInTheDocument();
    expect(within(row).getByText('1 application')).toBeInTheDocument();
  });

  it('shows hostile text as text, not as markup', async () => {
    useDevBackend();
    render(JobsList);
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
  });

  it('filters by text and by the gig checkbox, and explains an empty result', async () => {
    useDevBackend();
    render(JobsList);
    await screen.findByText('Android Developer');
    await fireEvent.input(screen.getByLabelText('Search'), { target: { value: 'analyst' } });
    expect(screen.queryByText('Android Developer')).toBeNull();
    expect(screen.getByText('Data Analyst (part time)')).toBeInTheDocument();
    await fireEvent.input(screen.getByLabelText('Search'), { target: { value: 'zzzz' } });
    expect(screen.getByText('Nothing matches')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await fireEvent.click(screen.getByLabelText('Gig (short-term work)'));
    expect(screen.queryByText('Android Developer')).toBeNull();
    expect(screen.getByText('Data Analyst (part time)')).toBeInTheDocument();
  });

  it('explains an empty list and leads to adding a job', async () => {
    useDevBackend({ seed: false });
    render(JobsList);
    expect(await screen.findByText('No jobs yet')).toBeInTheDocument();
    await fireEvent.click(screen.getAllByRole('button', { name: /Add job/ })[0]!);
    expect(router.current.name).toBe('job-new');
  });
});

describe('AddJob', () => {
  const DEMO = 'https://example.com/jobs/demo-engineer';

  it('reads an ad, lets the user check the details and saves the job', async () => {
    useDevBackend({ seed: false });
    render(AddJob);
    await fireEvent.input(screen.getByLabelText('Link to the job ad'), { target: { value: `${DEMO}?utm_source=mail` } });
    await fireEvent.click(screen.getByRole('button', { name: 'Read the ad' }));
    expect(await screen.findByDisplayValue('Demo Engineer')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Demo Corp')).toBeInTheDocument();
    await fireEvent.input(screen.getByLabelText('Location'), { target: { value: 'Brno' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save job' }));
    await waitFor(() => expect(router.current.name).toBe('job'));
    expect(toasts.map((t) => t.text)).toContain('Job saved: "Demo Engineer"');
  });

  it('offers to paste the text when the page cannot be downloaded, and still saves', async () => {
    useDevBackend({ seed: false });
    render(AddJob);
    await fireEvent.input(screen.getByLabelText('Link to the job ad'), { target: { value: 'https://example.com/blocked' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Read the ad' }));
    expect(await screen.findByText(/could not be downloaded \(HTTP 404\)/)).toBeInTheDocument();
    await fireEvent.input(screen.getByLabelText('Text of the ad'), { target: { value: 'Backend Developer\n\nWe are hiring a developer for our team.' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Use this text' }));
    expect(await screen.findByDisplayValue('Backend Developer')).toBeInTheDocument();
    await fireEvent.input(screen.getByLabelText('Company'), { target: { value: 'Acme' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save job' }));
    await waitFor(() => expect(router.current.name).toBe('job'));
  });

  it('recognises a job that is already saved and opens it', async () => {
    useDevBackend();
    render(AddJob);
    await fireEvent.input(screen.getByLabelText('Link to the job ad'), { target: { value: 'https://example.com/jobs/android' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Read the ad' }));
    expect(await screen.findByText('This job is already saved')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Open the saved job' }));
    expect(router.current.name).toBe('job');
  });

  it('shows an error for an invalid address without leaving the form', async () => {
    useDevBackend({ seed: false });
    render(AddJob);
    await fireEvent.input(screen.getByLabelText('Link to the job ad'), { target: { value: 'ftp://x.cz/a' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Read the ad' }));
    await waitFor(() => expect(toasts.some((t) => /is not a valid web address/.test(t.text))).toBe(true));
    expect(screen.getByLabelText('Link to the job ad')).toBeInTheDocument();
  });

  it('refuses a salary that is not a number', async () => {
    useDevBackend({ seed: false });
    render(AddJob);
    await fireEvent.input(screen.getByLabelText('Link to the job ad'), { target: { value: DEMO } });
    await fireEvent.click(screen.getByRole('button', { name: 'Read the ad' }));
    await screen.findByDisplayValue('Demo Engineer');
    await fireEvent.input(screen.getByLabelText('Salary from'), { target: { value: 'lots' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save job' }));
    expect(await screen.findByText('Salary must be a number.')).toBeInTheDocument();
    expect(router.current.name).not.toBe('job');
  });
});

describe('JobsList status', () => {
  it('shows the status of every ad and filters by it', async () => {
    const backend = useDevBackend();
    const jobs = backend.container.jobs.list();
    backend.container.jobs.update(jobs[0]!.id, { status: 'no' });
    render(JobsList);
    await screen.findByText(jobs[0]!.title);
    const all = screen.getAllByRole('listitem').length;
    await fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'no' } });
    await waitFor(() => expect(screen.getAllByRole('listitem').length).toBe(1));
    expect(all).toBeGreaterThan(1);
    expect(screen.getByText(jobs[0]!.title)).toBeInTheDocument();
  });
});

describe('JobsList awaiting', () => {
  it('shows the awaiting job with its badge and offers the status in the filter', async () => {
    useDevBackend();
    await api.importJob('https://blocked.example/job/1');
    render(JobsList);
    const awaiting = (await api.listJobs()).find((job) => job.status === 'awaiting')!;
    const row = (await screen.findByText(awaiting.title)).closest('a')!;
    expect(within(row).getByText('Awaiting AI')).toBeInTheDocument();
    await fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'awaiting' } });
    expect(screen.queryByText('Android Developer')).toBeNull();
    expect(screen.getByText(awaiting.title)).toBeInTheDocument();
  });
});

describe('JobsScreen pop-ups', () => {
  it('opens the job in a dialog over the visible list and closes back to the list', async () => {
    useDevBackend();
    const id = (await api.listJobs()).find((job) => job.title === 'Android Developer')!.id;
    navigate(`#/jobs/${id}`);
    render(JobsScreen);
    const dialog = await screen.findByRole('dialog', { name: 'Job' });
    expect(await within(dialog).findByRole('heading', { name: 'Android Developer' })).toBeInTheDocument();
    expect(document.querySelector('[data-ui="job-dialog"]')).not.toBeNull();
    expect(within(dialog).queryByRole('button', { name: /Back/ })).toBeNull();
    expect(screen.getAllByText('Data Analyst (part time)').length).toBeGreaterThan(0);
    await fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Job' })).toBeNull());
    expect(router.current.name).toBe('jobs');
  });

  it('shows the error block in the dialog for an unknown job', async () => {
    useDevBackend();
    navigate('#/jobs/does-not-exist');
    render(JobsScreen);
    const dialog = await screen.findByRole('dialog', { name: 'Job' });
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
  });

  it('opens Add job in a dialog with both tabs over the list and closes back to it', async () => {
    useDevBackend();
    navigate('#/jobs/new');
    render(JobsScreen);
    const dialog = await screen.findByRole('dialog', { name: 'Add a job' });
    expect(document.querySelector('[data-ui="add-job-dialog"]')).not.toBeNull();
    expect(within(dialog).getByRole('tab', { name: 'One link' })).toBeInTheDocument();
    expect(within(dialog).getByRole('tab', { name: 'Several links' })).toBeInTheDocument();
    expect(await screen.findByText('Android Developer')).toBeInTheDocument();
    await fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a job' })).toBeNull());
    expect(router.current.name).toBe('jobs');
  });

  it('switches to the pop-up of the saved job after saving', async () => {
    useDevBackend({ seed: false });
    navigate('#/jobs/new');
    render(JobsScreen);
    const dialog = await screen.findByRole('dialog', { name: 'Add a job' });
    await fireEvent.input(within(dialog).getByLabelText('Link to the job ad'), { target: { value: 'https://example.com/jobs/demo-engineer' } });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Read the ad' }));
    await within(dialog).findByDisplayValue('Demo Engineer');
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Save job' }));
    await waitFor(() => expect(router.current.name).toBe('job'));
    const jobDialog = await screen.findByRole('dialog', { name: 'Job' });
    expect(await within(jobDialog).findByRole('heading', { name: 'Demo Engineer' })).toBeInTheDocument();
  });
});

describe('JobsList card', () => {
  const MATCH = 'Evaluate my match with AI';

  async function setup(experience = 'Ten years of Kotlin') {
    const backend = useDevBackend();
    await api.updateSettings({ candidate_experience: experience });
    await loadApp();
    const rows = await api.listJobs();
    const plain = rows.find((job) => job.match_percent === null && job.application_count === 0 && job.status !== 'awaiting')!;
    return { backend, rows, plain };
  }

  function actionsOf(id: string): HTMLElement {
    return document.querySelector(`[data-ui="job.${id}.actions"]`) as HTMLElement;
  }

  it('treats a job whose match_percent is missing like one without a match (the transport can drop null)', async () => {
    const { plain } = await setup();
    const rows = (await api.listJobs()).map((row) => {
      const copy: Record<string, unknown> = { ...row };
      delete copy.match_percent;
      return copy as unknown as Awaited<ReturnType<typeof api.listJobs>>[number];
    });
    vi.spyOn(api, 'listJobs').mockResolvedValue(rows);
    render(JobsList);
    await screen.findByText(plain.title);
    expect(screen.queryByText(/Match undefined/)).toBeNull();
    await waitFor(() => expect(within(actionsOf(plain.id)).getByLabelText(MATCH)).toBeInTheDocument());
    vi.restoreAllMocks();
  });

  it('shows the checkbox only for a job without match, applications and awaiting status', async () => {
    const { backend, rows, plain } = await setup();
    expect(plain).toBeDefined();
    const withMatch = rows.find((job) => job.id !== plain.id)!;
    backend.container.jobs.update(withMatch.id, { match_percent: 70 });
    await api.importJob('https://blocked.example/job/1');
    render(JobsList);
    await screen.findByText(plain.title);
    const fresh = await api.listJobs();
    const awaiting = fresh.find((job) => job.status === 'awaiting')!;
    await waitFor(() => expect(within(actionsOf(plain.id)).getByLabelText(MATCH)).toBeInTheDocument());
    for (const job of fresh) {
      const wants = job.match_percent === null && job.application_count === 0 && job.status !== 'awaiting';
      const box = actionsOf(job.id) ? within(actionsOf(job.id)).queryByLabelText(MATCH) : null;
      expect(box !== null, job.title).toBe(wants);
    }
    expect(awaiting).toBeDefined();
  });

  it('queues a match task on tick, shows it waiting, cancels on untick, and does not navigate', async () => {
    const { plain } = await setup();
    navigate('#/jobs');
    render(JobsList);
    await screen.findByText(plain.title);
    const box = () => within(actionsOf(plain.id)).getByLabelText(MATCH);
    await fireEvent.click(box());
    await waitFor(() => expect(box()).toBeChecked());
    expect((await api.listAiTasks()).filter((task) => task.type === 'match_job' && task.status === 'pending')).toHaveLength(1);
    expect(toasts.map((t) => t.text)).toContain(`Match evaluation requested for "${plain.title}"`);
    expect(within(actionsOf(plain.id)).getByLabelText(/Waiting for the AI/)).toBeInTheDocument();
    expect(router.current.name).toBe('jobs');
    await fireEvent.click(box());
    await waitFor(() => expect(box()).not.toBeChecked());
    expect((await api.listAiTasks()).filter((task) => task.status === 'pending')).toHaveLength(0);
    expect(toasts.map((t) => t.text)).toContain(`Match evaluation cancelled for "${plain.title}"`);
  });

  it('shows the checkbox checked and disabled while the task is in progress', async () => {
    const { backend, plain } = await setup();
    await api.requestJobMatch(plain.id);
    const task = (await api.listAiTasks()).find((t) => t.type === 'match_job')!;
    backend.container.tasks.update(task.id, { status: 'in_progress' });
    render(JobsList);
    await screen.findByText(plain.title);
    const box = within(actionsOf(plain.id)).getByLabelText(MATCH);
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
  });

  it('resets the checkbox and shows an error when the request fails', async () => {
    const { plain } = await setup();
    const spy = vi.spyOn(api, 'requestJobMatch').mockRejectedValue(new Error('boom'));
    render(JobsList);
    await screen.findByText(plain.title);
    const box = within(actionsOf(plain.id)).getByLabelText(MATCH);
    await fireEvent.click(box);
    await waitFor(() => expect(toasts.some((t) => t.kind === 'error' || /boom/.test(t.text))).toBe(true));
    await waitFor(() => expect(within(actionsOf(plain.id)).getByLabelText(MATCH)).not.toBeChecked());
    expect((box as HTMLInputElement).checked).toBe(false);
    spy.mockRestore();
  });

  it('shows the no-experience hint once in the list', async () => {
    await setup('');
    render(JobsList);
    await screen.findByText('Senior Principal Staff Software Engineer in Distributed Systems and Platform Reliability for a Very Long Company Name');
    expect(document.querySelectorAll('[data-ui$=".match.hint"]')).toHaveLength(1);
  });

  it('keeps the actions column outside the link and the title opens the job', async () => {
    const { plain } = await setup();
    render(JobsList);
    const link = (await screen.findByText(plain.title)).closest('a')!;
    const actions = actionsOf(plain.id);
    expect(actions).not.toBeNull();
    expect(link.contains(actions)).toBe(false);
    expect(link.querySelector('input, button, a')).toBeNull();
    await fireEvent.click(link);
    expect(link).toHaveAttribute('href', `#/jobs/${plain.id}`);
  });

  it('disables the checkbox without a saved experience and links to Settings', async () => {
    const { plain } = await setup('');
    render(JobsList);
    await screen.findByText(plain.title);
    const actions = actionsOf(plain.id);
    expect(within(actions).getByLabelText(MATCH)).toBeDisabled();
    expect(within(actions).getByRole('link', { name: /Describe your experience in Settings/ })).toHaveAttribute('href', '#/settings');
  });

  it('offers the original ad as a new-tab link and checks the availability with a notice', async () => {
    const { plain } = await setup();
    render(JobsList);
    await screen.findByText(plain.title);
    const actions = actionsOf(plain.id);
    const open = within(actions).getByRole('link', { name: 'Open original ad' });
    expect(open).toHaveAttribute('target', '_blank');
    expect(open).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(actions).queryByRole('button', { name: 'Delete job' })).toBeNull();
    await fireEvent.click(within(actions).getByRole('button', { name: 'Check availability' }));
    await waitFor(() => expect(toasts.some((t) => t.text.includes(`"${plain.title}"`) && /ad/.test(t.text))).toBe(true));
    expect(router.current.name).not.toBe('job');
  });

  it('shows the trash icon only for an awaiting job, confirms, and deletes it', async () => {
    await setup();
    await api.importJob('https://blocked.example/job/1');
    render(JobsList);
    const awaiting = (await api.listJobs()).find((job) => job.status === 'awaiting')!;
    await screen.findByText(awaiting.title);
    const actions = actionsOf(awaiting.id);
    expect(within(actions).queryByLabelText(MATCH)).toBeNull();
    await fireEvent.click(within(actions).getByRole('button', { name: 'Delete job' }));
    const dialog = await screen.findByRole('dialog');
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText(awaiting.title)).toBeNull());
    expect(toasts.some((t) => t.text.includes('deleted'))).toBe(true);
    expect((await api.listJobs()).some((job) => job.id === awaiting.id)).toBe(false);
  });
});
