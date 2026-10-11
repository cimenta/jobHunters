import { describe, expect, it } from 'vitest';
import { createDevBackend, DEMO_URL } from './dev';

const NOW = '2026-10-11T08:00:00.000Z';
const data = <T>(result: { ok: boolean; data?: unknown }): T => {
  expect(result.ok).toBe(true);
  return result.data as T;
};

describe('createDevBackend', () => {
  it('starts empty when not seeded', () => {
    const backend = createDevBackend({ now: () => NOW });
    expect(data<unknown[]>(backend.call('listJobs'))).toEqual([]);
  });

  it('seeds demo data that covers the screens', () => {
    const backend = createDevBackend({ seed: true, now: () => NOW });
    expect(data<unknown[]>(backend.call('listJobs')).length).toBeGreaterThanOrEqual(4);
    expect(data<unknown[]>(backend.call('listApplications')).length).toBeGreaterThanOrEqual(2);
    const dashboard = data<{ reminders: { overdue: unknown[]; today: unknown[]; soon: unknown[] } }>(backend.call('getDashboard'));
    expect(dashboard.reminders.overdue.length).toBeGreaterThanOrEqual(1);
    expect(dashboard.reminders.soon.length).toBeGreaterThanOrEqual(1);
    expect(data<unknown[]>(backend.call('listTemplates'))).toHaveLength(2);
  });

  it('serves the demo page to previewJob and answers 404 for others', () => {
    const backend = createDevBackend({ seed: true, now: () => NOW });
    expect(data<{ fetched: boolean; parsed: { title: string } }>(backend.call('previewJob', { url: DEMO_URL }))).toMatchObject({ fetched: true, parsed: { title: 'Demo Engineer' } });
    expect(data<{ fetched: boolean; fetchStatus: number }>(backend.call('previewJob', { url: 'https://example.com/blocked' }))).toMatchObject({ fetched: false, fetchStatus: 404 });
  });
});
