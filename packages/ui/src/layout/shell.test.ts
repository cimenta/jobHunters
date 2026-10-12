import { CATALOGS } from '@jobhunters/core';
import { expect, it } from 'vitest';

it('has a navigation label for every section in both languages', () => {
  for (const locale of ['en', 'cs'] as const) {
    for (const section of ['dashboard', 'jobs', 'applications', 'companies', 'settings', 'help']) {
      expect(CATALOGS[locale], `${locale}:${section}`).toHaveProperty(`ui.nav.${section}`);
    }
  }
});

import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { app } from '../state/app.svelte';
import Shell from './Shell.svelte';

it('shows the version in small text next to the application name', () => {
  app.version = '0.5.0';
  render(Shell, { children: createRawSnippet(() => ({ render: () => '<p>Body</p>' })) });
  const brand = screen.getByText('JobHunters', { exact: false, selector: '.brand' });
  expect(brand).toHaveTextContent('JobHunters');
  const version = screen.getByText('v0.5.0');
  expect(brand).toContainElement(version);
  expect(version).toHaveAttribute('data-ui', 'app.version');
});

it('omits the version while it is not known', () => {
  app.version = '';
  render(Shell, { children: createRawSnippet(() => ({ render: () => '<p>Body</p>' })) });
  expect(document.querySelector('[data-ui="app.version"]')).toBeNull();
});

it('links the Help item last in the navigation', () => {
  render(Shell, { children: createRawSnippet(() => ({ render: () => '<p>Body</p>' })) });
  const links = [...document.querySelectorAll('nav a.item')];
  expect(links.at(-1)).toHaveAttribute('data-ui', 'nav.help');
  expect(links.at(-1)).toHaveAttribute('href', '#/help');
});
