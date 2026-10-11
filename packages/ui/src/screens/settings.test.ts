import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { api } from '../api';
import { ui } from '../lib/i18n.svelte';
import { statusStyle } from '../lib/status';
import { loadApp } from '../state/app.svelte';
import { toasts } from '../state/toast.svelte';
import { useDevBackend } from '../test/transport';
import Settings from './Settings.svelte';

async function open(): Promise<void> {
  useDevBackend();
  await loadApp();
  render(Settings);
  await screen.findByRole('heading', { name: 'Settings' });
}

const section = (name: string): HTMLElement => screen.getByRole('heading', { name }).closest('section')!;

describe('Settings', () => {
  it('switches the language of the app immediately after saving', async () => {
    await open();
    const card = section('Language');
    await fireEvent.change(within(card).getByLabelText('Language of the app'), { target: { value: 'cs' } });
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(ui.locale).toBe('cs'));
    expect(await screen.findByRole('heading', { name: 'Nastavení' })).toBeInTheDocument();
    expect((await api.getSettings()).settings.ui_language).toBe('cs');
  });

  it('saves the documents created with a new application', async () => {
    await open();
    const card = section('Documents');
    await fireEvent.click(within(card).getByLabelText('Cover letter'));
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getSettings()).settings.default_document_set).toEqual(['resume']));
  });

  it('shows and saves the profile', async () => {
    await open();
    const card = section('Profile');
    const name = await within(card).findByLabelText('Name');
    await waitFor(() => expect(name).toHaveValue('Eva Example'));
    await fireEvent.input(name, { target: { value: 'Eva Changed' } });
    await fireEvent.input(within(card).getByLabelText('Phone'), { target: { value: '+420 111 222 333' } });
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect(await api.getProfile()).toMatchObject({ name: 'Eva Changed', phone: '+420 111 222 333' }));
  });

  it('lists templates and registers a new one, refusing an address that is not a Google Doc', async () => {
    await open();
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
    await open();
    const card = section('Status labels');
    const row = within(card).getByRole('group', { name: 'Sent' });
    await fireEvent.input(within(row).getByLabelText('Text for Sent'), { target: { value: 'Applied' } });
    await fireEvent.input(within(row).getByLabelText('Colour for Sent'), { target: { value: '#fde68a' } });
    expect(within(row).getByText('Applied')).toHaveStyle({ backgroundColor: '#fde68a', color: '#111111' });
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(statusStyle('sent').text).toBe('Applied'));
    expect((await api.getSettings()).settings.status_styles).toEqual({ sent: { text: { en: 'Applied' }, color: '#fde68a' } });

    await fireEvent.click(within(within(card).getByRole('group', { name: 'Sent' })).getByRole('button', { name: 'Reset to default' }));
    await fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(statusStyle('sent').text).toBe('Sent'));
    expect((await api.getSettings()).settings.status_styles).toEqual({});
  });

  it('shows the version', async () => {
    await open();
    expect(screen.getByText('Version dev')).toBeInTheDocument();
  });
});

describe('Settings identifier labels', () => {
  it('switches the element identifiers on and off', async () => {
    await open();
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
