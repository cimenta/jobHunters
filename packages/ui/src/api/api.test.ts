import { describe, expect, it } from 'vitest';
import { useDevBackend } from '../test/transport';
import { api } from './index';

describe('typed api over the dev backend', () => {
  it('reads and writes through the real handlers', async () => {
    useDevBackend();
    const jobs = await api.listJobs();
    expect(jobs.length).toBeGreaterThanOrEqual(4);
    const detail = await api.getJob(jobs[0]!.id);
    expect(detail.job.id).toBe(jobs[0]!.id);
    const updated = await api.updateJob(jobs[0]!.id, { notes: 'Checked' });
    expect(updated.notes).toBe('Checked');
    await expect(api.getJob('ghost')).rejects.toMatchObject({ code: 'job_not_found' });
  });
});
