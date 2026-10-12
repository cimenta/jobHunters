import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { api } from '../api';
import { ui } from '../lib/i18n.svelte';
import { statusStyle } from '../lib/status';
import { app, loadApp } from '../state/app.svelte';
import { toasts } from '../state/toast.svelte';
import { useDevBackend } from '../test/transport';
import Settings from './Settings.svelte';

async function open(tab?: string): Promise<void> {
  useDevBackend();
  await loadApp();
  render(Settings);
  await screen.findByRole('heading', { name: 'Settings' });
  if (tab) await fireEvent.click(screen.getByRole('tab', { name: tab }));
}

const section = (name: string): HTMLElement => screen.getByRole('heading', { name }).closest('section')!;

describe('Settings', () => {
  it('switches the language of the app immediately after saving', async () => {
    await open();
    const card = section('Language');
    await fireEvent.change(within(card).getByLabelText('Language of the app'), { target: { value: 'cs' } });
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(ui.locale).toBe('cs'));
    await waitFor(() => expect(toasts.map((t) => t.text)).toContain('Jazykové nastavení uloženo'));
    expect(await screen.findByRole('heading', { name: 'Nastavení' })).toBeInTheDocument();
    expect((await api.getSettings()).settings.ui_language).toBe('cs');
  });

  it('switches the result notices off and on', async () => {
    await open();
    await fireEvent.click(screen.getByLabelText('Show a notice when an operation finishes'));
    await fireEvent.click(within(section('Notices')).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getSettings()).settings.result_notices).toBe(false));
    await waitFor(() => expect(app.settings?.result_notices).toBe(false));
    const before = toasts.length;
    await fireEvent.click(within(section('Appearance')).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getSettings()).settings.ui_theme).toBe('system'));
    expect(toasts.length).toBe(before);
  });

  it('saves the documents created with a new application', async () => {
    await open('Documents');
    const card = section('Documents');
    await fireEvent.click(within(card).getByLabelText('Cover letter'));
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getSettings()).settings.default_document_set).toEqual(['resume']));
  });

  it('shows and saves the profile', async () => {
    await open('Profile');
    const card = section('Profile');
    const name = await within(card).findByLabelText('Name');
    await waitFor(() => expect(name).toHaveValue('Eva Example'));
    await fireEvent.input(name, { target: { value: 'Eva Changed' } });
    await fireEvent.input(within(card).getByLabelText('Phone'), { target: { value: '+420 111 222 333' } });
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect(await api.getProfile()).toMatchObject({ name: 'Eva Changed', phone: '+420 111 222 333' }));
  });

  it('lists templates and registers a new one, refusing an address that is not a Google Doc', async () => {
    await open('Templates');
    const card = section('Templates');
    const list = await within(card).findByRole('list');
    expect(within(list).getByText('Cover letter')).toBeInTheDocument();
    await fireEvent.change(within(card).getByLabelText('Type'), { target: { value: 'other' } });
    await fireEvent.input(within(card).getByLabelText('Template name'), { target: { value: 'Portfolio' } });
    await fireEvent.input(within(card).getByLabelText('Address of the Google Doc'), { target: { value: 'https://example.com/nothing' } });
    await fireEvent.click(within(card).getByRole('button', { name: 'Add template' }));
    await waitFor(() => expect(toasts.some((t) => /needs a name, a valid type/.test(t.text))).toBe(true));
    await fireEvent.input(within(card).getByLabelText('Address of the Google Doc'), { target: { value: 'https://docs.google.com/document/d/1AbC/edit' } });
    await fireEvent.click(within(card).getByRole('button', { name: 'Add template' }));
    expect(await within(await within(card).findByRole('list')).findByText('Portfolio')).toBeInTheDocument();
  });

  it('edits the text and colour of a status, applies it everywhere and can reset it', async () => {
    await open('Status labels');
    const card = section('Status labels');
    const row = within(card).getByRole('group', { name: 'Sent' });
    await fireEvent.input(within(row).getByLabelText('Text for Sent'), { target: { value: 'Applied' } });
    await fireEvent.input(within(row).getByLabelText('Colour for Sent'), { target: { value: '#fde68a' } });
    expect(within(row).getByText('Applied')).toHaveStyle({ backgroundColor: '#fde68a', color: '#111111' });
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(statusStyle('sent').text).toBe('Applied'));
    await waitFor(() => expect(toasts.map((t) => t.text)).toContain('Status labels saved'));
    expect((await api.getSettings()).settings.status_styles).toEqual({ sent: { text: { en: 'Applied' }, color: '#fde68a' } });

    await fireEvent.click(within(within(card).getByRole('group', { name: 'Sent' })).getByRole('button', { name: 'Reset to default' }));
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(statusStyle('sent').text).toBe('Sent'));
    expect((await api.getSettings()).settings.status_styles).toEqual({});
  });

  it('keeps status labels and allowed changes on separate tabs', async () => {
    await open('Status labels');
    expect(document.querySelector('[data-ui="settings.status-labels"]')).not.toBeNull();
    expect(document.querySelector('[data-ui="transitions"]')).toBeNull();
    await fireEvent.click(screen.getByRole('tab', { name: 'Allowed status changes' }));
    expect(document.querySelector('[data-ui="transitions"]')).not.toBeNull();
    expect(document.querySelector('[data-ui="settings.status-labels"]')).toBeNull();
  });

  it('saves the colour mode and applies it at once', async () => {
    await open();
    const card = section('Appearance');
    await fireEvent.change(within(card).getByLabelText('Colour mode'), { target: { value: 'dark' } });
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    expect((await api.getSettings()).settings.ui_theme).toBe('dark');
    expect(toasts.map((t) => t.text)).toContain('Appearance saved (colour mode: Dark)');
    await fireEvent.change(within(card).getByLabelText('Colour mode'), { target: { value: 'system' } });
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBeUndefined());
  });

  it('saves the description of the experience used for the match evaluation', async () => {
    await open('Experience');
    const card = section('My experience');
    await fireEvent.input(within(card).getByLabelText('My experience'), { target: { value: 'Ten years of Kotlin' } });
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getSettings()).settings.candidate_experience).toBe('Ten years of Kotlin'));
  });

  it('edits the whole AI prompts and resets them to the defaults', async () => {
    await open('AI prompts');
    const card = section('AI prompts');
    const letter = within(card).getByLabelText('Writing the cover letter');
    expect((letter as HTMLTextAreaElement).value).toContain('{{document_id}}');
    await fireEvent.input(letter, { target: { value: 'Write the letter into {{document_id}}.' } });
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getSettings()).settings.ai_prompt_cover_letter).toBe('Write the letter into {{document_id}}.'));
    await fireEvent.click(within(card).getByRole('button', { name: 'Reset all to default' }));
    await waitFor(async () => expect((await api.getSettings()).settings.ai_prompt_cover_letter).toMatch(/at most 250 words/));
    await waitFor(() => expect((letter as HTMLTextAreaElement).value).toMatch(/at most 250 words/));
  });

  it('edits the prompt for importing a job ad and resets it with the others', async () => {
    await open('AI prompts');
    const card = section('AI prompts');
    const field = within(card).getByLabelText('Importing a job ad from a link') as HTMLTextAreaElement;
    expect(field.value.length).toBeGreaterThan(20);
    await fireEvent.input(field, { target: { value: 'Import {{url}} as job {{job_id}}.' } });
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getSettings()).settings.ai_prompt_import_job).toBe('Import {{url}} as job {{job_id}}.'));
    await fireEvent.click(within(card).getByRole('button', { name: 'Reset all to default' }));
    await waitFor(() => expect(field.value).not.toBe('Import {{url}} as job {{job_id}}.'));
    await waitFor(async () => expect((await api.getSettings()).settings.ai_prompt_import_job).not.toBe('Import {{url}} as job {{job_id}}.'));
  });

  it('shows the version', async () => {
    await open('About');
    expect(screen.getByText('Version dev')).toBeInTheDocument();
  });
});

describe('Settings identifier labels', () => {
  it('switches the element identifiers on and off', async () => {
    await open('About');
    const { ids } = await import('../state/ids.svelte');
    const box = within(section('About')).getByLabelText('Show element IDs');
    expect(box).not.toBeChecked();
    await fireEvent.click(box);
    expect(ids.visible).toBe(true);
    expect(box).toBeChecked();
    await fireEvent.click(box);
    expect(ids.visible).toBe(false);
  });
});

describe('Settings availability', () => {
  it('saves the schedule, the immediate rules and the offline texts', async () => {
    await open('Availability');
    const card = section('Availability of ads');
    await fireEvent.click(within(card).getByLabelText('Check the availability regularly'));
    await fireEvent.input(within(card).getByLabelText('Hours of the check'), { target: { value: '8, 18' } });
    await fireEvent.click(within(card).getByLabelText('the page is not found (404 or 410)'));
    await fireEvent.input(within(card).getByLabelText('Texts that mean the ad is gone (one per line)'), { target: { value: 'gone\nclosed' } });
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(async () => {
      const settings = (await api.getSettings()).settings;
      expect(settings).toMatchObject({ availability_check_enabled: true, availability_check_hours: [8, 18], offline_texts: ['gone', 'closed'] });
      expect([...settings.availability_immediate_rules].sort()).toEqual(['http_gone', 'offline_text']);
    });
  });

  it('refuses invalid hours with a message and keeps the old setting', async () => {
    await open('Availability');
    const card = section('Availability of ads');
    await fireEvent.input(within(card).getByLabelText('Hours of the check'), { target: { value: '25' } });
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toasts.some((t) => t.kind === 'error')).toBe(true));
    expect((await api.getSettings()).settings.availability_check_hours).toEqual([18]);
  });

  it('saves the availability flag of a status', async () => {
    await open('Status labels');
    const card = section('Status labels');
    await fireEvent.click(within(card).getByLabelText('Check the availability of ads in status Sent'));
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getSettings()).settings.status_styles).toEqual({ sent: { check: false } }));
  });
});

describe('Settings ad statuses', () => {
  it('adds a status of its own and then refuses to delete it while an ad uses it', async () => {
    await open('Ad statuses');
    const card = section('Statuses of ads');
    await fireEvent.input(within(card).getByLabelText('Name of a new status'), { target: { value: 'Maybe' } });
    await fireEvent.click(within(card).getByRole('button', { name: 'Add status' }));
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect(Object.keys((await api.getSettings()).settings.job_status_styles)).toHaveLength(4));
    const code = Object.keys((await api.getSettings()).settings.job_status_styles).find((key) => key.startsWith('s_'))!;
    const job = (await api.listJobs())[0]!;
    await api.updateJob(job.id, { status: code });
    await fireEvent.click(within(card).getByRole('button', { name: 'Delete' }));
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toasts.some((t) => /still use this status/.test(t.text))).toBe(true));
    expect(Object.keys((await api.getSettings()).settings.job_status_styles)).toContain(code);
  });

  it('saves the availability flag of a built-in ad status', async () => {
    await open('Ad statuses');
    const card = section('Statuses of ads');
    await fireEvent.click(within(card).getByLabelText('Check the availability of ads in status No'));
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getSettings()).settings.job_status_styles.no?.check).toBe(true));
  });
});
