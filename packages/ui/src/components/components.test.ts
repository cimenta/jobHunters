import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { parseSettings } from '@jobhunters/core';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { setLocale } from '../lib/i18n.svelte';
import { navigate } from '../lib/router.svelte';
import { app } from '../state/app.svelte';
import { toasts } from '../state/toast.svelte';
import { api } from '../api';
import ApplicationsScreen from '../screens/ApplicationsScreen.svelte';
import JobsScreen from '../screens/JobsScreen.svelte';
import TabsProbe from '../test/TabsProbe.svelte';
import { useDevBackend } from '../test/transport';
import Button from './Button.svelte';
import Dialog from './Dialog.svelte';
import EmptyState from './EmptyState.svelte';
import ErrorBlock from './ErrorBlock.svelte';
import Field from './Field.svelte';
import StatusBadge from './StatusBadge.svelte';
import ToastHost from './ToastHost.svelte';
import WarningList from './WarningList.svelte';

const text = (content: string) => createRawSnippet(() => ({ render: () => `<span>${content}</span>` }));

describe('Button', () => {
  it('runs the handler once while it is busy and shows an error toast when it fails', async () => {
    toasts.length = 0;
    let calls = 0;
    const onclick = () => {
      calls++;
      return new Promise((_, reject) => setTimeout(() => reject(new ApiError('row_not_found', { id: 'x' })), 10));
    };
    render(Button, { onclick, children: text('Go') });
    const button = screen.getByRole('button', { name: 'Go' });
    await fireEvent.click(button);
    await fireEvent.click(button);
    expect(calls).toBe(1);
    expect(button).toBeDisabled();
    await waitFor(() => expect(button).toBeEnabled());
    expect(toasts.map((t) => t.text)).toEqual(['Row x was not found.']);
  });

  it('works with a synchronous handler and honours disabled', async () => {
    const onclick = vi.fn();
    const { rerender } = render(Button, { onclick, children: text('Go') });
    await fireEvent.click(screen.getByRole('button'));
    expect(onclick).toHaveBeenCalledTimes(1);
    await rerender({ onclick, disabled: true, children: text('Go') });
    await fireEvent.click(screen.getByRole('button'));
    expect(onclick).toHaveBeenCalledTimes(1);
  });
});

describe('Button tooltip', () => {
  it('shows the accessible name of an icon-only button as a hover tooltip', () => {
    render(Button, { label: 'Check availability', children: text('i') });
    const button = screen.getByRole('button', { name: 'Check availability' });
    expect(button).toHaveAttribute('title', 'Check availability');
  });

  it('has no tooltip when the button has visible text only', () => {
    render(Button, { children: text('Save') });
    expect(screen.getByRole('button', { name: 'Save' })).not.toHaveAttribute('title');
  });
});

describe('Field', () => {
  it('connects label, hint and error to the control', () => {
    render(Field, { label: 'Title', for: 'title', hint: 'Shown in lists', error: 'Required', children: createRawSnippet(() => ({ render: () => '<input id="title" />' })) });
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
    expect(screen.getByText('Shown in lists')).toBeInTheDocument();
  });
});

describe('StatusBadge', () => {
  it('shows the catalog text and a readable colour by default', () => {
    app.settings = parseSettings({}).settings;
    setLocale('en');
    render(StatusBadge, { status: 'sent' });
    const badge = screen.getByText('Sent');
    expect(badge).toHaveStyle({ backgroundColor: '#2563eb', color: '#ffffff' });
  });

  it('applies the user-defined text and colour and picks a readable text colour', () => {
    app.settings = parseSettings({ status_styles: '{"sent":{"text":{"en":"Applied"},"color":"#fde68a"}}' }).settings;
    setLocale('en');
    render(StatusBadge, { status: 'sent' });
    expect(screen.getByText('Applied')).toHaveStyle({ backgroundColor: '#fde68a', color: '#111111' });
  });

  it('still renders a status that is unknown', () => {
    app.settings = parseSettings({}).settings;
    render(StatusBadge, { status: 'weird' });
    expect(screen.getByText('weird')).toBeInTheDocument();
  });
});

describe('Dialog', () => {
  it('renders only when open, labels itself and closes with Escape and with the close button', async () => {
    const onclose = vi.fn();
    const { rerender } = render(Dialog, { open: false, title: 'Edit', onclose, children: text('Body') });
    expect(screen.queryByRole('dialog')).toBeNull();
    await rerender({ open: true, title: 'Edit', onclose, children: text('Body') });
    expect(screen.getByRole('dialog', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onclose).toHaveBeenCalledTimes(1);
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onclose).toHaveBeenCalledTimes(2);
  });
});

describe('Tabs', () => {
  it('switches the active tab by click and by arrow keys', async () => {
    render(TabsProbe);
    expect(screen.getByRole('tab', { name: /First/ })).toHaveAttribute('aria-selected', 'true');
    await fireEvent.click(screen.getByRole('tab', { name: /Second/ }));
    expect(screen.getByRole('tab', { name: /Second/ })).toHaveAttribute('aria-selected', 'true');
    await fireEvent.keyDown(screen.getByRole('tab', { name: /Second/ }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /Third/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('active')).toHaveTextContent('c');
  });
});

describe('ErrorBlock', () => {
  it('shows a translated message and offers to try again', async () => {
    const onretry = vi.fn();
    render(ErrorBlock, { error: new ApiError('transport_failed'), onretry });
    expect(screen.getByRole('alert')).toHaveTextContent('did not answer');
    await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onretry).toHaveBeenCalled();
  });
  it('never prints a technical message', () => {
    render(ErrorBlock, { error: new Error('TypeError: x is undefined') });
    expect(screen.getByRole('alert')).not.toHaveTextContent('TypeError');
  });
});

describe('EmptyState, WarningList, ToastHost', () => {
  it('shows title, text and the action', () => {
    render(EmptyState, { title: 'No jobs yet', text: 'Add your first job', children: text('Add') });
    expect(screen.getByText('No jobs yet')).toBeInTheDocument();
    expect(screen.getByText('Add your first job')).toBeInTheDocument();
    expect(screen.getByText('Add')).toBeInTheDocument();
  });
  it('translates warnings', () => {
    render(WarningList, { warnings: [{ code: 'active_application_exists', params: { id: 'a1' } }] });
    expect(screen.getByText(/already has an active application/)).toBeInTheDocument();
  });
  it('shows toasts and lets the user dismiss them', async () => {
    toasts.length = 0;
    toasts.push({ id: 900, kind: 'success', text: 'Saved!' });
    render(ToastHost);
    expect(screen.getByText('Saved!')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByText('Saved!')).toBeNull());
  });
});

describe('Dialog nesting', () => {
  it('keeps Tab focus inside the inner dialog when it is opened over the application dialog', async () => {
    useDevBackend();
    const rows = await (await import('../api')).api.listApplications();
    navigate(`#/applications/${rows.find((row) => row.job_title === 'Android Developer')!.id}`);
    render(ApplicationsScreen);
    const outer = await screen.findByRole('dialog', { name: 'Application' });
    await fireEvent.click(await within(outer).findByRole('tab', { name: /Reminders/ }));
    await fireEvent.click((await within(outer).findAllByRole('button', { name: 'Postpone' }))[0]!);
    const inner = await screen.findByRole('dialog', { name: 'Postpone reminder' });
    const buttons = within(inner).getAllByRole('button');
    const last = buttons[buttons.length - 1]!;
    last.focus();
    await fireEvent.keyDown(last, { key: 'Tab' });
    expect(inner.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);
  });
});

describe('Dialog scroll lock and focus', () => {
  const body = createRawSnippet(() => ({ render: () => '<p>Body</p>' }));
  const mount = (title: string, props: Record<string, unknown> = {}) => render(Dialog, { open: true, title, onclose: () => {}, children: body, ...props });

  it('keeps the page locked while the job dialog replaces the add-job dialog and unlocks after closing it', async () => {
    useDevBackend();
    const id = (await api.listJobs())[0]!.id;
    navigate('#/jobs/new');
    render(JobsScreen);
    await screen.findByRole('dialog', { name: 'Add a job' });
    expect(document.body.style.overflow).toBe('hidden');
    navigate(`#/jobs/${id}`);
    const dialog = await screen.findByRole('dialog', { name: 'Job' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a job' })).toBeNull());
    expect(document.body.style.overflow).toBe('hidden');
    expect(dialog.contains(document.activeElement)).toBe(true);
    await fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Job' })).toBeNull());
    expect(document.body.style.overflow).toBe('');
  });

  it('restores the scroll lock in LIFO order', () => {
    const a = mount('A');
    const b = mount('B');
    expect(document.body.style.overflow).toBe('hidden');
    b.unmount();
    expect(document.body.style.overflow).toBe('hidden');
    a.unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('restores the scroll lock in non-LIFO order', () => {
    const a = mount('A');
    const b = mount('B');
    a.unmount();
    expect(document.body.style.overflow).toBe('hidden');
    b.unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
