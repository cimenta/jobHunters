import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { setLocale } from '../lib/i18n.svelte';
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


  it('shows a muted line with work mode, type and salary, and the AI salary, only when there is something to show', async () => {
    const backend = useDevBackend();
    render(JobsList);
    const row = (await screen.findByText('Android Developer')).closest('a')!;
    expect(within(row).getByText('Hybrid · Full-time · 60,000 – 80,000 CZK / month')).toBeInTheDocument();
    expect(within(row).getByText('75,000 (65,000–90,000) CZK/month, AI estimate')).toBeInTheDocument();
    const long = (await screen.findByText(/^Senior Principal Staff/)).closest('a')!;
    expect(long.querySelector('[data-ui$=".facts"]')).toBeNull();
    expect(long.querySelector('[data-ui$=".ai-salary"]')).toBeNull();
    expect(backend).toBeDefined();
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
    await fireEvent.click(document.querySelector('[data-ui="jobs.clear-empty"]')!);
    await fireEvent.click(screen.getByLabelText('Gig'));
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

describe('JobsList sort and hide', () => {
  async function open() {
    const backend = useDevBackend();
    await loadApp();
    const rows = await api.listJobs();
    return { backend, rows };
  }

  const titles = (): string[] => [...document.querySelectorAll('[data-ui="jobs.list"] a.job .title')].map((el) => el.textContent ?? '');
  const sortBox = () => screen.getByLabelText('Sort by') as HTMLSelectElement;
  const hideBox = () => screen.getByLabelText('Hide with application') as HTMLInputElement;

  it('offers the sort dropdown with four options and the hide checkbox', async () => {
    await open();
    render(JobsList);
    await screen.findByText('Android Developer');
    expect([...sortBox().options].map((o) => o.text)).toEqual(['Newest', 'Oldest', 'Best match', 'Worst match']);
    expect(sortBox().value).toBe('newest');
    expect(hideBox().checked).toBe(false);
  });

  it('lists the newest job first by default and the oldest first on request', async () => {
    const { backend, rows } = await open();
    rows.forEach((job, index) => backend.container.jobs.update(job.id, { found_at: `2026-09-${String(10 + index).padStart(2, '0')}T08:00:00.000Z` }));
    const byFound = [...(await api.listJobs())].sort((a, b) => b.found_at.localeCompare(a.found_at));
    render(JobsList);
    await screen.findByText('Android Developer');
    const shown = titles();
    expect(shown[0]).toBe(byFound[0]!.title);
    expect(shown[shown.length - 1]).toBe(byFound[byFound.length - 1]!.title);
    await fireEvent.change(sortBox(), { target: { value: 'oldest' } });
    const reversed = titles();
    expect(reversed[0]).toBe(byFound[byFound.length - 1]!.title);
    expect(reversed[reversed.length - 1]).toBe(byFound[0]!.title);
  });

  it('puts the best match first and jobs without a match last', async () => {
    const { backend, rows } = await open();
    backend.container.jobs.update(rows[0]!.id, { match_percent: 40 });
    backend.container.jobs.update(rows[1]!.id, { match_percent: 90 });
    render(JobsList);
    await screen.findByText(rows[0]!.title);
    await fireEvent.change(sortBox(), { target: { value: 'match_desc' } });
    const best = titles();
    expect(best.slice(0, 2)).toEqual([rows[1]!.title, rows[0]!.title]);
    await fireEvent.change(sortBox(), { target: { value: 'match_asc' } });
    const worst = titles();
    expect(worst.slice(0, 2)).toEqual([rows[0]!.title, rows[1]!.title]);
    expect(worst).toHaveLength(rows.length);
  });

  it('hides jobs with an application, also together with the status filter', async () => {
    const { backend, rows } = await open();
    const withApps = rows.filter((job) => job.application_count > 0);
    const without = rows.filter((job) => job.application_count === 0);
    expect(withApps.length).toBeGreaterThan(0);
    expect(without.length).toBeGreaterThan(0);
    backend.container.jobs.update(without[0]!.id, { status: 'no' });
    render(JobsList);
    await screen.findByText(rows[0]!.title);
    await fireEvent.click(hideBox());
    expect(titles()).toHaveLength(without.length);
    for (const job of withApps) expect(screen.queryByText(job.title)).toBeNull();
    expect(document.querySelectorAll('[data-ui="jobs.list"]')[0]!.textContent).not.toMatch(/\d+ applications?/);
    await fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'no' } });
    expect(titles()).toEqual([without[0]!.title]);
  });

  it('remembers both choices in the app and restores them on the next render', async () => {
    await open();
    const first = render(JobsList);
    await screen.findByText('Android Developer');
    await fireEvent.change(sortBox(), { target: { value: 'match_asc' } });
    await fireEvent.click(hideBox());
    await waitFor(async () => {
      const state = (await api.getSettings()).settings.ui_state;
      expect(state.jobs_sort).toBe('match_asc');
      expect(state.jobs_hide_applied).toBe(true);
    });
    first.unmount();
    await loadApp();
    render(JobsList);
    await screen.findByLabelText('Sort by');
    expect(sortBox().value).toBe('match_asc');
    expect(hideBox().checked).toBe(true);
  });

  it('clears the hide checkbox with Clear filters but keeps the sort', async () => {
    await open();
    render(JobsList);
    await screen.findByText('Android Developer');
    await fireEvent.change(sortBox(), { target: { value: 'oldest' } });
    await fireEvent.click(hideBox());
    await fireEvent.input(screen.getByLabelText('Search'), { target: { value: 'zzzz' } });
    await fireEvent.click(document.querySelector('[data-ui="jobs.clear-empty"]')!);
    expect(hideBox().checked).toBe(false);
    expect(sortBox().value).toBe('oldest');
    await waitFor(async () => expect((await api.getSettings()).settings.ui_state.jobs_hide_applied).toBe(false));
  });
});

describe('JobsList clear filters button', () => {
  const button = (): HTMLElement | null => document.querySelector('[data-ui="jobs.clear-filters"]');
  const search = () => screen.getByLabelText('Search') as HTMLInputElement;
  const availability = () => screen.getByLabelText('Availability') as HTMLSelectElement;
  const statusBox = () => screen.getByLabelText('Status') as HTMLSelectElement;
  const gigBox = () => screen.getByLabelText('Gig') as HTMLInputElement;
  const hideBox = () => screen.getByLabelText('Hide with application') as HTMLInputElement;

  async function open(): Promise<void> {
    useDevBackend();
    await loadApp();
    render(JobsList);
    await screen.findByText('Android Developer');
  }

  it('is not shown while nothing is filtered', async () => {
    await open();
    expect(button()).toBeNull();
  });

  it('gives every filter control a data-ui hook', async () => {
    await open();
    await fireEvent.input(search(), { target: { value: 'analyst' } });
    for (const id of ['search', 'availability', 'status', 'sort', 'checks', 'gig', 'hide-applied', 'clear-filters']) {
      expect(document.querySelector(`[data-ui="jobs.${id}"]`), id).not.toBeNull();
    }
    await fireEvent.input(search(), { target: { value: 'zzzz' } });
    expect(document.querySelector('[data-ui="jobs.clear-empty"]')).not.toBeNull();
  });

  it('names the checkboxes by their visible short text and keeps the full wording as title', async () => {
    await open();
    expect(gigBox().closest('label')!.getAttribute('title')).toBe('Gig (short-term work)');
    expect(hideBox().closest('label')!.getAttribute('title')).toBe('Hide jobs with an application');
    expect(gigBox().hasAttribute('aria-label')).toBe(false);
    expect(hideBox().hasAttribute('aria-label')).toBe(false);
  });

  it('shows Czech short texts', async () => {
    await open();
    setLocale('cs');
    try {
      await waitFor(() => expect(document.querySelector('[data-ui="jobs.checks"] label')?.textContent?.trim()).toBe('Brigáda'));
      const stack = document.querySelector('[data-ui="jobs.checks"]')!;
      const texts = [...stack.querySelectorAll('label')].map((label) => label.textContent?.trim());
      expect(texts).toEqual(['Brigáda', 'Skrýt s přihláškou']);
    } finally {
      setLocale('en');
    }
  });

  it('looks like a button (secondary style, not ghost)', async () => {
    await open();
    await fireEvent.input(search(), { target: { value: 'analyst' } });
    expect(button()!.classList.contains('btn')).toBe(true);
    expect(button()!.classList.contains('secondary')).toBe(true);
    expect(button()!.classList.contains('ghost')).toBe(false);
  });

  it('stacks the gig and hide checkboxes in one container with short texts and full hover titles', async () => {
    await open();
    const stack = document.querySelector('[data-ui="jobs.checks"]')!;
    expect(stack).not.toBeNull();
    expect(stack.contains(gigBox())).toBe(true);
    expect(stack.contains(hideBox())).toBe(true);
    const gigLabel = gigBox().closest('label')!;
    const hideLabel = hideBox().closest('label')!;
    expect(gigLabel.parentElement).toBe(hideLabel.parentElement);
    expect(gigLabel.textContent?.trim()).toBe('Gig');
    expect(hideLabel.textContent?.trim()).toBe('Hide with application');
    expect(gigLabel.getAttribute('title')).toBe('Gig (short-term work)');
    expect(hideLabel.getAttribute('title')).toBe('Hide jobs with an application');
  });

  it('appears with a search text, clears it, focuses the search and disappears', async () => {
    await open();
    await fireEvent.input(search(), { target: { value: 'analyst' } });
    expect(button()).not.toBeNull();
    expect(button()).toHaveTextContent('Clear filters');
    await fireEvent.click(button()!);
    expect(search().value).toBe('');
    expect(button()).toBeNull();
    expect(document.activeElement).toBe(search());
  });

  it('appears for the availability filter alone and resets only it', async () => {
    await open();
    await fireEvent.change(availability(), { target: { value: 'online' } });
    expect(button()).not.toBeNull();
    await fireEvent.click(button()!);
    expect(availability().value).toBe('');
    expect(button()).toBeNull();
  });

  it('appears for the status filter alone and resets only it', async () => {
    await open();
    await fireEvent.change(statusBox(), { target: { value: 'no' } });
    expect(button()).not.toBeNull();
    await fireEvent.click(button()!);
    expect(statusBox().value).toBe('');
    expect(button()).toBeNull();
  });

  it('appears for the gig checkbox alone and resets only it', async () => {
    await open();
    await fireEvent.click(gigBox());
    expect(button()).not.toBeNull();
    await fireEvent.click(button()!);
    expect(gigBox().checked).toBe(false);
    expect(button()).toBeNull();
  });

  it('appears for hide-applied alone, resets it and saves that', async () => {
    await open();
    await fireEvent.click(hideBox());
    expect(button()).not.toBeNull();
    await fireEvent.click(button()!);
    expect(hideBox().checked).toBe(false);
    expect(button()).toBeNull();
    await waitFor(async () => expect((await api.getSettings()).settings.ui_state.jobs_hide_applied).toBe(false));
  });

  it('keeps the other filters it was not asked about out of the way: clears all at once but keeps the sort', async () => {
    await open();
    await fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'match_asc' } });
    await fireEvent.input(search(), { target: { value: 'a' } });
    await fireEvent.change(availability(), { target: { value: 'offline' } });
    await fireEvent.change(statusBox(), { target: { value: 'no' } });
    await fireEvent.click(gigBox());
    await fireEvent.click(hideBox());
    await fireEvent.click(button()!);
    expect(search().value).toBe('');
    expect(availability().value).toBe('');
    expect(statusBox().value).toBe('');
    expect(gigBox().checked).toBe(false);
    expect(hideBox().checked).toBe(false);
    expect((screen.getByLabelText('Sort by') as HTMLSelectElement).value).toBe('match_asc');
    await waitFor(async () => {
      const state = (await api.getSettings()).settings.ui_state;
      expect(state.jobs_sort).toBe('match_asc');
      expect(state.jobs_hide_applied).toBe(false);
    });
  });

  it('keeps both buttons working when nothing matches', async () => {
    await open();
    await fireEvent.input(search(), { target: { value: 'zzzz' } });
    expect(screen.getAllByRole('button', { name: 'Clear filters' })).toHaveLength(2);
    await fireEvent.click(button()!);
    expect(await screen.findByText('Android Developer')).toBeInTheDocument();
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
    const plain = rows.find((job) => typeof job.match_percent !== 'number' && job.application_count === 0 && job.status !== 'awaiting')!;
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
      const wants = typeof job.match_percent !== 'number' && job.application_count === 0 && job.status !== 'awaiting';
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

  describe('Prepare with AI', () => {
    const PREPARE = 'Prepare with AI';

    it('shows the checkbox only for jobs without an application that are not awaiting, with short text, title and data-ui', async () => {
      const { plain } = await setup();
      await api.importJob('https://blocked.example/job/1');
      render(JobsList);
      await screen.findByText(plain.title);
      const fresh = await api.listJobs();
      await waitFor(() => expect(within(actionsOf(plain.id)).getByLabelText(PREPARE)).toBeInTheDocument());
      for (const job of fresh) {
        const wants = job.application_count === 0 && job.status !== 'awaiting';
        const box = within(actionsOf(job.id)).queryByLabelText(PREPARE);
        expect(box !== null, job.title).toBe(wants);
      }
      expect(fresh.some((job) => job.application_count > 0)).toBe(true);
      expect(fresh.some((job) => job.status === 'awaiting')).toBe(true);
      const input = within(actionsOf(plain.id)).getByLabelText(PREPARE);
      expect(input).toHaveAttribute('data-ui', `job.${plain.id}.prepare`);
      expect(input.closest('label')).toHaveAttribute('title', 'Create the application and let the AI write the resume and cover letter');
    });

    it('creates the application, queues the AI tasks, shows an informative notice and removes the checkbox', async () => {
      const { backend, plain } = await setup();
      backend.container.jobs.update(plain.id, { language: 'cs' });
      const before = (await api.listApplications()).length;
      render(JobsList);
      await screen.findByText(plain.title);
      await fireEvent.click(within(actionsOf(plain.id)).getByLabelText(PREPARE));
      await waitFor(() => expect(within(actionsOf(plain.id)).queryByLabelText(PREPARE)).toBeNull());
      const apps = await api.listApplications();
      expect(apps).toHaveLength(before + 1);
      const created = apps.find((row) => row.job_id === plain.id)!;
      expect(created.language).toBe('cs');
      const tasks = (await api.listAiTasks()).filter((task) => task.status === 'pending' && task.application_id === created.id);
      expect(tasks.length).toBeGreaterThan(0);
      const notice = toasts.find((t) => t.kind === 'success' && t.text.includes(plain.title.slice(0, 30)) && t.text.includes(`${tasks.length} AI task`));
      expect(notice, toasts.map((t) => t.text).join(' | ')).toBeDefined();
      expect(notice!.text).toMatch(/run the pending tasks/);
    });

    it('is disabled without a saved experience and links to Settings', async () => {
      const { plain } = await setup('');
      render(JobsList);
      await screen.findByText(plain.title);
      expect(within(actionsOf(plain.id)).getByLabelText(PREPARE)).toBeDisabled();
      expect(within(actionsOf(plain.id)).getByRole('link', { name: 'Describe your experience in Settings to use AI' })).toHaveAttribute('href', '#/settings');
      expect(within(actionsOf(plain.id)).getAllByRole('link', { name: /Settings/ })).toHaveLength(1);
    });

    it('keeps the Settings link when a match task is pending and no experience is saved', async () => {
      const { plain } = await setup();
      await api.requestJobMatch(plain.id);
      await api.updateSettings({ candidate_experience: '' });
      await loadApp();
      render(JobsList);
      await screen.findByText(plain.title);
      expect(within(actionsOf(plain.id)).getByLabelText(PREPARE)).toBeDisabled();
      expect(within(actionsOf(plain.id)).getByRole('link', { name: /Settings/ })).toHaveAttribute('href', '#/settings');
    });

    it('says no tasks were queued when the result has none, and keeps the box ticked and locked', async () => {
      const { plain } = await setup();
      const spy = vi.spyOn(api, 'prepareApplication').mockResolvedValue({ application: {} as never, documents: [], tasks: [], warnings: [] });
      render(JobsList);
      await screen.findByText(plain.title);
      const box = within(actionsOf(plain.id)).getByLabelText(PREPARE) as HTMLInputElement;
      await fireEvent.click(box);
      await waitFor(() => expect(toasts.some((t) => /No AI tasks were queued/.test(t.text))).toBe(true));
      expect(toasts.some((t) => /0 AI tasks/.test(t.text))).toBe(false);
      expect(box.checked).toBe(true);
      expect(box).toBeDisabled();
      spy.mockRestore();
    });

    it('resets the checkbox and shows an error when the request fails', async () => {
      const { plain } = await setup();
      const spy = vi.spyOn(api, 'prepareApplication').mockRejectedValue(new Error('boom'));
      render(JobsList);
      await screen.findByText(plain.title);
      const box = within(actionsOf(plain.id)).getByLabelText(PREPARE) as HTMLInputElement;
      await fireEvent.click(box);
      await waitFor(() => expect(toasts.some((t) => t.kind === 'error')).toBe(true));
      await waitFor(() => expect(within(actionsOf(plain.id)).getByLabelText(PREPARE)).not.toBeChecked());
      expect(box.checked).toBe(false);
      spy.mockRestore();
    });

    it('ignores a second click while the request is running', async () => {
      const { plain } = await setup();
      let release: () => void = () => undefined;
      const spy = vi.spyOn(api, 'prepareApplication').mockImplementation(
        () => new Promise((resolve) => { release = () => resolve({ application: {} as never, documents: [], tasks: [], warnings: [] }); }),
      );
      render(JobsList);
      await screen.findByText(plain.title);
      const box = within(actionsOf(plain.id)).getByLabelText(PREPARE);
      await fireEvent.click(box);
      await waitFor(() => expect(box).toBeDisabled());
      await fireEvent.click(box);
      expect(spy).toHaveBeenCalledTimes(1);
      release();
      await waitFor(() => expect(toasts.some((t) => /No AI tasks were queued/.test(t.text))).toBe(true));
      spy.mockRestore();
    });

    it('shows the warnings of the result as warning notices', async () => {
      const { plain } = await setup();
      const spy = vi.spyOn(api, 'prepareApplication').mockResolvedValue({
        application: {} as never,
        documents: [],
        tasks: [],
        warnings: [{ code: 'template_missing', params: { type: 'resume', language: 'cs' } }],
      });
      render(JobsList);
      await screen.findByText(plain.title);
      await fireEvent.click(within(actionsOf(plain.id)).getByLabelText(PREPARE));
      await waitFor(() => expect(toasts.some((t) => t.kind === 'warning' && t.text.includes('resume'))).toBe(true));
      spy.mockRestore();
    });
  });
});
