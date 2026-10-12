import { CATALOGS } from '@jobhunters/core';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it } from 'vitest';
import { useDevBackend } from '../test/transport';
import Help from './Help.svelte';

const TABS = ['How it works', 'Dashboard', 'Jobs', 'Applications', 'Companies', 'AI tasks', 'Settings', 'Tips'];

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
  for (const name of ['Dashboard', 'Jobs', 'Applications', 'Companies', 'AI tasks', 'Settings']) {
    await fireEvent.click(screen.getByRole('tab', { name }));
    hrefs.push(document.querySelector('[data-ui^="help.open."]')!.getAttribute('href'));
  }
  expect(hrefs).toEqual(['#/', '#/jobs', '#/applications', '#/companies', '#/tasks', '#/settings']);
});

it('has every help text in both languages', () => {
  const en = Object.keys(CATALOGS.en).filter((key) => key.startsWith('ui.help.'));
  const cs = Object.keys(CATALOGS.cs).filter((key) => key.startsWith('ui.help.'));
  expect(en.length).toBeGreaterThan(20);
  expect(cs.sort()).toEqual(en.sort());
  for (const key of en) expect((CATALOGS.cs as Record<string, string>)[key], key).not.toBe((CATALOGS.en as Record<string, string>)[key]);
});
