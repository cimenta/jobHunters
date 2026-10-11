import { describe, expect, it } from 'vitest';
import type { FetchResult } from '@jobhunters/core';
import { makeApplication } from '@jobhunters/core/testing';
import { createApi } from './api';
import { createHandlers } from './handlers';
import { makeTestContainer } from './test-container';

function setup(pages: Record<string, FetchResult> = {}) {
  const { container, grid } = makeTestContainer(pages);
  const api = createApi({ handlers: createHandlers(container), log: container.log });
  return { api, container, grid };
}

describe('api', () => {
  it('returns app info', () => {
    expect(setup().api('getAppInfo')).toEqual({ ok: true, data: { version: '9.9.9', locales: ['en', 'cs'] } });
  });

  it('rejects unknown methods, including inherited property names', () => {
    const { api } = setup();
    expect(api('nope')).toMatchObject({ ok: false, error: { code: 'unknown_method', params: { method: 'nope' } } });
    expect(api('constructor')).toMatchObject({ ok: false, error: { code: 'unknown_method' } });
    expect(api('__proto__')).toMatchObject({ ok: false, error: { code: 'unknown_method' } });
  });

  it('validates arguments', () => {
    const { api } = setup();
    expect(api('setApplicationStatus', 'x')).toMatchObject({ ok: false, error: { code: 'invalid_arguments' } });
    expect(api('setApplicationStatus', { id: 5, to: 'sent' })).toMatchObject({ ok: false, error: { code: 'invalid_arguments' } });
    expect(api('updateSettings', { ui_language: 5 })).toMatchObject({ ok: false, error: { code: 'invalid_arguments' } });
  });

  it('moves an application to waiting and writes reminder, history and timestamps to the sheets', () => {
    const { api, container, grid } = setup();
    container.applications.insert(makeApplication({ id: 'a1', status: 'sent' }));
    const result = api('setApplicationStatus', { id: 'a1', to: 'waiting', remindAt: '2026-10-20' });
    expect(result).toMatchObject({ ok: true, data: { id: 'a1', status: 'waiting' } });
    expect(container.reminders.list()).toMatchObject([{ application_id: 'a1', due_at: '2026-10-20', text: 'Waiting for a reply' }]);
    expect(grid('StatusHistory').rows).toHaveLength(2);
  });

  it('answers with a coded error and logs it', () => {
    const { api, container } = setup();
    container.applications.insert(makeApplication({ id: 'a1', status: 'sent' }));
    expect(api('setApplicationStatus', { id: 'a1', to: 'waiting' })).toMatchObject({
      ok: false,
      error: { code: 'reminder_date_required', params: {} },
    });
    expect(container.logEntries()).toMatchObject([{ flow: 'api', entity: 'setApplicationStatus' }]);
  });

  it('hides unexpected errors from the caller but logs the details', () => {
    const { container } = setup();
    const api = createApi({
      handlers: {
        boom: () => {
          throw new Error('secret detail');
        },
      },
      log: container.log,
    });
    const result = api('boom');
    expect(result).toMatchObject({ ok: false, error: { code: 'internal_error' } });
    expect(JSON.stringify(result)).not.toContain('secret detail');
    expect(container.logEntries()[0]?.message).toContain('secret detail');
  });

  it('survives a log that fails', () => {
    const api = createApi({
      handlers: { boom: () => { throw new Error('x'); } },
      log: () => { throw new Error('log down'); },
    });
    expect(api('boom')).toMatchObject({ ok: false, error: { code: 'internal_error' } });
  });

  it('applies settings immediately, including the language of generated texts', () => {
    const { api, container } = setup();
    expect(api('updateSettings', { ui_language: 'cs' })).toMatchObject({ ok: true, data: { ui_language: 'cs' } });
    expect(api('getSettings')).toMatchObject({ ok: true, data: { settings: { ui_language: 'cs' }, warnings: [] } });
    container.applications.insert(makeApplication({ id: 'a1', status: 'sent' }));
    api('setApplicationStatus', { id: 'a1', to: 'waiting', remindAt: '2026-10-20' });
    expect(container.reminders.list()[0]?.text).toBe('Čekání na odpověď');
  });

  it('reports rows edited outside the app as warnings', () => {
    const { api, grid } = setup();
    grid('Applications').appendRow(['a9', 'j1', 1, 'Label', 'en', 'weird', '', '', '', '', '']);
    grid('Companies').appendRow(['', 'No id', '', '']);
    expect(api('getWarnings')).toEqual({
      ok: true,
      data: [
        { code: 'row_missing_id', params: { sheet: 'Companies', row: 2, value: '' } },
        { code: 'cell_not_allowed', params: { sheet: 'Applications', row: 2, column: 'status', value: 'weird' } },
      ],
    });
  });
});

const AD = '<script type="application/ld+json">{"@type":"JobPosting","title":"Data Analyst","hiringOrganization":{"name":"Example Ltd"},"description":"Analyse data for the business and report to the head of data with the team."}</script>';
const AD_URL = 'https://example.com/jobs/1?utm_source=mail';
const CLEAN_URL = 'https://example.com/jobs/1';

describe('jobs api', () => {
  it('previews without saving', () => {
    const { api, container } = setup({ [CLEAN_URL]: { status: 200, html: AD } });
    expect(api('previewJob', { url: AD_URL })).toMatchObject({
      ok: true,
      data: { url: CLEAN_URL, fetched: true, parserId: 'generic', duplicateOf: '', parsed: { title: 'Data Analyst', company: 'Example Ltd' } },
    });
    expect(container.jobs.list()).toEqual([]);
  });

  it('saves a job to the sheets and lists it', () => {
    const { api, container, grid } = setup({ [CLEAN_URL]: { status: 200, html: AD } });
    const saved = api('saveJob', { url: AD_URL, overrides: { location: 'Brno' } });
    expect(saved).toMatchObject({ ok: true, data: { status: 'created', job: { title: 'Data Analyst', location: 'Brno', url: CLEAN_URL } } });
    expect(container.companies.list().map((c) => c.name)).toEqual(['Example Ltd']);
    expect(grid('Jobs').rows).toHaveLength(2);
    const listed = api('listJobs') as { ok: true; data: { title: string; description: string }[] };
    expect(listed.data.map((j) => j.title)).toEqual(['Data Analyst']);
    expect(listed.data[0]!.description.length).toBeLessThanOrEqual(200);
  });

  it('answers duplicate for the same ad and saves a failed download with a warning', () => {
    const { api } = setup({ [CLEAN_URL]: { status: 200, html: AD } });
    api('saveJob', { url: AD_URL });
    expect(api('saveJob', { url: CLEAN_URL })).toMatchObject({ ok: true, data: { status: 'duplicate' } });
    expect(api('saveJob', { url: 'https://example.com/blocked' })).toMatchObject({
      ok: true,
      data: { status: 'created', job: { flags: 'snapshot_missing' }, warnings: [{ code: 'page_not_fetched', params: { status: 404 } }] },
    });
  });

  it('saves pasted text', () => {
    const { api } = setup();
    const text = 'Backend Developer\n\nWe are hiring a developer for our team and you will work with us.';
    expect(api('saveJob', { url: 'https://example.com/blocked', text })).toMatchObject({
      ok: true,
      data: { job: { title: 'Backend Developer', parser_id: 'manual' } },
    });
  });

  it('validates arguments', () => {
    const { api } = setup();
    for (const args of [undefined, 'x', { url: 5 }, { url: 'https://example.com/a', text: 5 }, { url: 'https://example.com/a', overrides: 'x' },
      { url: 'https://example.com/a', overrides: { id: 'hack' } }, { url: 'https://example.com/a', overrides: { salary_min: 'lots' } },
      { url: 'https://example.com/a', overrides: { is_gig: 'yes' } }]) {
      expect(api('saveJob', args), JSON.stringify(args)).toMatchObject({ ok: false, error: { code: 'invalid_arguments' } });
    }
    expect(api('saveJob', { url: 'ftp://x.cz/a' })).toMatchObject({ ok: false, error: { code: 'url_invalid' } });
  });
});
