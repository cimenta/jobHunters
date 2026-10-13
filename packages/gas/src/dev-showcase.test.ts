import { describe, expect, it } from 'vitest';
import { createDevBackend } from './dev';

describe('showcase data for screenshots', () => {
  it('builds fictional jobs, applications in several statuses and AI tasks without failing', () => {
    const backend = createDevBackend({ seed: false, showcase: true, now: () => '2026-10-13T08:00:00.000Z' });
    const jobs = backend.call('listJobs') as { ok: true; data: { title: string; company_name: string; match_percent: number | null; status: string }[] };
    expect(jobs.data.length).toBeGreaterThanOrEqual(8);
    expect(jobs.data.some((job) => job.match_percent === 91)).toBe(true);
    expect(jobs.data.some((job) => job.status === 'awaiting')).toBe(true);
    const applications = backend.call('listApplications') as { ok: true; data: { status: string }[] };
    expect(new Set(applications.data.map((row) => row.status))).toEqual(new Set(['draft', 'sent', 'waiting', 'interview', 'offer', 'rejected']));
    const tasks = backend.call('listAiTasks') as { ok: true; data: { type: string }[] };
    expect(tasks.data.map((task) => task.type).sort()).toEqual(['import_match_job', 'match_job']);
    const names = JSON.stringify(jobs.data);
    expect(names).not.toMatch(/hostile/i);
  });
});
