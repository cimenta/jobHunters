import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { api } from '../api';
import { shiftMonth, todayKey } from '../lib/calendar';
import { loadApp } from '../state/app.svelte';
import { useDevBackend } from '../test/transport';
import CalendarScreen from './CalendarScreen.svelte';

const ui = (name: string) => document.querySelector(`[data-ui="${name}"]`) as HTMLElement | null;
const all = (prefix: string): HTMLElement[] => [...document.querySelectorAll(`[data-ui^="${prefix}"]`)] as HTMLElement[];

describe('CalendarScreen', () => {
  it('shows the current month with today marked, Monday first', async () => {
    useDevBackend();
    render(CalendarScreen);
    expect(await screen.findByText('Mon')).toBeInTheDocument();
    const today = todayKey();
    expect(ui(`calendar.day.${today}`)).toHaveClass('today');
    expect(all('calendar.day.').length % 7).toBe(0);
    expect(ui('calendar.title')).toHaveTextContent(String(new Date().getFullYear()));
  });

  it('puts an interview on its day and links it to the application', async () => {
    useDevBackend();
    const application = (await api.listApplications())[0]!;
    const meeting = await api.addCommunication(application.id, { kind: 'meeting', direction: 'incoming', channel: 'video', summary: 'Technical interview', datetime: `${todayKey()}T12:00` });
    render(CalendarScreen);
    const chip = await screen.findByTitle(/Technical interview/);
    expect(chip).toHaveAttribute('data-ui', `calendar.interview.${meeting.id}`);
    expect(chip).toHaveAttribute('href', `#/applications/${application.id}`);
    expect(ui(`calendar.day.${todayKey()}`)).toContainElement(chip);
  });

  it('ignores entries that are not meetings', async () => {
    useDevBackend();
    const application = (await api.listApplications())[0]!;
    await api.addCommunication(application.id, { kind: 'message', direction: 'incoming', channel: 'email', summary: 'Plain message', datetime: `${todayKey()}T12:00` });
    render(CalendarScreen);
    await screen.findByText('Mon');
    expect(all('calendar.interview.')).toHaveLength(0);
  });

  it('draws the applications in waiting as bars that open the application', async () => {
    useDevBackend();
    const waiting = (await api.listApplications()).filter((row) => row.status === 'waiting');
    expect(waiting.length).toBeGreaterThan(0);
    render(CalendarScreen);
    await screen.findByText('Mon');
    const bar = all(`calendar.waiting.${waiting[0]!.id}`)[0];
    expect(bar).not.toBeNull();
    expect(bar).toHaveAttribute('href', `#/applications/${waiting[0]!.id}`);
  });

  it('uses the colors chosen in Settings and the text color that fits them', async () => {
    useDevBackend();
    await api.updateSettings({ ui_state: JSON.stringify({ calendar_colors: { interview: '#000000', waiting: '', late: '' } }) });
    await loadApp();
    render(CalendarScreen);
    await screen.findByText('Mon');
    const style = ui('calendar')!.getAttribute('style') ?? '';
    expect(style).toContain('--cal-interview: #000000');
    expect(style).toContain('--cal-interview-ink: #ffffff');
    expect(style).not.toContain('--cal-waiting');
  });

  it('shows the deadline of a homework on its day and sends it to the application', async () => {
    useDevBackend();
    const application = (await api.listApplications()).find((a) => a.status === 'sent')!;
    await api.setApplicationStatus(application.id, 'homework', todayKey());
    render(CalendarScreen);
    await screen.findByText('Mon');
    const chip = ui(`calendar.homework.${application.id}`)!;
    expect(chip).not.toBeNull();
    expect(chip).toHaveAttribute('href', `#/applications/${application.id}`);
    expect(ui(`calendar.day.${todayKey()}`)).toContainElement(chip);
  });

  it('moves between months and comes back with Today', async () => {
    useDevBackend();
    render(CalendarScreen);
    await screen.findByText('Mon');
    const first = ui('calendar.title')!.textContent;
    await fireEvent.click(ui('calendar.next')!);
    expect(ui('calendar.title')!.textContent).not.toBe(first);
    expect(ui(`calendar.day.${shiftMonth(todayKey().slice(0, 7), 1)}-15`)).not.toBeNull();
    await fireEvent.click(ui('calendar.prev')!);
    await fireEvent.click(ui('calendar.prev')!);
    expect(ui(`calendar.day.${shiftMonth(todayKey().slice(0, 7), -1)}-15`)).not.toBeNull();
    await fireEvent.click(ui('calendar.today')!);
    expect(ui('calendar.title')!.textContent).toBe(first);
  });
});
