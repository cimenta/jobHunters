import { describe, expect, it } from 'vitest';
import type { FetchResult } from '../jobs/fetcher';
import type { JobParser } from '../jobs/parsed-job';
import { emptyParsedJob } from '../jobs/parsed-job';
import { evaluateAvailability, type AvailabilityContext } from './rules';

const URL1 = 'https://www.example.com/jobs/42';
const page = (patch: Partial<FetchResult> = {}): FetchResult => ({ status: 200, finalUrl: URL1, html: '<p>Senior engineer wanted</p>', ...patch });
const ctx = (result: FetchResult, patch: Partial<AvailabilityContext> = {}): AvailabilityContext => ({
  job: { url: URL1, valid_until: '' }, result, offlineTexts: ['position has been filled'], today: '2026-10-12', ...patch,
});
const verdictOf = (result: FetchResult, patch: Partial<AvailabilityContext> = {}) => evaluateAvailability(ctx(result, patch));

describe('availability rules', () => {
  it('says online for a normal page', () => {
    expect(verdictOf(page())).toMatchObject({ availability: 'online', rule: 'default' });
  });

  it('says offline for 404 and 410', () => {
    expect(verdictOf(page({ status: 404, html: '' }))).toEqual({ availability: 'offline', rule: 'http_gone', reason: '404' });
    expect(verdictOf(page({ status: 410, html: '' }))).toMatchObject({ availability: 'offline', rule: 'http_gone' });
  });

  it('says unknown, never offline, for blocked, failed and server-error answers', () => {
    for (const status of [0, 401, 403, 407, 429, 500, 503]) {
      expect(verdictOf(page({ status, html: '' })), String(status)).toMatchObject({ availability: 'unknown', rule: 'unknown_response' });
    }
    expect(verdictOf(page({ status: 302, html: '' }))).toMatchObject({ availability: 'unknown', rule: 'default' });
  });

  it('says offline when the download ended on another address', () => {
    expect(verdictOf(page({ finalUrl: 'https://www.example.com/jobs' }))).toMatchObject({ availability: 'offline', rule: 'redirect_elsewhere' });
    expect(verdictOf(page({ finalUrl: 'https://www.example.com/' }))).toMatchObject({ availability: 'offline', rule: 'redirect_elsewhere' });
  });

  it('treats the same ad under another spelling of its address as the same', () => {
    for (const finalUrl of ['http://example.com/jobs/42', 'https://www.example.com/jobs/42/', 'https://example.com/jobs/42?utm_source=x']) {
      expect(verdictOf(page({ finalUrl })), finalUrl).toMatchObject({ availability: 'online' });
    }
  });

  it('says unknown for a redirect to a login or captcha page', () => {
    expect(verdictOf(page({ finalUrl: 'https://www.example.com/login?next=/jobs/42' }))).toMatchObject({ availability: 'unknown', rule: 'unknown_response', reason: 'login' });
    expect(verdictOf(page({ finalUrl: 'https://www.example.com/captcha' }))).toMatchObject({ availability: 'unknown' });
  });

  it('says offline when valid_until has passed, not when it is today or later', () => {
    const job = (valid_until: string) => ({ job: { url: URL1, valid_until } });
    expect(verdictOf(page(), job('2026-10-11'))).toEqual({ availability: 'offline', rule: 'valid_until_past', reason: '2026-10-11' });
    expect(verdictOf(page(), job('2026-10-12T10:00:00Z'))).toMatchObject({ availability: 'online' });
    expect(verdictOf(page(), job('2026-12-31'))).toMatchObject({ availability: 'online' });
    expect(verdictOf(page(), job('soon'))).toMatchObject({ availability: 'online' });
  });

  it('says offline when the page holds an offline text, whatever its case', () => {
    expect(verdictOf(page({ html: '<p>Sorry, THIS Position Has Been Filled.</p>' }))).toEqual({ availability: 'offline', rule: 'offline_text', reason: 'position has been filled' });
    expect(verdictOf(page({ html: 'text' }), { offlineTexts: ['', '  '] })).toMatchObject({ availability: 'online' });
  });

  it('lets an unknown answer win over the other rules', () => {
    expect(verdictOf(page({ status: 403, html: 'position has been filled' }))).toMatchObject({ availability: 'unknown' });
  });

  it('asks the parser of the portal first, after the unknown answers', () => {
    const parser: JobParser = {
      id: 'x', matches: () => true, parse: () => emptyParsedJob(),
      detectAvailability: (result) => (result.html.includes('CLOSED') ? { availability: 'offline', reason: 'closed banner' } : undefined),
    };
    expect(verdictOf(page({ html: 'CLOSED' }), { parser })).toEqual({ availability: 'offline', rule: 'portal', reason: 'closed banner' });
    expect(verdictOf(page({ html: 'open' }), { parser })).toMatchObject({ availability: 'online' });
    expect(verdictOf(page({ status: 429, html: 'CLOSED' }), { parser })).toMatchObject({ rule: 'unknown_response' });
  });
});
