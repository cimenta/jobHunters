import { CATALOGS } from '@jobhunters/core';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import { useDevBackend } from '../test/transport';
import Help from './Help.svelte';

const TABS = ['How it works', 'Dashboard', 'Jobs', 'Applications', 'Companies', 'Search', 'Calendar', 'Emails', 'AI tasks', 'Settings', 'Tips'];

it('has a tab per topic and shows the topic of the chosen tab', async () => {
  useDevBackend();
  render(Help);
  expect(screen.getByRole('heading', { level: 1, name: 'Help' })).toBeInTheDocument();
  expect(screen.getAllByRole('tab').map((tab) => tab.textContent?.trim())).toEqual(TABS);
  expect(screen.getByRole('heading', { name: 'How it works' })).toBeInTheDocument();
  for (const name of TABS.slice(1)) {
    await fireEvent.click(screen.getByRole('tab', { name }));
    expect(screen.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'How it works' })).toBeNull();
  }
});

it('links every part to its screen', async () => {
  render(Help);
  const hrefs: (string | null)[] = [];
  for (const name of ['Dashboard', 'Jobs', 'Applications', 'Companies', 'Emails', 'AI tasks', 'Settings']) {
    await fireEvent.click(screen.getByRole('tab', { name }));
    hrefs.push(document.querySelector('[data-ui^="help.open."]')!.getAttribute('href'));
  }
  expect(hrefs).toEqual(['#/', '#/jobs', '#/applications', '#/companies', '#/emails', '#/tasks', '#/settings']);
});

it('has every help text in both languages', () => {
  const en = Object.keys(CATALOGS.en).filter((key) => key.startsWith('ui.help.'));
  const cs = Object.keys(CATALOGS.cs).filter((key) => key.startsWith('ui.help.'));
  expect(en.length).toBeGreaterThan(20);
  expect(cs.sort()).toEqual(en.sort());
  for (const key of en) expect((CATALOGS.cs as Record<string, string>)[key], key).not.toBe((CATALOGS.en as Record<string, string>)[key]);
});

it('shows captioned screenshots in the topics, and a click enlarges one in a dialog that closes again', async () => {
  useDevBackend();
  render(Help);
  const expected: Record<string, string[]> = {
    Dashboard: ['dashboard'],
    Jobs: ['jobs', 'job-detail', 'add-job'],
    Applications: ['application-detail', 'kanban', 'applications'],
    'AI tasks': ['tasks'],
    Settings: ['settings'],
  };
  for (const [tab, shots] of Object.entries(expected)) {
    await fireEvent.click(screen.getByRole('tab', { name: tab }));
    const found = [...document.querySelectorAll('[data-ui^="help.shot."]:is(figure)')].map((figure) => figure.getAttribute('data-ui')!.replace('help.shot.', ''));
    expect(found, tab).toEqual(shots);
    for (const figure of document.querySelectorAll('figure')) {
      const img = figure.querySelector('img')!;
      expect(img.getAttribute('src'), tab).toBeTruthy();
      expect(img.getAttribute('alt')?.length ?? 0).toBeGreaterThan(10);
      expect(figure.querySelector('figcaption')?.textContent).toBe(img.getAttribute('alt'));
    }
  }
  await fireEvent.click(screen.getByRole('tab', { name: 'Jobs' }));
  const zoom = document.querySelector('[data-ui="help.shot.jobs.zoom"]') as HTMLElement;
  expect(zoom).toHaveAttribute('title', expect.stringMatching(/^Enlarge the screenshot: /));
  await fireEvent.click(zoom);
  const dialog = await screen.findByRole('dialog');
  expect(dialog.querySelector('img')).toHaveAttribute('alt', 'The list of jobs: filters, sorting, match badges and a column of icons on every card.');
  await fireEvent.keyDown(dialog, { key: 'Escape' });
  await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

it('explains the history of texts and the comparison in the Settings topic', async () => {
  useDevBackend();
  render(Help);
  await fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
  const topic = document.querySelector('[data-ui="help.settings"]')!.textContent!;
  expect(topic).toContain('History');
  expect(topic).toContain('Changes');
  expect(topic).toContain('Use This');
  expect(topic).toContain('every AI prompt');
  expect(topic).toContain('offline texts');
});
