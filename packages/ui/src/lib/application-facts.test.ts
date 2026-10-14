import type { ApplicationRow } from '@jobhunters/core';
import { describe, expect, it } from 'vitest';
import { matchOf, sortExtra } from './application-facts';

const row = (over: Partial<ApplicationRow> = {}): ApplicationRow => ({
  id: 'a', job_id: 'j', attempt: 1, label: 'L', language: 'en', status: 'sent', applied_at: '', last_activity_at: '', snapshot_used: '', folder_url: '', notes: '', board_position: null,
  job_title: 'T', company_name: 'C', match_percent: null, salary_min: null, salary_max: null, salary_currency: '', salary_period: '', created_at: '', waiting_since: '', ...over,
});
const NOW = Date.parse('2026-10-14T12:00:00.000Z');

describe('matchOf', () => {
  it('is a finite number or undefined', () => {
    expect(matchOf(row({ match_percent: 82 }))).toBe(82);
    expect(matchOf(row())).toBeUndefined();
    expect(matchOf({ ...row(), match_percent: undefined } as unknown as ApplicationRow)).toBeUndefined();
    expect(matchOf(row({ match_percent: Number.NaN }))).toBeUndefined();
  });
});

describe('sortExtra', () => {
  it('says what the card is sorted by, only for created, sent and waiting', () => {
    expect(sortExtra(row({ created_at: '2026-10-01T10:00:00.000Z' }), 'created', NOW)).toMatch(/^Created /);
    expect(sortExtra(row({ applied_at: '2026-10-02T10:00:00.000Z' }), 'sent', NOW)).toMatch(/^Sent /);
    expect(sortExtra(row(), 'sent', NOW)).toBe('Not sent');
    expect(sortExtra(row({ waiting_since: '2026-10-09T12:00:00.000Z' }), 'waiting', NOW)).toBe('Waiting for 5 d');
    expect(sortExtra(row({ status: 'sent' }), 'waiting', NOW)).toBe('Not waiting');
    expect(sortExtra(row({ match_percent: 5 }), 'match', NOW)).toBe('');
    expect(sortExtra(row(), 'manual', NOW)).toBe('');
    expect(sortExtra(row(), 'default', NOW)).toBe('');
  });
  it('shows nothing for a waiting application whose start is unknown', () => {
    expect(sortExtra(row({ status: 'waiting' }), 'waiting', NOW)).toBe('');
  });
  it('shows nothing for a missing created date', () => {
    expect(sortExtra(row(), 'created', NOW)).toBe('');
  });
});
