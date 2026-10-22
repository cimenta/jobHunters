import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
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


  it('has one-click icons that set the status Archived or No, and leaves out the icon of the status the job already has', async () => {
    useDevBackend();
    render(JobsList);
    await screen.findByText('Data Analyst (part time)');
    const analyst = (await api.listJobs()).find((job) => job.title === 'Data Analyst (part time)')!;
    const ui = (name: string) => document.querySelector(`[data-ui="${name}"]`) as HTMLElement | null;
    expect(ui(`job.${analyst.id}.archive`)).not.toBeNull();
    expect(ui(`job.${analyst.id}.no`)).not.toBeNull();
    await fireEvent.click(ui(`job.${analyst.id}.archive`)!);
    await waitFor(async () => expect((await api.getJob(analyst.id)).job.status).toBe('archived'));
    expect(toasts.map((t) => t.text).some((text) => text.includes('Data Analyst (part time)') && text.includes('Archived'))).toBe(true);
    await waitFor(() => expect(ui(`job.${analyst.id}.archive`)).toBeNull());
    expect(ui(`job.${analyst.id}.no`)).not.toBeNull();
    await fireEvent.click(ui(`job.${analyst.id}.no`)!);
    await waitFor(async () => expect((await api.getJob(analyst.id)).job.status).toBe('no'));
    await waitFor(() => expect(ui(`job.${analyst.id}.no`)).toBeNull());
    expect(ui(`job.${analyst.id}.archive`)).not.toBeNull();
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

  it('has a contact person field, and a shift field only while Gig is ticked; both are saved with the job', async () => {
    useDevBackend({ seed: false });
    render(AddJob);
    await fireEvent.input(screen.getByLabelText('Link to the job ad'), { target: { value: DEMO } });
    await fireEvent.click(screen.getByRole('button', { name: 'Read the ad' }));
    await screen.findByDisplayValue('Demo Engineer');
    expect(document.querySelector('[data-ui="add-job.gig-shift"]')).toBeNull();
    await fireEvent.input(screen.getByLabelText('Contact person'), { target: { value: 'Jana Novakova, recruiter' } });
    const gig = document.querySelector('[data-ui="add-job.gig"]') as HTMLInputElement;
    if (!gig.checked) await fireEvent.click(gig);
    await fireEvent.input(screen.getByLabelText('Shift'), { target: { value: 'Sat-Sun 8-16' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save job' }));
    await waitFor(() => expect(router.current.name).toBe('job'));
    const saved = (await api.listJobs()).find((job) => job.title === 'Demo Engineer')!;
    expect(saved).toMatchObject({ contact_person: 'Jana Novakova, recruiter', is_gig: true, gig_shift: 'Sat-Sun 8-16' });
  });

  it('sends the page it already downloaded back with the save, so the ad is not downloaded twice', async () => {
    useDevBackend({ seed: false });
    const spy = vi.spyOn(api, 'saveJob');
    render(AddJob);
    await fireEvent.input(screen.getByLabelText('Link to the job ad'), { target: { value: DEMO } });
    await fireEvent.click(screen.getByRole('button', { name: 'Read the ad' }));
    await screen.findByDisplayValue('Demo Engineer');
    await fireEvent.click(screen.getByRole('button', { name: 'Save job' }));
    await waitFor(() => expect(router.current.name).toBe('job'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0].html).toContain('Demo Engineer');
    spy.mockRestore();
  });

  async function reviewForm(experience: string): Promise<void> {
    useDevBackend({ seed: false });
    await api.updateSettings({ candidate_experience: experience });
    await loadApp();
    render(AddJob);
    await fireEvent.input(screen.getByLabelText('Link to the job ad'), { target: { value: DEMO } });
    await fireEvent.click(screen.getByRole('button', { name: 'Read the ad' }));
    await screen.findByDisplayValue('Demo Engineer');
  }
  const matchBox = () => document.querySelector('[data-ui="add-job.ai-match"]') as HTMLInputElement;
  const documentsBox = () => document.querySelector('[data-ui="add-job.ai-documents"]') as HTMLInputElement;

  it('has two unticked AI checkboxes above Save job; only one can be ticked at a time, or none', async () => {
    await reviewForm('Ten years of Kotlin');
    expect(matchBox()).toBeEnabled();
    expect(documentsBox()).toBeEnabled();
    expect(matchBox().checked).toBe(false);
    expect(documentsBox().checked).toBe(false);
    await fireEvent.click(matchBox());
    expect(matchBox().checked).toBe(true);
    expect(documentsBox().checked).toBe(false);
    await fireEvent.click(documentsBox());
    expect(documentsBox().checked).toBe(true);
    await waitFor(() => expect(matchBox().checked).toBe(false));
    await fireEvent.click(documentsBox());
    expect(documentsBox().checked).toBe(false);
    expect(matchBox().checked).toBe(false);
    const save = document.querySelector('[data-ui="add-job.save"]') as HTMLElement;
    expect(matchBox().compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('saves the job without any AI work when no checkbox is ticked', async () => {
    await reviewForm('Ten years of Kotlin');
    await fireEvent.click(screen.getByRole('button', { name: 'Save job' }));
    await waitFor(() => expect(router.current.name).toBe('job'));
    expect(await api.listAiTasks()).toHaveLength(0);
    expect((await api.listApplications())).toHaveLength(0);
  });

  it('"Perform job match" queues one match task as soon as the job is saved', async () => {
    await reviewForm('Ten years of Kotlin');
    await fireEvent.click(matchBox());
    await fireEvent.click(screen.getByRole('button', { name: 'Save job' }));
    await waitFor(() => expect(router.current.name).toBe('job'));
    const tasks = await api.listAiTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ type: 'match_job', status: 'pending' });
    expect(await api.listApplications()).toHaveLength(0);
    expect(toasts.map((x) => x.text).some((text) => /1 AI task queued for .*\(job match\)/.test(text))).toBe(true);
  });

  it('"Create resume and cover letter" creates the application and queues the document tasks', async () => {
    await reviewForm('Ten years of Kotlin');
    await fireEvent.click(documentsBox());
    await fireEvent.click(screen.getByRole('button', { name: 'Save job' }));
    await waitFor(() => expect(router.current.name).toBe('job'));
    expect(await api.listApplications()).toHaveLength(1);
    const types = (await api.listAiTasks()).map((task) => task.type).sort();
    expect(types).toEqual(['cover_letter', 'resume_tailor']);
    expect(toasts.map((x) => x.text).some((text) => /Application created and 2 AI tasks queued/.test(text))).toBe(true);
  });

  it('saves the Remote and Hybrid checkboxes ticked in the review form', async () => {
    await reviewForm('Ten years of Kotlin');
    await fireEvent.click(document.querySelector('[data-ui="add-job.remote"]') as HTMLElement);
    await fireEvent.click(document.querySelector('[data-ui="add-job.hybrid"]') as HTMLElement);
    await fireEvent.click(screen.getByRole('button', { name: 'Save job' }));
    await waitFor(() => expect(router.current.name).toBe('job'));
    const [saved] = await api.listJobs();
    expect(saved).toMatchObject({ is_remote: true, is_hybrid: true });
  });

  it('disables both AI checkboxes without a described experience and says why', async () => {
    await reviewForm('');
    expect(matchBox()).toBeDisabled();
    expect(documentsBox()).toBeDisabled();
    expect(document.querySelector('[data-ui="add-job.ai-match.hint"]')).toHaveTextContent('Describe your experience first');
    expect(document.querySelector('[data-ui="add-job.ai-documents.settings"]')).toHaveAttribute('href', '#/settings');
    await fireEvent.click(screen.getByRole('button', { name: 'Save job' }));
    await waitFor(() => expect(router.current.name).toBe('job'));
    expect(await api.listAiTasks()).toHaveLength(0);
  });

  async function failedDownload(experience: string): Promise<void> {
    useDevBackend({ seed: false });
    await api.updateSettings({ candidate_experience: experience });
    await loadApp();
    render(AddJob);
    await fireEvent.input(screen.getByLabelText('Link to the job ad'), { target: { value: 'https://example.com/blocked' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Read the ad' }));
    await screen.findByText(/could not be downloaded \(HTTP 404\)/);
  }
  const aiBox = () => document.querySelector('[data-ui="add-job.ai-job"]') as HTMLInputElement | null;

  it('always shows the AI job checkbox, and with it ticked creates the AI job without downloading the ad', async () => {
    useDevBackend({ seed: false });
    await api.updateSettings({ candidate_experience: 'Ten years of Kotlin' });
    await loadApp();
    render(AddJob);
    expect(aiBox()).not.toBeNull();
    expect(aiBox()).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Read the ad' })).toBeInTheDocument();
    await fireEvent.input(screen.getByLabelText('Link to the job ad'), { target: { value: DEMO } });
    await fireEvent.click(aiBox()!);
    expect(screen.queryByRole('button', { name: 'Read the ad' })).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Create AI job' }));
    await waitFor(() => expect(router.current.name).toBe('job'));
    const tasks = await api.listAiTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ type: 'import_match_job', status: 'pending' });
    expect(toasts.map((t) => t.text).some((text) => /AI job created for .*1 AI task queued \(import and match\)/.test(text))).toBe(true);
  });

  it('shows the extra instructions field only while the AI job box is ticked and sends them with the task', async () => {
    useDevBackend({ seed: false });
    await api.updateSettings({ candidate_experience: 'Ten years of Kotlin' });
    await loadApp();
    render(AddJob);
    const notes = () => document.querySelector('[data-ui="add-job.ai-notes"]') as HTMLTextAreaElement | null;
    expect(notes()).toBeNull();
    await fireEvent.input(screen.getByLabelText('Link to the job ad'), { target: { value: DEMO } });
    await fireEvent.click(aiBox()!);
    await fireEvent.input(notes()!, { target: { value: 'The contact person is at the bottom of the page.' } });
    await fireEvent.click(aiBox()!);
    expect(notes()).toBeNull();
    await fireEvent.click(aiBox()!);
    expect(notes()).toHaveValue('The contact person is at the bottom of the page.');
    await fireEvent.click(screen.getByRole('button', { name: 'Create AI job' }));
    await waitFor(() => expect(router.current.name).toBe('job'));
    const task = (await api.listAiTasks())[0]!;
    expect(task.instructions).toContain('Instructions from the user: The contact person is at the bottom of the page.');
  });

  it('after a failed download the same checkbox still queues ONE import-and-match task', async () => {
    await failedDownload('Ten years of Kotlin');
    expect(aiBox()).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Use this text or HTML' })).toBeInTheDocument();
    await fireEvent.click(aiBox()!);
    expect(screen.getByRole('button', { name: 'Use this text or HTML' })).toBeDisabled();
    expect(screen.getByLabelText('Text of the ad or HTML of the page')).toBeDisabled();
    await fireEvent.click(screen.getByRole('button', { name: 'Create AI job' }));
    await waitFor(() => expect(router.current.name).toBe('job'));
    const tasks = await api.listAiTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ type: 'import_match_job', status: 'pending' });
  });

  it('disables the checkbox while text is pasted, and without a described experience', async () => {
    await failedDownload('Ten years of Kotlin');
    await fireEvent.input(screen.getByLabelText('Text of the ad or HTML of the page'), { target: { value: 'Some pasted ad' } });
    expect(aiBox()).toBeDisabled();
    expect(document.querySelector('[data-ui="add-job.ai-job.hint"]')).toHaveTextContent('Clear the pasted text');
    await fireEvent.input(screen.getByLabelText('Text of the ad or HTML of the page'), { target: { value: '' } });
    expect(aiBox()).toBeEnabled();
    cleanup();

    await failedDownload('');
    expect(aiBox()).toBeDisabled();
    expect(document.querySelector('[data-ui="add-job.ai-job.hint"]')).toHaveTextContent('Describe your experience first');
    expect(document.querySelector('[data-ui="add-job.ai-job.settings"]')).toHaveAttribute('href', '#/settings');
  });

  it('offers to paste the text when the page cannot be downloaded, and still saves', async () => {
    useDevBackend({ seed: false });
    render(AddJob);
    await fireEvent.input(screen.getByLabelText('Link to the job ad'), { target: { value: 'https://example.com/blocked' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Read the ad' }));
    expect(await screen.findByText(/could not be downloaded \(HTTP 404\)/)).toBeInTheDocument();
    await fireEvent.input(screen.getByLabelText('Text of the ad or HTML of the page'), { target: { value: 'Backend Developer\n\nWe are hiring a developer for our team.' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Use this text or HTML' }));
    expect(await screen.findByDisplayValue('Backend Developer')).toBeInTheDocument();
    await fireEvent.input(screen.getByLabelText('Company'), { target: { value: 'Acme' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save job' }));
    await waitFor(() => expect(router.current.name).toBe('job'));
  });

  it('reads the pasted source code of a page like a downloaded page, and says in the hint that this is possible', async () => {
    useDevBackend({ seed: false });
    render(AddJob);
    await fireEvent.input(screen.getByLabelText('Link to the job ad'), { target: { value: 'https://example.com/blocked' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Read the ad' }));
    await screen.findByText(/could not be downloaded \(HTTP 404\)/);
    expect(document.body.textContent).toContain('source code of the page');
    const source = '<!doctype html><html><head><title>Portal</title><script type="application/ld+json">' +
      JSON.stringify({ '@type': 'JobPosting', title: 'Source Engineer', hiringOrganization: { name: 'Source Corp' }, description: 'Read the source of the page and build the tools.', jobLocation: { address: { addressLocality: 'Ostrava' } } }) +
      '</script></head><body><h1>Source Engineer</h1></body></html>';
    await fireEvent.input(screen.getByLabelText('Text of the ad or HTML of the page'), { target: { value: source } });
    await fireEvent.click(screen.getByRole('button', { name: 'Use this text or HTML' }));
    expect(await screen.findByDisplayValue('Source Engineer')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Source Corp')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ostrava')).toBeInTheDocument();
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toContain('Read the source of the page');
    await fireEvent.click(screen.getByRole('button', { name: 'Save job' }));
    await waitFor(() => expect(router.current.name).toBe('job'));
    const saved = (await api.listJobs()).find((job) => job.title === 'Source Engineer')!;
    expect(saved).toMatchObject({ company_name: 'Source Corp', location: 'Ostrava' });
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

  it('shows a red add-link icon on the card of a job without a link, and disables its check', async () => {
    const { backend, rows } = await open();
    const target = rows.find((job) => job.status !== 'awaiting')!;
    backend.container.jobs.update(target.id, { url: '' });
    render(JobsList);
    await screen.findByText(target.title);
    const icon = await waitFor(() => {
      const found = document.querySelector(`[data-ui="job.${target.id}.link"]`) as HTMLElement | null;
      expect(found).not.toBeNull();
      expect(found).toHaveClass('alert');
      return found!;
    });
    expect(document.querySelector(`[data-ui="job.${target.id}.check"]`)).toBeDisabled();
    await fireEvent.click(icon);
    const dialog = screen.getByRole('dialog', { name: 'Add link' });
    await fireEvent.input(within(dialog).getByLabelText('Link to the job ad'), { target: { value: 'https://example.com/jobs/from-the-card' } });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getJob(target.id)).job.url).toBe('https://example.com/jobs/from-the-card'));
  });

  it('hides the jobs with the status No with the Hide No checkbox, which is remembered and cleared by Clear filters', async () => {
    const { rows } = await open();
    const target = rows.find((job) => job.status !== 'no' && job.status !== 'awaiting')!;
    await api.updateJob(target.id, { status: 'no' });
    const first = render(JobsList);
    await screen.findByText(target.title);
    const box = () => screen.getByLabelText('Hide No') as HTMLInputElement;
    expect(box().checked).toBe(false);
    await fireEvent.click(box());
    await waitFor(() => expect(screen.queryByText(target.title)).toBeNull());
    await waitFor(async () => expect((await api.getSettings()).settings.ui_state.jobs_hide_no).toBe(true));
    first.unmount();
    await loadApp();
    render(JobsList);
    await screen.findByLabelText('Sort by');
    expect(box().checked).toBe(true);
    expect(screen.queryByText(target.title)).toBeNull();
    await fireEvent.click(document.querySelector('[data-ui="jobs.clear-filters"]')!);
    expect(box().checked).toBe(false);
    await screen.findByText(target.title);
    await waitFor(async () => expect((await api.getSettings()).settings.ui_state.jobs_hide_no).toBe(false));
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
      await waitFor(() => expect(document.querySelector('[data-ui="jobs.checks"] label')?.textContent?.trim()).toBe('Skrýt s přihláškou'));
      const stack = document.querySelector('[data-ui="jobs.checks"]')!;
      const texts = [...stack.querySelectorAll('label')].map((label) => label.textContent?.trim());
      // Gig stands right after Hide No.
      expect(texts).toEqual(['Skrýt s přihláškou', 'Skrýt „Ne“', 'Brigáda']);
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

  it('groups the gig and hide checkboxes in one container, Hide No and Gig on one row, with short texts and full hover titles', async () => {
    await open();
    const stack = document.querySelector('[data-ui="jobs.checks"]')!;
    expect(stack).not.toBeNull();
    expect(stack.contains(gigBox())).toBe(true);
    expect(stack.contains(hideBox())).toBe(true);
    const gigLabel = gigBox().closest('label')!;
    const hideLabel = hideBox().closest('label')!;
    // Hide No and Gig stand side by side (one row), under Hide with application.
    const noLabel = (document.querySelector('[data-ui="jobs.hide-no"]') as HTMLElement).closest('label')!;
    expect(gigLabel.parentElement).toBe(noLabel.parentElement);
    expect(gigLabel.parentElement).not.toBe(stack);
    expect(hideLabel.parentElement).toBe(stack);
    expect(stack.children[1]).toBe(gigLabel.parentElement);
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

  it('labels the match checkbox with a visible text and a hover text', async () => {
    const { plain } = await setup();
    render(JobsList);
    await screen.findByText(plain.title);
    const label = within(actionsOf(plain.id)).getByLabelText(MATCH).closest('label')!;
    expect(label).toHaveTextContent('Evaluate match');
    expect(label).toHaveAttribute('title', MATCH);
  });

  it('says on hover why the match checkbox is disabled when no experience is described', async () => {
    const { plain } = await setup('');
    render(JobsList);
    await screen.findByText(plain.title);
    const box = within(actionsOf(plain.id)).getByLabelText(MATCH);
    expect(box).toBeDisabled();
    expect(box.closest('label')).toHaveTextContent('Evaluate match');
    expect(box.closest('label')).toHaveAttribute('title', 'Describe your experience in Settings to evaluate your match');
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
    expect(within(actions).getByRole('button', { name: 'Delete job' })).toBeInTheDocument();
    await fireEvent.click(within(actions).getByRole('button', { name: 'Check availability' }));
    await waitFor(() => expect(toasts.some((t) => t.text.includes(`"${plain.title}"`) && /ad/.test(t.text))).toBe(true));
    expect(router.current.name).not.toBe('job');
  });

  it('confirms and deletes an awaiting job with the trash icon of its card', async () => {
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

describe('Delete job (list)', () => {
  it('shows the trash icon only on jobs without an application', async () => {
    useDevBackend();
    render(JobsList);
    await screen.findByText('Android Developer');
    const rows = await api.listJobs();
    expect(rows.some((job) => job.application_count > 0)).toBe(true);
    for (const job of rows) {
      const icon = document.querySelector(`[data-ui="job.${job.id}.delete"]`);
      if (job.application_count === 0) expect(icon).not.toBeNull();
      else expect(icon).toBeNull();
    }
  });

  it('deletes a job without an application after the confirmation and shows a notice', async () => {
    const backend = useDevBackend();
    const created = await api.saveJob({ url: 'https://example.com/jobs/delete-me', text: 'Delete me\n\nA short ad text for the test.', overrides: { title: 'Delete me', company: 'Test Co' } });
    render(JobsList);
    await screen.findByText('Delete me');
    await fireEvent.click(document.querySelector(`[data-ui="job.${created.job.id}.delete"]`)!);
    const dialog = await screen.findByRole('dialog', { name: 'Delete job' });
    expect(within(dialog).getByText(/will be deleted together with its AI tasks/)).toBeInTheDocument();
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(backend.container.jobs.get(created.job.id)).toBeUndefined());
    expect(toasts.some((t) => t.kind === 'success' && t.text.startsWith('Job "Delete me" deleted'))).toBe(true);
  });

  it('moves the saved ad folder to the trash when the box is ticked, and keeps it when the box is cleared', async () => {
    const backend = useDevBackend();
    const first = await api.saveJob({ url: 'https://example.com/jobs/trash-me', text: 'Trash me\n\nA short ad text for the test.', overrides: { title: 'Trash me', company: 'Test Co' } });
    const second = await api.saveJob({ url: 'https://example.com/jobs/keep-me', text: 'Keep me\n\nA short ad text for the test.', overrides: { title: 'Keep me', company: 'Test Co' } });
    expect(backend.container.jobs.get(first.job.id)!.folder_url).not.toBe('');
    render(JobsList);
    await screen.findByText('Trash me');
    await fireEvent.click(document.querySelector(`[data-ui="job.${first.job.id}.delete"]`)!);
    let dialog = await screen.findByRole('dialog', { name: 'Delete job' });
    const box = within(dialog).getByLabelText(/Also move the folder with the saved ad/) as HTMLInputElement;
    expect(box.checked).toBe(true);
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(toasts.some((t) => t.text === 'Job "Trash me" deleted. The ad folder was moved to the Drive trash.')).toBe(true));

    await fireEvent.click(document.querySelector(`[data-ui="job.${second.job.id}.delete"]`)!);
    dialog = await screen.findByRole('dialog', { name: 'Delete job' });
    await fireEvent.click(within(dialog).getByLabelText(/Also move the folder with the saved ad/));
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(toasts.some((t) => t.text === 'Job "Keep me" deleted')).toBe(true));
  });
});
