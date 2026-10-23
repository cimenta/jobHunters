import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import App from './App.svelte';
import { navigate } from './lib/router.svelte';
import { ids, setIdsVisible } from './state/ids.svelte';
import { toasts } from './state/toast.svelte';
import { useDevBackend } from './test/transport';

const present = (): string[] => [...document.querySelectorAll('[data-ui]')].map((el) => el.getAttribute('data-ui')!);

async function visit(hash: string, waitForId: string): Promise<string[]> {
  navigate(hash);
  await waitFor(() => expect(present()).toContain(waitForId));
  return present();
}

async function start(): Promise<void> {
  useDevBackend();
  render(App);
  await screen.findByRole('navigation');
}

afterEach(() => vi.restoreAllMocks());

describe('element identifiers', () => {
  it('marks the important objects of every screen and never repeats an id on one screen', async () => {
    await start();
    const jobId = (await api.listJobs()).find((job) => job.title === 'Android Developer')!.id;
    const applicationId = (await api.listApplications())[0]!.id;
    const companyId = (await api.listCompanies())[0]!.id;
    const screens: [string, string, (string | RegExp)[]][] = [
      ['#/', 'dashboard.reminders', ['app.brand', 'nav', 'nav.dashboard', 'nav.jobs', 'nav.applications', 'nav.companies', 'nav.settings', 'dashboard', 'dashboard.add-job', 'dashboard.status-counts', /^reminder\.done\./]],
      ['#/jobs', 'jobs.list', ['jobs', 'jobs.add', 'jobs.search', `job.${jobId}`]],
      ['#/jobs/new', 'add-job.read', ['add-job', 'add-job.url']],
      [`#/jobs/${jobId}`, 'job-detail.create-application', ['job-detail', 'job-detail.summary', 'job-detail.tabs', 'job-detail.panel', 'job-detail.applications', 'tab.applications', 'tab.notes', 'tab.description', 'tab.match']],
      ['#/applications', 'applications.list', ['applications', `application.${applicationId}`]],
      [`#/applications/${applicationId}`, 'status-control.target', ['application-detail', 'application-detail.header', 'application-detail.tabs', 'application-detail.panel', 'tab.ad', 'tab.documents', 'tab.questions', 'tab.communications', 'tab.reminders', 'tab.timeline', 'status-control', 'ad']],
      ['#/companies', 'companies.list', ['companies', `company.${companyId}`]],
      [`#/companies/${companyId}`, 'company-detail.save', ['company-detail', 'company-detail.jobs', 'company-detail.applications']],
      ['#/calendar', 'calendar.grid', ['calendar', 'calendar.title', 'calendar.prev', 'calendar.today', 'calendar.next', 'calendar.legend', 'nav.calendar']],
      ['#/settings', 'settings.language', ['settings', 'settings.panel', 'settings.language', 'settings.appearance', 'tab.general', 'tab.documents', 'tab.experience', 'tab.prompts', 'tab.availability', 'tab.profile', 'tab.templates', 'tab.statuses', 'tab.about']],
    ];
    for (const [hash, waitForId, expected] of screens) {
      const found = await visit(hash, waitForId);
      for (const id of expected) {
        if (typeof id === 'string') expect(found, `${hash}: ${id}`).toContain(id);
        else expect(found.some((value) => id.test(value)), `${hash}: ${id}`).toBe(true);
      }
      expect(new Set(found).size, `${hash}: duplicate ids`).toBe(found.length);
    }
  });

  it('marks the tab contents and dialogs', async () => {
    await start();
    const applicationId = (await api.listApplications())[0]!.id;
    await visit(`#/applications/${applicationId}`, 'status-control.target');
    for (const [tab, id] of [['questions', 'questions'], ['communications', 'communications'], ['reminders', 'reminders'], ['timeline', 'timeline']] as const) {
      await fireEvent.click(document.querySelector(`[data-ui="tab.${tab}"]`)!);
      await waitFor(() => expect(present()).toContain(id));
    }
    await fireEvent.click(document.querySelector('[data-ui="tab.documents"]')!);
    await waitFor(() => expect(present()).toContain('documents'));
    await fireEvent.click(await screen.findByRole('button', { name: 'Add document' }));
    await waitFor(() => expect(present()).toContain('add-document-dialog'));
  });
});

describe('showing the identifiers on screen', () => {
  function stubBoxes(): void {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const order = [...document.querySelectorAll('[data-ui]')].indexOf(this);
      return { left: 10, top: 10 + Math.max(order, 0) * 30, right: 110, bottom: 40 + Math.max(order, 0) * 30, width: 100, height: 30, x: 10, y: 10, toJSON: () => ({}) } as DOMRect;
    });
  }

  it('shows a label for every marked element when switched on, and none when off', async () => {
    stubBoxes();
    await start();
    expect(document.querySelectorAll('[data-id-tag]')).toHaveLength(0);
    setIdsVisible(true);
    await waitFor(() => expect([...document.querySelectorAll('[data-id-tag]')].map((tag) => tag.textContent)).toContain('nav.jobs'));
    setIdsVisible(false);
    await waitFor(() => expect(document.querySelectorAll('[data-id-tag]')).toHaveLength(0));
  });

  it('copies the id of a clicked label', async () => {
    stubBoxes();
    const written: string[] = [];
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text: string) => void written.push(text) }, configurable: true });
    await start();
    setIdsVisible(true);
    const tag = await waitFor(() => {
      const found = [...document.querySelectorAll<HTMLElement>('[data-id-tag]')].find((el) => el.textContent === 'nav.jobs');
      expect(found).toBeTruthy();
      return found!;
    });
    await fireEvent.click(tag);
    await waitFor(() => expect(written).toEqual(['nav.jobs']));
    expect(toasts.map((t) => t.text)).toContain('Copied');
  });

  it('toggles with Alt+Shift+I and remembers the choice', async () => {
    await start();
    expect(ids.visible).toBe(false);
    await fireEvent.keyDown(window, { key: 'I', code: 'KeyI', altKey: true, shiftKey: true });
    expect(ids.visible).toBe(true);
    expect(localStorage.getItem('jobhunters.showIds')).toBe('1');
    await fireEvent.keyDown(window, { key: 'I', code: 'KeyI', altKey: true, shiftKey: true });
    expect(ids.visible).toBe(false);
    expect(localStorage.getItem('jobhunters.showIds')).toBe('0');
  });
});
