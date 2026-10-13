import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
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

async function openStatuses(kind: 'jobs' | 'applications'): Promise<void> {
  await open('Statuses');
  if (kind === 'applications') await fireEvent.click(screen.getByRole('tab', { name: 'Application statuses' }));
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

  it('has separate Portfolio, LinkedIn, GitHub and personal website fields next to the other links, and saves them', async () => {
    await open('Profile');
    const card = section('Profile');
    await within(card).findByLabelText('Name');
    for (const key of ['portfolio', 'linkedin', 'github', 'website', 'links']) expect(card.querySelector(`[data-ui="settings.profile.${key}"]`)).not.toBeNull();
    expect(within(card).getByLabelText('Other links')).toBeInTheDocument();
    await fireEvent.input(within(card).getByLabelText('GitHub'), { target: { value: 'github.com/eva' } });
    await fireEvent.input(within(card).getByLabelText('Personal website'), { target: { value: 'eva.example.com' } });
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect(await api.getProfile()).toMatchObject({ github: 'github.com/eva', website: 'eva.example.com' }));
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
    await openStatuses('applications');
    const card = section('Labels and colours of application statuses');
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

  it('has one Statuses tab with a sub-tab for ads (jobs) and one for applications, and says which statuses each card is about', async () => {
    await open();
    expect(screen.queryByRole('tab', { name: 'Status labels' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Allowed status changes' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Ad statuses' })).toBeNull();
    await fireEvent.click(screen.getByRole('tab', { name: 'Statuses' }));
    const jobs = screen.getByRole('tab', { name: 'Ad (job) statuses' });
    const applications = screen.getByRole('tab', { name: 'Application statuses' });
    expect(jobs).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelector('[data-ui="settings.statuses.tabs"]')).not.toBeNull();
    expect(document.querySelector('[data-ui="settings.job-statuses"]')).not.toBeNull();
    expect(document.querySelector('[data-ui="settings.status-labels"]')).toBeNull();
    await fireEvent.click(applications);
    expect(applications).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelector('[data-ui="settings.job-statuses"]')).toBeNull();
    expect(document.querySelector('[data-ui="settings.statuses.applications.tabs"]')).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Labels and colours' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Labels and colours of application statuses' })).toBeInTheDocument();
    expect(document.querySelector('[data-ui="settings.transitions"]')).toBeNull();
    await fireEvent.click(screen.getByRole('tab', { name: 'Allowed changes' }));
    expect(screen.getByRole('heading', { name: 'Allowed status changes of applications' })).toBeInTheDocument();
    expect(document.querySelector('[data-ui="settings.status-labels"]')).toBeNull();
    await fireEvent.keyDown(applications, { key: 'ArrowLeft' });
    expect(jobs).toHaveAttribute('aria-selected', 'true');
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
    await fireEvent.click(within(card).getByRole('tab', { name: 'Cover letter' }));
    const letter = card.querySelector('[data-ui="settings.prompt.cover_letter"]') as HTMLTextAreaElement;
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
    await fireEvent.click(within(card).getByRole('tab', { name: 'Import' }));
    const field = card.querySelector('[data-ui="settings.prompt.import_job"]') as HTMLTextAreaElement;
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
    await openStatuses('applications');
    const card = section('Labels and colours of application statuses');
    await fireEvent.click(within(card).getByLabelText('Check the availability of ads in status Sent'));
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getSettings()).settings.status_styles).toEqual({ sent: { check: false } }));
  });
});

describe('Settings ad statuses', () => {
  it('adds a status of its own and then refuses to delete it while an ad uses it', async () => {
    await openStatuses('jobs');
    const card = section('Statuses of ads (jobs)');
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
    await openStatuses('jobs');
    const card = section('Statuses of ads (jobs)');
    await fireEvent.click(within(card).getByLabelText('Check the availability of ads in status No'));
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getSettings()).settings.job_status_styles.no?.check).toBe(true));
  });
});

describe('Settings: menu numbers', () => {
  const card = () => document.querySelector('[data-ui="settings.menu-refresh"]') as HTMLElement;
  const normal = () => document.querySelector('[data-ui="settings.menu-refresh.normal"]') as HTMLInputElement;
  const busy = () => document.querySelector('[data-ui="settings.menu-refresh.busy"]') as HTMLInputElement;
  const save = () => document.querySelector('[data-ui="settings.menu-refresh.save"]') as HTMLButtonElement;

  it('shows the current values and saves new ones with a notice', async () => {
    await open();
    expect(card()).not.toBeNull();
    expect(normal()).toHaveValue(60);
    expect(busy()).toHaveValue(15);
    await fireEvent.input(normal(), { target: { value: '120' } });
    await fireEvent.input(busy(), { target: { value: '0' } });
    await fireEvent.click(save());
    await waitFor(async () => {
      const settings = (await api.getSettings()).settings;
      expect(settings.menu_refresh_seconds).toBe(120);
      expect(settings.menu_refresh_busy_seconds).toBe(0);
    });
    await waitFor(() => expect(app.settings?.menu_refresh_seconds).toBe(120));
    expect(toasts.map((t) => t.text)).toContain('Menu numbers refresh every 120 s; off while AI tasks wait');
  });

  const alerts = () => within(card()).queryAllByRole('alert');
  const field = (el: HTMLElement) => el.closest('.field')!;

  it('rejects 1.5, 4, 3601 and empty under the right field, saves nothing, and clears the error on edit', async () => {
    await open();
    for (const bad of ['1.5', '4', '3601', '']) {
      await fireEvent.input(normal(), { target: { value: '60' } });
      await fireEvent.input(busy(), { target: { value: bad } });
      await fireEvent.click(save());
      await waitFor(() => expect(alerts()).toHaveLength(1));
      expect(field(busy())).toContainElement(alerts()[0]!);
      expect(field(normal()).querySelector('[role="alert"]')).toBeNull();
      expect((await api.getSettings()).settings.menu_refresh_busy_seconds).toBe(15);
      await fireEvent.input(normal(), { target: { value: '61' } });
      expect(alerts()).toHaveLength(0);
    }
    await fireEvent.input(normal(), { target: { value: '4' } });
    await fireEvent.click(save());
    await waitFor(() => expect(field(normal()).querySelector('[role="alert"]')).not.toBeNull());
    expect((await api.getSettings()).settings.menu_refresh_seconds).toBe(60);
  });

  it('accepts 0, 5 and 3600', async () => {
    await open();
    for (const good of ['0', '5', '3600']) {
      await fireEvent.input(normal(), { target: { value: good } });
      await fireEvent.input(busy(), { target: { value: good } });
      await fireEvent.click(save());
      await waitFor(async () => expect((await api.getSettings()).settings.menu_refresh_seconds).toBe(Number(good)));
      expect((await api.getSettings()).settings.menu_refresh_busy_seconds).toBe(Number(good));
      expect(alerts()).toHaveLength(0);
    }
  });

  it('says a zero value is off in the saved notice', async () => {
    await open();
    await fireEvent.input(normal(), { target: { value: '60' } });
    await fireEvent.input(busy(), { target: { value: '0' } });
    await fireEvent.click(save());
    await waitFor(() => expect(toasts.map((t) => t.text)).toContain('Menu numbers refresh every 60 s; off while AI tasks wait'));
    await fireEvent.input(normal(), { target: { value: '0' } });
    await fireEvent.input(busy(), { target: { value: '15' } });
    await fireEvent.click(save());
    await waitFor(() => expect(toasts.map((t) => t.text)).toContain('Menu numbers: no timed refresh, every 15 s while AI tasks wait'));
    await fireEvent.input(busy(), { target: { value: '0' } });
    await fireEvent.click(save());
    await waitFor(() => expect(toasts.map((t) => t.text)).toContain('Menu numbers refresh only when you return to the window'));
  });
});

describe('Settings: setup', () => {
  it('runs setup from a button and shows the verdict and the log lines in a dialog that closes', async () => {
    await open();
    expect(document.querySelector('[data-ui="settings.setup"]')).not.toBeNull();
    await fireEvent.click(document.querySelector('[data-ui="settings.setup.run"]') as HTMLElement);
    const dialog = await screen.findByRole('dialog', { name: 'Setup result' });
    expect(within(dialog).getByText('Setup finished: everything is OK.')).toBeInTheDocument();
    expect(dialog.querySelector('[data-ui="settings.setup-result.log"]')).toHaveTextContent('Setup started');
    expect(dialog.querySelector('[data-ui="settings.setup-result.log"]')).toHaveTextContent('Setup finished: OK');
    await fireEvent.click(dialog.querySelector('[data-ui="settings.setup-result.done"]') as HTMLElement);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('shows a failed setup as a failure with its lines', async () => {
    await open();
    const { vi } = await import('vitest');
    vi.spyOn(api, 'runSetup').mockResolvedValue({ ok: false, lines: ['Setup started', 'Setup failed: nope', 'Setup finished: NOT OK'] });
    await fireEvent.click(document.querySelector('[data-ui="settings.setup.run"]') as HTMLElement);
    const dialog = await screen.findByRole('dialog', { name: 'Setup result' });
    expect(within(dialog).getByText('Setup failed. See the last lines below.')).toBeInTheDocument();
    expect(dialog.querySelector('[data-ui="settings.setup-result.log"]')).toHaveTextContent('Setup failed: nope');
    vi.restoreAllMocks();
  });
});

describe('Settings: setup needed', () => {
  const navMark = () => document.querySelector('[data-ui="nav.setup-needed"]');
  const cardMark = () => document.querySelector('[data-ui="settings.setup.needed"]');

  it('shows no red mark in the menu or on the Setup card when setup is not needed', async () => {
    await open();
    expect(cardMark()).toBeNull();
    expect(navMark()).toBeNull();
  });

  it('shows a red exclamation mark by Settings in the menu and on the Setup card, and removes both after setup ran', async () => {
    useDevBackend({ setupNeeded: true });
    await loadApp();
    const { default: Shell } = await import('../layout/Shell.svelte');
    const { createRawSnippet } = await import('svelte');
    render(Shell, { children: createRawSnippet(() => ({ render: () => '<div></div>' })) });
    await waitFor(() => expect(navMark()).not.toBeNull());
    expect(navMark()).toHaveTextContent('!');
    expect(screen.getByRole('link', { name: 'Settings: setup needs to be run' })).toBeInTheDocument();
    cleanup();

    render(Settings);
    await screen.findByRole('heading', { name: 'Settings' });
    await waitFor(() => expect(cardMark()).not.toBeNull());
    expect(cardMark()).toHaveAttribute('aria-label', 'Setup needs to be run');
    expect(cardMark()!.getAttribute('title')).toContain('Sheet Jobs lacks the columns ai_salary');
    expect(document.querySelector('[data-ui="settings.setup.reasons"]')).toHaveTextContent('Sheet Jobs lacks the columns ai_salary');
    await fireEvent.click(document.querySelector('[data-ui="settings.setup.run"]') as HTMLElement);
    await screen.findByRole('dialog', { name: 'Setup result' });
    await waitFor(() => expect(cardMark()).toBeNull());
    expect(app.setupNeeded).toBe(false);
    expect(document.querySelector('[data-ui="settings.setup.reasons"]')).toBeNull();
  });
});

describe('Settings: AI prompt tabs', () => {
  it('has one sub-tab for each prompt, shows one prompt at a time, and keeps edits of the others when switching', async () => {
    await open('AI prompts');
    const card = section('AI prompts');
    const tabs = within(card).getAllByRole('tab').map((tab) => tab.getAttribute('data-ui'));
    expect(tabs).toEqual([
      'tab.prompts.resume_tailor', 'tab.prompts.cover_letter', 'tab.prompts.answer_question', 'tab.prompts.match_job', 'tab.prompts.other', 'tab.prompts.import_job',
    ]);
    expect(within(card).getAllByRole('tab').map((tab) => tab.textContent?.trim())).toEqual(['Resume', 'Cover letter', 'Questions', 'Job match', 'Document', 'Import']);
    expect(document.querySelectorAll('[data-ui^="settings.prompt."]:is(textarea)').length).toBe(1);
    const first = card.querySelector('[data-ui="settings.prompt.resume_tailor"]') as HTMLTextAreaElement;
    await fireEvent.input(first, { target: { value: 'My resume prompt {{document_id}}' } });
    await fireEvent.click(within(card).getByRole('tab', { name: 'Cover letter' }));
    expect(card.querySelector('[data-ui="settings.prompt.resume_tailor"]')).toBeNull();
    expect(card.querySelector('[data-ui="settings.prompt.cover_letter"]')).not.toBeNull();
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getSettings()).settings.ai_prompt_resume_tailor).toBe('My resume prompt {{document_id}}'));
  });
});
