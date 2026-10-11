import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { api } from '../api';
import { toasts } from '../state/toast.svelte';
import { useDevBackend } from '../test/transport';
import CompaniesList from './CompaniesList.svelte';
import CompanyDetail from './CompanyDetail.svelte';

describe('CompaniesList', () => {
  it('lists companies with their counts and filters by name', async () => {
    useDevBackend();
    render(CompaniesList);
    const row = (await screen.findByText('Example s.r.o.')).closest('a')!;
    expect(row).toHaveAttribute('href', expect.stringMatching(/^#\/companies\//));
    expect(row).toHaveTextContent('1 job');
    expect(row).toHaveTextContent('1 application');
    await fireEvent.input(screen.getByLabelText('Search'), { target: { value: 'sample' } });
    expect(screen.queryByText('Example s.r.o.')).toBeNull();
    expect(screen.getByText('Sample GmbH')).toBeInTheDocument();
  });

  it('shows hostile company names as text', async () => {
    useDevBackend();
    render(CompaniesList);
    expect(await screen.findByText('Hostile <b>Corp</b>')).toBeInTheDocument();
    expect(document.querySelector('b')).toBeNull();
  });

  it('explains an empty list', async () => {
    useDevBackend({ seed: false });
    render(CompaniesList);
    expect(await screen.findByText('No companies yet')).toBeInTheDocument();
  });
});

describe('CompanyDetail', () => {
  async function idOf(name: string): Promise<string> {
    return (await api.listCompanies()).find((company) => company.name === name)!.id;
  }

  it('shows the jobs and applications of the company and saves edits', async () => {
    useDevBackend();
    const id = await idOf('Example s.r.o.');
    render(CompanyDetail, { id });
    expect(await screen.findByRole('link', { name: 'Android Developer' })).toBeInTheDocument();
    await fireEvent.input(screen.getByLabelText('Website'), { target: { value: 'https://example.com' } });
    await fireEvent.input(screen.getByLabelText('Notes'), { target: { value: 'Friendly team' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getCompany(id)).company).toMatchObject({ website: 'https://example.com', notes: 'Friendly team' }));
    expect(toasts.map((t) => t.text)).toContain('Saved');
  });

  it('refuses an empty name and a website that is not a web address', async () => {
    useDevBackend();
    const id = await idOf('Example s.r.o.');
    render(CompanyDetail, { id });
    await fireEvent.input(await screen.findByLabelText('Name'), { target: { value: '  ' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toasts.some((t) => /Enter the company name/.test(t.text))).toBe(true));
    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Example s.r.o.' } });
    await fireEvent.input(screen.getByLabelText('Website'), { target: { value: 'javascript:alert(1)' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toasts.some((t) => /must be a web address/.test(t.text))).toBe(true));
    expect((await api.getCompany(id)).company.website).toBe('');
  });

  it('shows an error block for a company that does not exist', async () => {
    useDevBackend();
    render(CompanyDetail, { id: 'ghost' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Company ghost was not found.');
  });
});
