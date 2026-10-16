import { fileIdFromUrl } from '@jobhunters/core';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { router } from '../lib/router.svelte';
import { invalidate } from '../state/invalidate.svelte';
import { dismissToast, toasts } from '../state/toast.svelte';
import { useDevBackend } from '../test/transport';
import ApplicationDetail from './ApplicationDetail.svelte';

beforeEach(() => {
  for (const item of [...toasts]) dismissToast(item.id);
});

async function androidApplicationId(): Promise<string> {
  return (await api.listApplications()).find((row) => row.job_title === 'Android Developer')!.id;
}

async function open(tabName: RegExp): Promise<string> {
  useDevBackend();
  const id = await androidApplicationId();
  render(ApplicationDetail, { id });
  await fireEvent.click(await screen.findByRole('tab', { name: tabName }));
  return id;
}

describe('Questions tab', () => {
  it('lists questions, saves an answer and shows the sentence counter', async () => {
    const id = await open(/Questions/);
    const field = await screen.findByLabelText('Answer');
    await fireEvent.input(field, { target: { value: 'Because I like the product.' } });
    expect(screen.getByText('1 / 3 sentences')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getApplication(id)).questions[0]!.status).toBe('answered'));
    expect(toasts.map((t) => t.text)).toContain('Answer saved for "Why do you want to work with us?"');
  });

  it('queues the AI to answer a question and shows the state of the task', async () => {
    const id = await open(/Questions/);
    await api.updateSettings({ candidate_experience: 'Ten years of Kotlin' });
    const box = await screen.findByLabelText('Answer by AI');
    await fireEvent.input(screen.getByPlaceholderText('Your own instructions for the AI (optional)'), { target: { value: 'Be brief' } });
    await fireEvent.click(box);
    expect(await screen.findByText(/Waiting for the AI/)).toBeInTheDocument();
    expect(toasts.map((t) => t.text)).toContain('AI answer requested for "Why do you want to work with us?"');
    const task = (await api.getApplication(id)).tasks[0]!;
    expect(task).toMatchObject({ type: 'answer_question', target_type: 'question', status: 'pending' });
    expect(task.instructions).toContain('Be brief');
    await fireEvent.click(screen.getByLabelText('Answer by AI'));
    await waitFor(async () => expect((await api.getApplication(id)).tasks).toEqual([]));
    expect(toasts.map((t) => t.text)).toContain('AI answer request cancelled for "Why do you want to work with us?"');
  });

  it('queues the AI only when the checkbox itself is clicked, never when its text is clicked', async () => {
    const id = await open(/Questions/);
    await api.updateSettings({ candidate_experience: 'Ten years of Kotlin' });
    const box = await screen.findByLabelText('Answer by AI');
    const text = document.querySelector('[data-ui$=".ai-toggle.text"]') as HTMLElement;
    expect(text).toHaveTextContent('Answer by AI');
    await fireEvent.click(text);
    expect(box).not.toBeChecked();
    expect((await api.getApplication(id)).tasks).toEqual([]);
    await fireEvent.click(box);
    await waitFor(async () => expect((await api.getApplication(id)).tasks).toHaveLength(1));
  });

  it('queues the AI for a document only when its checkbox itself is clicked, never when its text is clicked', async () => {
    const id = await open(/Documents/);
    await api.updateSettings({ candidate_experience: 'Ten years of Kotlin' });
    const box = (await screen.findAllByLabelText('Content by AI'))[0]!;
    const text = document.querySelector('[data-ui$=".ai-toggle.text"]') as HTMLElement;
    expect(text).toHaveTextContent('Content by AI');
    await fireEvent.click(text);
    expect(box).not.toBeChecked();
    expect((await api.getApplication(id)).tasks).toEqual([]);
    await fireEvent.click(box);
    await waitFor(async () => expect((await api.getApplication(id)).tasks).toHaveLength(1));
  });

  it('shows an error notice when requesting the AI answer fails', async () => {
    await open(/Questions/);
    await api.updateSettings({ candidate_experience: 'Ten years of Kotlin' });
    const spy = vi.spyOn(api, 'requestQuestionAi').mockRejectedValue(new Error('AI is down'));
    try {
      await fireEvent.click(await screen.findByLabelText('Answer by AI'));
      await waitFor(() => expect(toasts.some((t) => t.kind === 'error')).toBe(true));
      expect(toasts.some((t) => t.kind === 'success')).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it('reports an answer over the limit instead of saving it', async () => {
    const id = await open(/Questions/);
    await fireEvent.input(await screen.findByLabelText('Answer'), { target: { value: 'One. Two. Three. Four.' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toasts.some((t) => /limit is 3/.test(t.text))).toBe(true));
    expect(toasts.some((t) => t.kind === 'error' && /limit is 3/.test(t.text))).toBe(true);
    expect((await api.getApplication(id)).questions[0]!.answer).toBe('');
  });

  it('adds a question with a limit, and removes one after confirmation', async () => {
    const id = await open(/Questions/);
    await fireEvent.click(await screen.findByRole('button', { name: 'Add question' }));
    const dialog = screen.getByRole('dialog', { name: 'Add question' });
    await fireEvent.input(within(dialog).getByLabelText('Question'), { target: { value: 'Salary expectations?' } });
    await fireEvent.input(within(dialog).getByLabelText('Maximum number of sentences'), { target: { value: '120' } });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    await waitFor(async () => expect((await api.getApplication(id)).questions).toHaveLength(2));
    await screen.findByText('Salary expectations?');
    expect(toasts.some((item) => item.kind === 'success')).toBe(true);
    await fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[1]!);
    await fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect((await api.getApplication(id)).questions).toHaveLength(1));
    expect(toasts.some((item) => item.kind === 'success')).toBe(true);
  });

  it('copies an answer to the clipboard', async () => {
    const written: string[] = [];
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text: string) => void written.push(text) }, configurable: true });
    await open(/Questions/);
    await fireEvent.input(await screen.findByLabelText('Answer'), { target: { value: 'My answer' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(written).toEqual(['My answer']));
    expect(toasts.map((t) => t.text)).toContain('Copied');
  });
});

describe('Communication tab', () => {
  it('lists entries, adds, edits and removes one', async () => {
    const id = await open(/Communication/);
    expect(await screen.findByText('Sent the application')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Add entry' }));
    let dialog = screen.getByRole('dialog', { name: 'Add entry' });
    await fireEvent.change(within(dialog).getByLabelText('Direction'), { target: { value: 'incoming' } });
    await fireEvent.change(within(dialog).getByLabelText('Channel'), { target: { value: 'phone' } });
    await fireEvent.input(within(dialog).getByLabelText(/^Summary/), { target: { value: 'HR called' } });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getApplication(id)).communications).toHaveLength(2));
    expect(toasts.some((item) => item.kind === 'success')).toBe(true);
    expect(await screen.findByText('HR called')).toBeInTheDocument();

    const item = screen.getByText('HR called').closest('li')!;
    await fireEvent.click(within(item).getByRole('button', { name: 'Edit' }));
    dialog = screen.getByRole('dialog', { name: 'Edit entry' });
    await fireEvent.input(within(dialog).getByLabelText(/^Summary/), { target: { value: 'HR called back' } });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('HR called back')).toBeInTheDocument();

    await fireEvent.click(within(screen.getByText('HR called back').closest('li')!).getByRole('button', { name: 'Delete' }));
    await fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect((await api.getApplication(id)).communications).toHaveLength(1));
    expect(toasts.some((item) => item.kind === 'success')).toBe(true);
  });

  it('adds a meeting through the type picker and adapts the form', async () => {
    const id = await open(/Communication/);
    await fireEvent.click(await screen.findByRole('button', { name: 'Add entry' }));
    const dialog = screen.getByRole('dialog', { name: 'Add entry' });
    expect(within(dialog).getByLabelText('Direction')).toBeInTheDocument();
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Meeting' }));
    expect(within(dialog).getByLabelText('Who set it up')).toHaveValue('incoming');
    expect(within(dialog).getByRole('option', { name: 'Invited by the employer' })).toBeInTheDocument();
    expect(within(dialog).getByText(/May be in the future/)).toBeInTheDocument();
    await fireEvent.change(within(dialog).getByLabelText('Channel'), { target: { value: 'video' } });
    await fireEvent.input(within(dialog).getByLabelText(/Meeting title/), { target: { value: 'Technical interview' } });
    await fireEvent.input(within(dialog).getByLabelText(/Starts at/), { target: { value: '2099-01-01T10:00' } });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getApplication(id)).communications.find((c) => c.summary === 'Technical interview')).toMatchObject({ kind: 'meeting', channel: 'video', direction: 'incoming' }));
    const row = (await screen.findByText('Technical interview')).closest('li')!;
    expect(row.querySelector('svg')).not.toBeNull();
    expect(within(row).getByText('Invited by the employer')).toBeInTheDocument();
  });

  it('fixes the direction of a confirmation and explains that it fills the applied date', async () => {
    const id = await open(/Communication/);
    await fireEvent.click(await screen.findByRole('button', { name: 'Add entry' }));
    const dialog = screen.getByRole('dialog', { name: 'Add entry' });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmation' }));
    const direction = within(dialog).getByLabelText('Direction');
    expect(direction).toBeDisabled();
    expect(direction).toHaveValue('incoming');
    expect(within(dialog).getByText(/sets the date the application was sent/)).toBeInTheDocument();
    await fireEvent.input(within(dialog).getByLabelText(/Confirmation text/), { target: { value: 'Automatic reply' } });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getApplication(id)).communications.some((c) => c.kind === 'confirmation')).toBe(true));
  });

  it('resets an outgoing direction when an entry is edited into a confirmation', async () => {
    const id = await open(/Communication/);
    const item = (await screen.findByText('Sent the application')).closest('li')!;
    await fireEvent.click(within(item).getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit entry' });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmation' }));
    expect(within(dialog).getByLabelText('Direction')).toHaveValue('incoming');
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getApplication(id)).communications.find((c) => c.summary === 'Sent the application')).toMatchObject({ kind: 'confirmation', direction: 'incoming' }));
  });

  it('saves an entry without a summary', async () => {
    const id = await open(/Communication/);
    await fireEvent.click(await screen.findByRole('button', { name: 'Add entry' }));
    const dialog = screen.getByRole('dialog', { name: 'Add entry' });
    expect(within(dialog).getByLabelText(/^Summary \(optional\)/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled();
    await fireEvent.input(within(dialog).getByLabelText('Details'), { target: { value: 'Only a note' } });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getApplication(id)).communications.find((c) => c.details === 'Only a note')).toMatchObject({ summary: '' }));
  });

  it('the Rejection button fills the form, can be undone and sets the status Rejected only after saving', async () => {
    const id = await open(/Communication/);
    expect((await api.getApplication(id)).application.status).toBe('sent');
    await fireEvent.click(await screen.findByRole('button', { name: 'Add entry' }));
    const dialog = screen.getByRole('dialog', { name: 'Add entry' });
    const button = within(dialog).getByRole('button', { name: 'Rejection' });
    await fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialog).getByLabelText('Direction')).toHaveValue('incoming');
    expect(within(dialog).getByLabelText(/^Summary/)).toHaveValue('Rejection from the company');
    expect(within(dialog).getByText(/status of the application changes to Rejected/)).toBeInTheDocument();
    expect((await api.getApplication(id)).application.status).toBe('sent');

    await fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(within(dialog).getByLabelText('Direction')).toHaveValue('outgoing');
    expect(within(dialog).getByLabelText(/^Summary/)).toHaveValue('');

    await fireEvent.click(button);
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getApplication(id)).application.status).toBe('rejected'));
    const saved = (await api.getApplication(id)).communications.find((c) => c.summary === 'Rejection from the company');
    expect(saved).toMatchObject({ kind: 'message', direction: 'incoming' });
  });

  it('the Rejection button is plain text without an icon', async () => {
    await open(/Communication/);
    await fireEvent.click(await screen.findByRole('button', { name: 'Add entry' }));
    const button = within(screen.getByRole('dialog', { name: 'Add entry' })).getByRole('button', { name: 'Rejection' });
    expect(button.querySelector('svg')).toBeNull();
  });

  it('adds an entry after a meeting: no direction and channel, the channel stays empty in the data', async () => {
    const id = await open(/Communication/);
    await fireEvent.click(await screen.findByRole('button', { name: 'Add entry' }));
    const dialog = screen.getByRole('dialog', { name: 'Add entry' });
    const kinds = within(dialog).getAllByRole('button').map((button) => button.textContent?.trim());
    expect(kinds.indexOf('After meeting')).toBe(kinds.indexOf('Meeting') + 1);
    await fireEvent.click(within(dialog).getByRole('button', { name: 'After meeting' }));
    expect(within(dialog).queryByLabelText('Direction')).toBeNull();
    expect(within(dialog).queryByLabelText('Channel')).toBeNull();
    await fireEvent.input(within(dialog).getByLabelText(/^How the meeting went/), { target: { value: 'They liked the demo' } });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getApplication(id)).communications.find((c) => c.summary === 'They liked the demo')).toMatchObject({ kind: 'after_meeting', direction: 'note', channel: '' }));
    expect((await api.getApplication(id)).application.status).toBe('sent');
    const item = (await screen.findByText('They liked the demo')).closest('li')!;
    expect(within(item).queryByText('Note')).toBeNull();
    expect(within(item).getByText('After meeting')).toBeInTheDocument();
  });

  it('sets the status Waiting after saving an entry after a meeting, with a reminder date that is required', async () => {
    const id = await open(/Communication/);
    await fireEvent.click(await screen.findByRole('button', { name: 'Add entry' }));
    const dialog = screen.getByRole('dialog', { name: 'Add entry' });
    expect(within(dialog).queryByLabelText('Set the status Waiting')).toBeNull();
    await fireEvent.click(within(dialog).getByRole('button', { name: 'After meeting' }));
    const box = within(dialog).getByLabelText('Set the status Waiting');
    expect(within(dialog).queryByLabelText('Remind me on')).toBeNull();
    await fireEvent.click(box);
    const date = within(dialog).getByLabelText('Remind me on') as HTMLInputElement;
    expect(date.value).not.toBe('');
    await fireEvent.input(date, { target: { value: '' } });
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    await fireEvent.input(date, { target: { value: '2099-01-01' } });
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled();
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getApplication(id)).application.status).toBe('waiting'));
    expect((await api.getApplication(id)).communications.some((c) => c.kind === 'after_meeting')).toBe(true);
  });

  it('keeps the status when the checkbox is not ticked and drops the rejection when another type is picked', async () => {
    const id = await open(/Communication/);
    await fireEvent.click(await screen.findByRole('button', { name: 'Add entry' }));
    const dialog = screen.getByRole('dialog', { name: 'Add entry' });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Rejection' }));
    await fireEvent.click(within(dialog).getByRole('button', { name: 'After meeting' }));
    expect(within(dialog).getByRole('button', { name: 'Rejection' })).toHaveAttribute('aria-pressed', 'false');
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getApplication(id)).communications.some((c) => c.kind === 'after_meeting')).toBe(true));
    expect((await api.getApplication(id)).application.status).toBe('sent');
  });

  it('has no Rejection button in the edit dialog', async () => {
    await open(/Communication/);
    const item = (await screen.findByText('Sent the application')).closest('li')!;
    await fireEvent.click(within(item).getByRole('button', { name: 'Edit' }));
    expect(within(screen.getByRole('dialog', { name: 'Edit entry' })).queryByRole('button', { name: 'Rejection' })).toBeNull();
  });
});

describe('Reminders tab', () => {
  it('adds, completes and dismisses reminders', async () => {
    const id = await open(/Reminders/);
    expect(await screen.findByText('Ask about the status')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Add reminder' }));
    const dialog = screen.getByRole('dialog', { name: 'Add reminder' });
    await fireEvent.input(within(dialog).getByLabelText('Date'), { target: { value: '2026-10-25' } });
    await fireEvent.input(within(dialog).getByLabelText('Text'), { target: { value: 'Prepare for the interview' } });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Prepare for the interview')).toBeInTheDocument();
    expect(toasts.some((item) => item.kind === 'success')).toBe(true);

    const item = screen.getByText('Prepare for the interview').closest('li')!;
    await fireEvent.click(within(item).getByRole('button', { name: 'Done' }));
    await waitFor(async () => expect((await api.getApplication(id)).reminders.find((r) => r.text === 'Prepare for the interview')!.status).toBe('done'));
    expect(toasts.some((item) => item.kind === 'success')).toBe(true);

    const other = screen.getByText('Ask about the status').closest('li')!;
    await fireEvent.click(within(other).getByRole('button', { name: 'Dismiss' }));
    await waitFor(async () => expect((await api.getApplication(id)).reminders.find((r) => r.text === 'Ask about the status')!.status).toBe('dismissed'));
    expect(toasts.some((item) => item.kind === 'success')).toBe(true);
  });

  it('refuses a date in the past', async () => {
    await open(/Reminders/);
    await fireEvent.click(await screen.findByRole('button', { name: 'Add reminder' }));
    const dialog = screen.getByRole('dialog', { name: 'Add reminder' });
    await fireEvent.input(within(dialog).getByLabelText('Date'), { target: { value: '2026-10-01' } });
    await fireEvent.input(within(dialog).getByLabelText('Text'), { target: { value: 'Too late' } });
    expect(within(dialog).getByRole('button', { name: 'Add' })).toBeDisabled();
  });
});

describe('Timeline tab', () => {
  it('shows the history, can be filtered by type and reversed', async () => {
    await open(/Timeline/);
    expect(await screen.findByText('Application created')).toBeInTheDocument();
    expect(screen.getByText('Status: Draft → Sent')).toBeInTheDocument();
    expect(screen.getByText(/Outgoing · E-mail: Sent the application/)).toBeInTheDocument();

    // The chips switch event types off and on; all are on at first.
    const chip = screen.getByRole('button', { name: 'Messages' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    await fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText(/Sent the application/)).toBeNull();
    expect(screen.getByText('Application created')).toBeInTheDocument();
    await fireEvent.click(chip);
    expect(screen.getByText(/Sent the application/)).toBeInTheDocument();

    const firstText = () => screen.getAllByRole('listitem')[0]!.textContent;
    const newestFirst = firstText();
    await fireEvent.click(screen.getByRole('button', { name: 'Oldest first' }));
    expect(firstText()).not.toBe(newestFirst);
  });
});

describe('Timeline tab entry kinds', () => {
  it('shows an icon per entry, marks an upcoming meeting and filters the new kinds', async () => {
    const id = await open(/Timeline/);
    await api.addCommunication(id, { kind: 'meeting', direction: 'incoming', channel: 'video', summary: 'Technical interview', datetime: '2099-01-01T10:00' });
    await api.addCommunication(id, { kind: 'homework', direction: 'incoming', channel: 'email', summary: 'Take-home task' });
    await api.addCommunication(id, { kind: 'confirmation', direction: 'incoming', channel: 'email', summary: 'We got it' });
    invalidate();

    expect(await screen.findByText('Meeting: Technical interview')).toBeInTheDocument();
    expect(screen.getByText('Homework received: Take-home task')).toBeInTheDocument();
    expect(screen.getByText('Application receipt confirmed: We got it')).toBeInTheDocument();

    const rows = [...document.querySelectorAll('[data-ui^="timeline.event."][data-type]')] as HTMLElement[];
    expect(rows.map((row) => row.getAttribute('data-type'))).toEqual(expect.arrayContaining(['status', 'message', 'meeting', 'homework', 'confirmation']));
    expect(rows.every((row) => row.querySelector('svg') !== null)).toBe(true);

    const meetingRow = rows.find((row) => row.getAttribute('data-type') === 'meeting')!;
    expect(within(meetingRow).getByText('upcoming')).toBeInTheDocument();
    expect(within(meetingRow).getByText('Video call · Invited by the employer')).toBeInTheDocument();
    expect(rows.filter((row) => row.textContent?.includes('upcoming'))).toHaveLength(1);

    await fireEvent.click(screen.getByRole('button', { name: 'Meetings' }));
    expect(screen.queryByText('Meeting: Technical interview')).toBeNull();
    expect(screen.getByText('Homework received: Take-home task')).toBeInTheDocument();
  });
});

describe('Timeline tab after a meeting', () => {
  it('shows the entry with its own filter chip', async () => {
    const id = await open(/Timeline/);
    await api.addCommunication(id, { kind: 'after_meeting', direction: 'note', summary: 'Good talk' });
    invalidate();
    expect(await screen.findByText('After the meeting: Good talk')).toBeInTheDocument();
    const chip = screen.getByRole('button', { name: 'After meetings' });
    await fireEvent.click(chip);
    expect(screen.queryByText('After the meeting: Good talk')).toBeNull();
  });
});

describe('Timeline tab hover card', () => {
  it('shows the summary and the details of a communication entry on its icon and none for other events', async () => {
    const id = await open(/Timeline/);
    await api.addCommunication(id, { direction: 'incoming', channel: 'email', summary: 'Rejection from the company', details: 'We chose another candidate.' });
    await api.addCommunication(id, { direction: 'incoming', channel: 'phone', details: 'Short call' });
    invalidate();
    const fullRow = (await screen.findByText(/Incoming · E-mail: Rejection from the company/)).closest('li')!;
    expect(document.querySelector('[data-ui$=".tip"]')).toBeNull();
    const fullIcon = fullRow.querySelector('[data-ui$=".icon"]')!;
    await fireEvent.mouseEnter(fullIcon);
    const full = fullRow.querySelector('[data-ui$=".tip"]')!;
    expect(full.querySelector('strong')).toHaveTextContent('Rejection from the company');
    expect(full).toHaveTextContent('We chose another candidate.');
    await fireEvent.mouseLeave(fullIcon);
    expect(document.querySelector('[data-ui$=".tip"]')).toBeNull();

    const bareRow = screen.getByText('Incoming · Phone').closest('li')!;
    await fireEvent.focus(bareRow.querySelector('[data-ui$=".icon"]')!);
    const bare = bareRow.querySelector('[data-ui$=".tip"]')!;
    expect(bare.querySelector('strong')).toBeNull();
    expect(bare).toHaveTextContent('Short call');

    const statusIcon = document.querySelector('[data-ui^="timeline.event."][data-type="status"] [data-ui$=".icon"]')!;
    await fireEvent.mouseEnter(statusIcon);
    expect(statusIcon.querySelector('[data-ui$=".tip"]')).toBeNull();
  });
});

describe('Delete application (Timeline tab)', () => {
  async function openTimeline() {
    const backend = useDevBackend();
    const application = (await api.listApplications()).find((row) => row.job_title === 'Android Developer')!;
    const folderId = fileIdFromUrl((await api.getApplication(application.id)).application.folder_url);
    render(ApplicationDetail, { id: application.id });
    await fireEvent.click(await screen.findByRole('tab', { name: /Timeline/ }));
    return { backend, id: application.id, folderId };
  }

  it('asks for confirmation, then deletes the application, trashes its folder and returns to the list', async () => {
    const { backend, id, folderId } = await openTimeline();
    await fireEvent.click(await screen.findByRole('button', { name: 'Delete application' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this application?' });
    expect(within(dialog).getByText(/will be deleted together with its documents/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Drive folder to the trash/)).toBeChecked();
    expect((await api.listApplications()).some((row) => row.id === id)).toBe(true);
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect((await api.listApplications()).some((row) => row.id === id)).toBe(false));
    expect(backend.drive.folders.has(folderId)).toBe(false);
    expect(toasts.map((t) => t.text)).toContain('Application deleted: "Example s.r.o. – Android Developer – #1 (2026-10)"');
    expect(router.current.name).toBe('applications');
  });

  it('keeps the Drive folder when the box is unticked', async () => {
    const { backend, id, folderId } = await openTimeline();
    await fireEvent.click(await screen.findByRole('button', { name: 'Delete application' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this application?' });
    await fireEvent.click(within(dialog).getByLabelText(/Drive folder to the trash/));
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect((await api.listApplications()).some((row) => row.id === id)).toBe(false));
    expect(backend.drive.folders.has(folderId)).toBe(true);
  });

  it('deletes nothing when the user cancels', async () => {
    const { id } = await openTimeline();
    await fireEvent.click(await screen.findByRole('button', { name: 'Delete application' }));
    await fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete this application?' })).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((await api.listApplications()).some((row) => row.id === id)).toBe(true);
    expect(router.current.name).not.toBe('applications');
  });
});

describe('Ad tab match', () => {
  const ui = (name: string) => document.querySelector(`[data-ui="${name}"]`) as HTMLElement | null;

  it('has a Match button that opens the text the AI wrote, with the percentage', async () => {
    const backend = useDevBackend();
    const id = await androidApplicationId();
    const jobId = (await api.getApplication(id)).job!.id;
    await api.updateSettings({ candidate_experience: 'Ten years of Kotlin' });
    const task = await api.requestJobMatch(jobId);
    backend.container.tasks.update(task.id, { status: 'done', ai_note: 'Strong match: Kotlin and Compose.\nGap: no Flutter.' });
    backend.container.jobs.update(jobId, { match_percent: 82 });
    render(ApplicationDetail, { id });
    const button = await screen.findByRole('button', { name: 'Match 82 %' });
    expect(button).toHaveAttribute('data-ui', 'ad.match');
    expect(ui('match-dialog.text')).toBeNull();
    await fireEvent.click(button);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(ui('match-dialog.percent')).toHaveTextContent('Match 82 %');
    expect(ui('match-dialog.text')!.textContent).toBe('Strong match: Kotlin and Compose.\nGap: no Flutter.');
    await fireEvent.click(ui('match-dialog.close')!);
    await waitFor(() => expect(ui('match-dialog.text')).toBeNull());
  });

  it('says what state the AI is in when there is no text yet, and that nothing was asked for when there is no evaluation', async () => {
    useDevBackend();
    const id = await androidApplicationId();
    const jobId = (await api.getApplication(id)).job!.id;
    render(ApplicationDetail, { id });
    await fireEvent.click(await screen.findByRole('button', { name: 'Match' }));
    expect(ui('match-dialog.none')).toHaveTextContent('no AI evaluation');
    await fireEvent.click(ui('match-dialog.close')!);
    await api.updateSettings({ candidate_experience: 'Ten years of Kotlin' });
    await api.requestJobMatch(jobId);
    invalidate();
    await fireEvent.click(await screen.findByRole('button', { name: 'Match' }));
    await waitFor(() => expect(ui('match-dialog.status')).toHaveTextContent('Waiting for the AI'));
    expect(ui('match-dialog.text')).toBeNull();
  });

  it('shows the button only on the Ad tab', async () => {
    useDevBackend();
    const id = await androidApplicationId();
    render(ApplicationDetail, { id });
    await screen.findByRole('button', { name: 'Match' });
    await fireEvent.click(screen.getByRole('tab', { name: /Questions/ }));
    expect(ui('ad.match')).toBeNull();
  });
});
