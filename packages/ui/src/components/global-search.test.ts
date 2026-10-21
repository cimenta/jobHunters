import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { api } from '../api';
import { router } from '../lib/router.svelte';
import { useDevBackend } from '../test/transport';
import GlobalSearch from './GlobalSearch.svelte';

const ui = (name: string) => document.querySelector(`[data-ui="${name}"]`) as HTMLElement | null;
const input = () => ui('search.input') as HTMLInputElement;

async function type(text: string): Promise<void> {
  await fireEvent.input(input(), { target: { value: text } });
}

describe('GlobalSearch', () => {
  it('searches after a pause, groups the results by type and marks every row with its type', async () => {
    useDevBackend();
    render(GlobalSearch);
    await type('android');
    await waitFor(() => expect(ui('search.group.jobs')).not.toBeNull());
    const jobs = ui('search.group.jobs')!;
    const applications = ui('search.group.applications')!;
    expect(jobs.querySelector('h3')).toHaveTextContent('Jobs · 1');
    expect(jobs.querySelector('.tag')).toHaveTextContent('Job');
    expect(jobs.querySelector('.title')).toHaveTextContent('Android Developer');
    expect(applications.querySelector('.tag')).toHaveTextContent('Application');
    expect(applications.querySelector('.title')).toHaveTextContent(/Android Developer – #1/);
    expect(jobs.querySelector('mark')).toHaveTextContent('Android');
    expect(ui('search.empty')).toBeNull();
  });

  it('shows a company, its jobs and its application as separate rows, so the user picks which to open', async () => {
    useDevBackend();
    render(GlobalSearch);
    await type('example');
    await waitFor(() => expect(ui('search.group.companies')).not.toBeNull());
    expect(ui('search.group.companies')!.querySelector('.tag')).toHaveTextContent('Company');
    expect(ui('search.group.companies')).toHaveTextContent('1 job · 1 application');
    expect(ui('search.group.jobs')!.querySelector('.tag')).toHaveTextContent('Job');
    expect(ui('search.group.applications')!.querySelector('.tag')).toHaveTextContent('Application');
  });

  it('finds an e-mail and shows a snippet when the match is not in the title; the row opens the e-mail', async () => {
    useDevBackend();
    render(GlobalSearch);
    await type('careful');
    await waitFor(() => expect(ui('search.group.emails')).toBeNull());
    await type('talent agency');
    await waitFor(() => expect(ui('search.group.emails')).not.toBeNull());
    const row = ui('search.group.emails')!.querySelector('a')!;
    expect(row.querySelector('.tag')).toHaveTextContent('Email');
    expect(row).toHaveAttribute('href', '#/emails/mail-3');
  });

  it('opens the chosen row with a click, clears the text and closes the pop-up', async () => {
    useDevBackend();
    render(GlobalSearch);
    await type('android');
    await waitFor(() => expect(ui('search.group.jobs')).not.toBeNull());
    const jobId = (await api.listJobs()).find((job) => job.title === 'Android Developer')!.id;
    await fireEvent.click(ui(`search.result.jobs.${jobId}`)!);
    await waitFor(() => expect(router.current).toMatchObject({ name: 'job', id: jobId }));
    expect(ui('search.popup')).toBeNull();
    expect(input().value).toBe('');
  });

  it('chooses with the arrow keys and Enter, and closes with Esc and with a click elsewhere', async () => {
    useDevBackend();
    render(GlobalSearch);
    await type('android');
    await waitFor(() => expect(ui('search.group.applications')).not.toBeNull());
    const hits = [...document.querySelectorAll('[role="option"]')];
    expect(hits[0]).toHaveAttribute('aria-selected', 'true');
    await fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(hits[1]).toHaveAttribute('aria-selected', 'true');
    await fireEvent.keyDown(input(), { key: 'Escape' });
    expect(ui('search.popup')).toBeNull();
    await fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(ui('search.popup')).not.toBeNull();
    await fireEvent.pointerDown(document.body);
    expect(ui('search.popup')).toBeNull();
    await fireEvent.keyDown(input(), { key: 'ArrowDown' });
    const chosen = document.querySelector('[role="option"][aria-selected="true"]') as HTMLAnchorElement;
    const href = chosen.getAttribute('href')!;
    await fireEvent.keyDown(input(), { key: 'Enter' });
    await waitFor(() => expect(window.location.hash).toBe(href));
    expect(ui('search.popup')).toBeNull();
  });

  it('keeps the row chosen with the keys when the list scrolls under a still pointer; only a real pointer move chooses a row', async () => {
    useDevBackend();
    render(GlobalSearch);
    await type('example');
    await waitFor(() => expect(ui('search.group.emails')).not.toBeNull());
    const hits = () => [...document.querySelectorAll('[role="option"]')];
    const selected = () => hits().findIndex((hit) => hit.getAttribute('aria-selected') === 'true');
    expect(hits().length).toBeGreaterThan(5);
    await fireEvent.mouseMove(hits()[1]!, { clientX: 10, clientY: 10 });
    expect(selected()).toBe(1);
    for (let step = 2; step <= 5; step++) {
      await fireEvent.keyDown(input(), { key: 'ArrowDown' });
      expect(selected()).toBe(step);
      // The browser reports a move to the same place when the list scrolled under the pointer: it must not take the choice back.
      await fireEvent.mouseMove(hits()[step - 1]!, { clientX: 10, clientY: 10 });
      expect(selected()).toBe(step);
    }
    await fireEvent.mouseMove(hits()[0]!, { clientX: 11, clientY: 12 });
    expect(selected()).toBe(0);
  });

  it('does not close on a click inside the pop-up or in the box', async () => {
    useDevBackend();
    render(GlobalSearch);
    await type('android');
    await waitFor(() => expect(ui('search.group.jobs')).not.toBeNull());
    await fireEvent.pointerDown(ui('search.group.jobs')!);
    await fireEvent.pointerDown(input());
    expect(ui('search.popup')).not.toBeNull();
  });

  it('says nothing was found, and does nothing for fewer than two characters', async () => {
    useDevBackend();
    render(GlobalSearch);
    await type('a');
    expect(ui('search.popup')).toBeNull();
    await type('zzzqqq');
    await waitFor(() => expect(ui('search.empty')).toHaveTextContent('Nothing found for "zzzqqq".'));
    await type('');
    expect(ui('search.popup')).toBeNull();
  });

  it('shows only the answer to the last query when the answers come in a different order', async () => {
    useDevBackend();
    render(GlobalSearch);
    await type('example');
    await type('android');
    await waitFor(() => expect(ui('search.group.jobs')).not.toBeNull());
    expect(ui('search.group.companies')).toBeNull();
  });

  it('lists a whole group on "Show all" when more than five matched', async () => {
    useDevBackend();
    for (let index = 0; index < 7; index++) {
      await api.saveJob({ url: `https://example.com/jobs/consultant-${index}`, text: `Consultant ${index}\n\nA short ad text for the test.`, overrides: { title: `Consultant ${index}`, company: 'Test Co' } });
    }
    render(GlobalSearch);
    await type('consultant');
    await waitFor(() => expect(ui('search.group.jobs')).not.toBeNull());
    expect(ui('search.group.jobs')!.querySelectorAll('a')).toHaveLength(5);
    expect(ui('search.group.jobs')!.querySelector('h3')).toHaveTextContent('Jobs · 7');
    await fireEvent.click(ui('search.more.jobs')!);
    await waitFor(() => expect(ui('search.group.jobs')!.querySelectorAll('a')).toHaveLength(7));
    expect(ui('search.more.jobs')).toBeNull();
  });

  it('is reached with / outside a text field and with Ctrl+K from anywhere, and Ctrl+K again leaves it', async () => {
    useDevBackend();
    render(GlobalSearch);
    await fireEvent.keyDown(document.body, { key: '/' });
    expect(document.activeElement).toBe(input());
    input().blur();
    const other = document.createElement('input');
    document.body.append(other);
    other.focus();
    await fireEvent.keyDown(other, { key: '/' });
    expect(document.activeElement).toBe(other);
    await fireEvent.keyDown(other, { key: 'k', ctrlKey: true });
    expect(document.activeElement).toBe(input());
    await fireEvent.keyDown(input(), { key: 'k', metaKey: true });
    expect(document.activeElement).not.toBe(input());
    other.remove();
  });

  it('shows hostile text as text', async () => {
    useDevBackend();
    render(GlobalSearch);
    await type('hostile');
    await waitFor(() => expect(ui('search.group.companies')).not.toBeNull());
    expect(ui('search.popup')!.textContent).toContain('Hostile <b>Corp</b>');
    expect(ui('search.popup')!.querySelector('b, img, script')).toBeNull();
  });
});
