import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { router } from '../lib/router.svelte';
import { toasts } from '../state/toast.svelte';
import { useDevBackend } from '../test/transport';
import AddJob from './AddJob.svelte';
import JobsList from './JobsList.svelte';

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
    expect(toasts.map((t) => t.text)).toContain('Job saved');
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
