import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { ui } from '../lib/i18n.svelte';
import { statusStyle } from '../lib/status';
import { PROMPTS_VERSION } from '@jobhunters/core';
import { app, loadApp, reloadSettings } from '../state/app.svelte';
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

  it('saves the calendar colors, keeps a color left at its default as no choice, and resets them', async () => {
    await open();
    const pick = (name: string): HTMLInputElement => document.querySelector(`[data-ui="settings.calendar-colors.${name}"]`) as HTMLInputElement;
    const click = (name: string): Promise<boolean> => fireEvent.click(document.querySelector(`[data-ui="settings.calendar-colors.${name}"]`)!);
    expect(pick('interview').value).toBe('#d9f1ee');
    await fireEvent.input(pick('interview'), { target: { value: '#112233' } });
    await click('save');
    await waitFor(async () => expect((await api.getSettings()).settings.ui_state.calendar_colors).toEqual({ interview: '#112233', waiting: '', late: '', homework: '' }));
    await click('reset');
    await waitFor(async () => expect((await api.getSettings()).settings.ui_state.calendar_colors).toEqual({ interview: '', waiting: '', late: '', homework: '' }));
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
    await waitFor(async () => expect(Object.keys((await api.getSettings()).settings.job_status_styles)).toHaveLength(6));
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

  const pick = (item: string, which: 'first' | 'second') => document.querySelector(`[data-ui="settings.menu-numbers.${item}.${which}"]`) as HTMLSelectElement;

  it('offers the numbers of every menu item, starts with the default ones and saves a choice at once', async () => {
    await open();
    expect(pick('jobs', 'first')).toHaveValue('new');
    expect(pick('jobs', 'second')).toHaveValue('');
    expect(pick('applications', 'first')).toHaveValue('draft');
    expect(pick('tasks', 'first')).toHaveValue('waiting');
    expect([...pick('jobs', 'first').options].map((o) => o.textContent)).toEqual(['(nothing)', 'New jobs', 'New jobs with no application', 'All jobs with no application', 'All jobs']);
    await fireEvent.change(pick('jobs', 'first'), { target: { value: 'new_no_application' } });
    await waitFor(async () => expect((await api.getSettings()).settings.menu_numbers.jobs).toEqual(['new_no_application']));
    await fireEvent.change(pick('jobs', 'second'), { target: { value: 'new' } });
    await waitFor(async () => expect((await api.getSettings()).settings.menu_numbers.jobs).toEqual(['new_no_application', 'new']));
    expect((await api.getSettings()).settings.menu_numbers.applications).toEqual(['draft']);
    expect(toasts.map((t) => t.text)).toContain('Menu numbers saved');
  });

  it('does not offer the first number again as the second one', async () => {
    await open();
    expect([...pick('jobs', 'second').options].map((o) => o.value)).not.toContain('new');
    await fireEvent.change(pick('jobs', 'first'), { target: { value: 'all' } });
    await waitFor(() => expect([...pick('jobs', 'second').options].map((o) => o.value)).toContain('new'));
    expect([...pick('jobs', 'second').options].map((o) => o.value)).not.toContain('all');
  });

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

describe('Settings: test data', () => {
  it('is always visible and its buttons make a numbered test job, with or without an application', async () => {
    await open();
    const card = document.querySelector('[data-ui="settings.test-data"]') as HTMLElement;
    expect(card).not.toBeNull();
    expect(document.querySelector('[data-ui="settings.help.test-data"]')).not.toBeNull();
    const before = (await api.listJobs()).length;
    await fireEvent.click(card.querySelector('[data-ui="settings.test-data.job"]') as HTMLElement);
    await waitFor(() => expect(card.querySelector('[data-ui="settings.test-data.created"]')).toHaveTextContent('Test job "test" created.'));
    expect(card.querySelector('[data-ui="settings.test-data.link"]')?.getAttribute('href')).toMatch(/^#\/jobs\//);
    await fireEvent.click(card.querySelector('[data-ui="settings.test-data.application"]') as HTMLElement);
    await waitFor(() => expect(card.querySelector('[data-ui="settings.test-data.created"]')).toHaveTextContent('Test job "test 2" and its application created.'));
    expect(card.querySelector('[data-ui="settings.test-data.link"]')?.getAttribute('href')).toMatch(/^#\/applications\//);
    expect((await api.listJobs()).length).toBe(before + 2);
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
  const navMark = () => document.querySelector('[data-ui="nav.action-needed"]');
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
    expect(screen.getByRole('link', { name: 'Settings: something needs your attention' })).toBeInTheDocument();
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
      'tab.prompts.resume_tailor', 'tab.prompts.cover_letter', 'tab.prompts.answer_question', 'tab.prompts.match_job', 'tab.prompts.other', 'tab.prompts.import_job', 'tab.prompts.import_match_job',
    ]);
    expect(within(card).getAllByRole('tab').map((tab) => tab.textContent?.trim())).toEqual(['Resume', 'Cover letter', 'Questions', 'Job match', 'Document', 'Import', 'Import + match']);
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

describe('Settings: prompts outdated', () => {
  const navMark = () => document.querySelector('[data-ui="nav.action-needed"]');
  const tabMark = (tab: string) => document.querySelector(`[data-ui="tab.${tab}.alert"]`);
  const banner = () => document.querySelector('[data-ui="settings.prompts.update"]');

  async function openPrompts(outdated: boolean): Promise<void> {
    useDevBackend({ promptsOutdated: outdated });
    await loadApp();
    render(Settings);
    await screen.findByRole('heading', { name: 'Settings' });
    await fireEvent.click(screen.getByRole('tab', { name: /^AI prompts/ }));
  }

  it('shows no mark and no notice when the prompts are current', async () => {
    await openPrompts(false);
    expect(banner()).toBeNull();
    expect(tabMark('prompts')).toBeNull();
    expect(app.settings?.ai_prompts_version).toBe(String(PROMPTS_VERSION));
  });

  it('marks the tab and shows what to do; "Reset all to default" takes the new prompts and clears it', async () => {
    await openPrompts(true);
    expect(tabMark('prompts')).not.toBeNull();
    expect(banner()).toHaveTextContent('The default AI prompts changed in this version.');
    expect(banner()).toHaveTextContent('Reset all to default');
    await fireEvent.click(document.querySelector('[data-ui="settings.prompts.update.reset"]') as HTMLElement);
    await waitFor(() => expect(banner()).toBeNull());
    expect(tabMark('prompts')).toBeNull();
    expect((await api.getSettings()).settings.ai_prompts_version).toBe(String(PROMPTS_VERSION));
    expect((await api.getSettings()).settings.ai_prompt_import_match_job).toContain('match_percent');
  });

  it('"Keep my prompts" clears the notice but leaves the own texts as they are', async () => {
    await openPrompts(true);
    await api.updateSettings({ ai_prompt_other: 'My own prompt {{document_id}}' });
    await reloadSettings();
    await fireEvent.click(document.querySelector('[data-ui="settings.prompts.update.keep"]') as HTMLElement);
    await waitFor(() => expect(banner()).toBeNull());
    expect((await api.getSettings()).settings).toMatchObject({ ai_prompts_version: String(PROMPTS_VERSION), ai_prompt_other: 'My own prompt {{document_id}}' });
  });

  it('puts the mark by Settings in the main menu', async () => {
    useDevBackend({ promptsOutdated: true });
    await loadApp();
    const { default: Shell } = await import('../layout/Shell.svelte');
    const { createRawSnippet } = await import('svelte');
    render(Shell, { children: createRawSnippet(() => ({ render: () => '<div></div>' })) });
    await waitFor(() => expect(navMark()).not.toBeNull());
    expect(screen.getByRole('link', { name: 'Settings: something needs your attention' })).toBeInTheDocument();
  });
});

const byUi = (root: ParentNode, id: string): HTMLElement => root.querySelector<HTMLElement>(`[data-ui="${id}"]`)!;
const DIALOG = 'settings.experience.history.dialog';

describe('Settings: text history', () => {
  afterEach(() => vi.restoreAllMocks());

  async function saveExperience(card: HTMLElement, text: string, count: number): Promise<void> {
    await fireEvent.input(within(card).getByLabelText('My experience'), { target: { value: text } });
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(within(card).getByRole('button', { name: `History (${count})` })).toBeInTheDocument());
  }

  it('counts the versions, shows them in two columns and restores an earlier one after a confirmation', async () => {
    await open('Experience');
    const card = section('My experience');
    expect(within(card).getByRole('button', { name: 'History (0)' })).toBeInTheDocument();
    await saveExperience(card, 'Version A', 2);
    await saveExperience(card, 'Version B', 3);

    await fireEvent.click(within(card).getByRole('button', { name: 'History (3)' }));
    const dialog = await screen.findByRole('dialog', { name: 'History: My experience' });
    expect(byUi(dialog, `${DIALOG}.text`).textContent).toBe('Version B');
    expect(within(dialog).getByRole('button', { name: 'Use This' })).toBeDisabled();

    await fireEvent.click(byUi(dialog, `${DIALOG}.item.2`));
    await fireEvent.click(within(dialog).getByRole('tab', { name: 'Text' }));
    expect(byUi(dialog, `${DIALOG}.text`).textContent).toBe('Version A');
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Use This' }));
    const confirm = await screen.findByRole('dialog', { name: 'Use this version?' });
    await fireEvent.click(within(confirm).getByRole('button', { name: 'Use this version' }));

    await waitFor(async () => expect((await api.getSettings()).settings.candidate_experience).toBe('Version A'));
    await waitFor(() => expect((within(card).getByLabelText('My experience') as HTMLTextAreaElement).value).toBe('Version A'));
    await waitFor(() => expect(within(card).getByRole('button', { name: 'History (4)' })).toBeInTheDocument());
  });

  it('saves a comment and a pin, and deletes an unpinned version after a confirmation', async () => {
    await open('Experience');
    const card = section('My experience');
    await saveExperience(card, 'Version A', 2);
    await saveExperience(card, 'Version B', 3);
    await saveExperience(card, 'Version C', 4);
    await fireEvent.click(within(card).getByRole('button', { name: 'History (4)' }));
    const dialog = await screen.findByRole('dialog', { name: 'History: My experience' });

    await fireEvent.click(byUi(dialog, `${DIALOG}.item.3`));
    await fireEvent.input(byUi(dialog, `${DIALOG}.comment`), { target: { value: 'Sent to Acme' } });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Save comment' }));
    await waitFor(() => expect(byUi(dialog, `${DIALOG}.item.3`).textContent).toContain('Sent to Acme'));

    await fireEvent.click(byUi(dialog, `${DIALOG}.pin`));
    await waitFor(() => expect(byUi(dialog, `${DIALOG}.item.3`).textContent).toContain('Pinned'));
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeDisabled();

    await fireEvent.click(byUi(dialog, `${DIALOG}.item.2`));
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByText('Delete version #2 permanently?');
    await fireEvent.click(within(confirm.closest('[role="dialog"]') as HTMLElement).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(byUi(dialog, `${DIALOG}.item.2`)).toBeNull());
    expect(byUi(dialog, `${DIALOG}.item.1`)).not.toBeNull();
  });

  it('explains why a save is refused when the history is full, and keeps the typed text', async () => {
    await open();
    await api.updateSettings({ history_max_versions: '1' });
    await api.updateSettings({ candidate_experience: 'Version A' });
    await reloadSettings();
    await fireEvent.click(screen.getByRole('tab', { name: 'Experience' }));
    const card = section('My experience');
    await fireEvent.input(within(card).getByLabelText('My experience'), { target: { value: 'Version B' } });
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toasts.map((t) => t.text).join(' ')).toContain('History of My experience is full (1 of 1 unpinned versions)'));
    expect((within(card).getByLabelText('My experience') as HTMLTextAreaElement).value).toBe('Version B');
    expect((await api.getSettings()).settings.candidate_experience).toBe('Version A');
  });

  it('saves the history limit in General settings and rejects an invalid one', async () => {
    await open();
    const card = section('Text history');
    const field = within(card).getByLabelText('Most unpinned versions kept per text');
    await fireEvent.input(field, { target: { value: '0' } });
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    expect(await within(card).findByText('Enter a whole number from 1 to 1000.')).toBeInTheDocument();
    await fireEvent.input(field, { target: { value: '20' } });
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getSettings()).settings.history_max_versions).toBe(20));
  });
  it('does not call the newest version current when the live text was edited outside the app, and lets the user restore it', async () => {
    await open('Experience');
    const card = section('My experience');
    await saveExperience(card, 'Version A', 2);
    await saveExperience(card, 'Version B', 3);
    const real = await api.listHistory('candidate_experience');
    vi.spyOn(api, 'listHistory').mockResolvedValue({ ...real, live: 'Edited in the sheet' });
    await fireEvent.click(within(card).getByRole('button', { name: 'History (3)' }));
    const dialog = await screen.findByRole('dialog', { name: 'History: My experience' });
    expect(within(dialog).queryByText('Current')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Use This' })).toBeEnabled();
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeDisabled();
  });
  it('shows what changes against the current text when an older version is selected, and the whole text on the other tab', async () => {
    await open('Experience');
    const card = section('My experience');
    await saveExperience(card, 'Line one\nLine two', 2);
    await saveExperience(card, 'Line one\nLine three', 3);
    await fireEvent.click(within(card).getByRole('button', { name: 'History (3)' }));
    const dialog = await screen.findByRole('dialog', { name: 'History: My experience' });

    expect(within(dialog).queryByRole('tab', { name: 'Changes' })).toBeNull();
    expect(byUi(dialog, `${DIALOG}.text`).textContent).toBe('Line one\nLine three');

    await fireEvent.click(byUi(dialog, `${DIALOG}.item.2`));
    const diff = byUi(dialog, `${DIALOG}.diff`);
    expect(diff.querySelector('[data-kind="removed"]')!.textContent).toContain('Line three');
    expect(diff.querySelector('[data-kind="added"]')!.textContent).toContain('Line two');
    expect(byUi(dialog, `${DIALOG}.diff.summary`).textContent).toBe('Lines added: 1, removed: 1 (compared with the current text)');
    expect(byUi(dialog, `${DIALOG}.text`)).toBeNull();

    await fireEvent.click(within(dialog).getByRole('tab', { name: 'Text' }));
    expect(byUi(dialog, `${DIALOG}.text`).textContent).toBe('Line one\nLine two');
    expect(byUi(dialog, `${DIALOG}.diff`)).toBeNull();

    await fireEvent.click(byUi(dialog, `${DIALOG}.item.3`));
    expect(within(dialog).queryByRole('tab', { name: 'Changes' })).toBeNull();
  });

  it('folds long runs of equal lines and shows them on request', async () => {
    await open('Experience');
    const card = section('My experience');
    const same = Array.from({ length: 8 }, (_, i) => `Same ${i}`).join('\n');
    await saveExperience(card, `${same}\nOld`, 2);
    await saveExperience(card, `${same}\nNew`, 3);
    await fireEvent.click(within(card).getByRole('button', { name: 'History (3)' }));
    const dialog = await screen.findByRole('dialog', { name: 'History: My experience' });
    await fireEvent.click(byUi(dialog, `${DIALOG}.item.2`));
    expect(within(dialog).getByText('7 equal lines')).toBeInTheDocument();
    expect(dialog.textContent).not.toContain('Same 0');
    await fireEvent.click(byUi(dialog, `${DIALOG}.diff.show-all`));
    expect(dialog.textContent).toContain('Same 0');
    expect(within(dialog).queryByText('7 equal lines')).toBeNull();
  });

  it('says so when the selected version has no difference from the current text', async () => {
    await open('Experience');
    const card = section('My experience');
    await saveExperience(card, 'Same text', 2);
    await saveExperience(card, 'Other text', 3);
    await saveExperience(card, 'Same text', 4);
    await fireEvent.click(within(card).getByRole('button', { name: 'History (4)' }));
    const dialog = await screen.findByRole('dialog', { name: 'History: My experience' });
    await fireEvent.click(byUi(dialog, `${DIALOG}.item.2`));
    expect(within(dialog).getByText('No difference from the current text.')).toBeInTheDocument();
  });
});

describe('Settings: history of AI prompts and offline texts', () => {
  afterEach(() => vi.restoreAllMocks());

  const prompt = (card: HTMLElement, type: string) => card.querySelector(`[data-ui="settings.prompt.${type}"]`) as HTMLTextAreaElement;

  async function savePrompt(card: HTMLElement, type: string, text: string, count: number): Promise<void> {
    await fireEvent.input(prompt(card, type), { target: { value: text } });
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(within(card).getByRole('button', { name: `History (${count})` })).toBeInTheDocument());
  }

  it('keeps a history for each prompt: the button belongs to the prompt on the open tab', async () => {
    await open('AI prompts');
    const card = section('AI prompts');
    expect(within(card).getByRole('button', { name: 'History (0)' })).toBeInTheDocument();
    await savePrompt(card, 'resume_tailor', 'My resume prompt {{document_id}}', 2);
    await fireEvent.click(within(card).getByRole('tab', { name: 'Cover letter' }));
    expect(within(card).getByRole('button', { name: 'History (0)' })).toBeInTheDocument();
    await fireEvent.click(within(card).getByRole('tab', { name: 'Resume' }));
    await fireEvent.click(within(card).getByRole('button', { name: 'History (2)' }));
    expect(await screen.findByRole('dialog', { name: 'History: Tailoring the resume' })).toBeInTheDocument();
  });

  it('restores one prompt without losing the unsaved edits of another prompt', async () => {
    await open('AI prompts');
    const card = section('AI prompts');
    await savePrompt(card, 'resume_tailor', 'Resume A {{document_id}}', 2);
    await savePrompt(card, 'resume_tailor', 'Resume B {{document_id}}', 3);
    await fireEvent.click(within(card).getByRole('tab', { name: 'Cover letter' }));
    await fireEvent.input(prompt(card, 'cover_letter'), { target: { value: 'Unsaved cover letter' } });
    await fireEvent.click(within(card).getByRole('tab', { name: 'Resume' }));

    await fireEvent.click(within(card).getByRole('button', { name: 'History (3)' }));
    const dialog = await screen.findByRole('dialog', { name: 'History: Tailoring the resume' });
    await fireEvent.click(byUi(dialog, 'settings.prompt.resume_tailor.history.dialog.item.2'));
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Use This' }));
    const confirm = await screen.findByRole('dialog', { name: 'Use this version?' });
    await fireEvent.click(within(confirm).getByRole('button', { name: 'Use this version' }));

    await waitFor(async () => expect((await api.getSettings()).settings.ai_prompt_resume_tailor).toBe('Resume A {{document_id}}'));
    await waitFor(() => expect(prompt(card, 'resume_tailor').value).toBe('Resume A {{document_id}}'));
    await fireEvent.click(within(card).getByRole('tab', { name: 'Cover letter' }));
    expect(prompt(card, 'cover_letter').value).toBe('Unsaved cover letter');
  });

  it('records the reset to the defaults in the history of the prompts that changed', async () => {
    await open('AI prompts');
    const card = section('AI prompts');
    await savePrompt(card, 'resume_tailor', 'My resume prompt {{document_id}}', 2);
    await fireEvent.click(within(card).getByRole('button', { name: 'Reset all to default' }));
    await waitFor(() => expect(within(card).getByRole('button', { name: 'History (3)' })).toBeInTheDocument());
    await fireEvent.click(within(card).getByRole('button', { name: 'History (3)' }));
    const dialog = await screen.findByRole('dialog', { name: 'History: Tailoring the resume' });
    expect(byUi(dialog, 'settings.prompt.resume_tailor.history.dialog.item.3').textContent).toContain('Reset to default');
  });

  it('names the prompt whose history is full when nothing could be saved', async () => {
    await open();
    await api.updateSettings({ history_max_versions: '1' });
    await api.updateSettings({ ai_prompt_resume_tailor: 'Resume A {{document_id}}' });
    await reloadSettings();
    await fireEvent.click(screen.getByRole('tab', { name: 'AI prompts' }));
    const card = section('AI prompts');
    await fireEvent.input(prompt(card, 'resume_tailor'), { target: { value: 'Resume B {{document_id}}' } });
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toasts.map((t) => t.text).join(' ')).toContain('History of Tailoring the resume is full (1 of 1 unpinned versions)'));
    expect((await api.getSettings()).settings.ai_prompt_resume_tailor).toBe('Resume A {{document_id}}');
  });

  it('keeps a history of the texts that mean an ad is gone, next to the availability settings', async () => {
    await open('Availability');
    const card = section('Availability of ads');
    const history = () => byUi(card, 'settings.offline-texts.history');
    expect(history().textContent).toContain('History (0)');
    await fireEvent.input(byUi(card, 'settings.offline-texts'), { target: { value: 'gone' } });
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(history().textContent).toContain('History (2)'));
    await fireEvent.click(history());
    expect(await screen.findByRole('dialog', { name: 'History: Texts that mean the ad is gone (one per line)' })).toBeInTheDocument();
  });
});
