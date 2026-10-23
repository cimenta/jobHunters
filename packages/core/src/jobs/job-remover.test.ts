import { describe, expect, it } from 'vitest';
import { InMemoryRepository } from '../repository';
import { FakeDrive } from '../testing/fake-drive';
import { errorOf } from '../testing/errors';
import { makeApplication, makeJob } from '../testing/fixtures';
import type { AiTask, Application, Communication, Job } from '../types';
import { JobRemover } from './job-remover';

class ListFailsDrive extends FakeDrive {
  override listChildren(): never {
    throw new Error('Drive is down');
  }
}
class TrashFailsDrive extends FakeDrive {
  override trashFolder(): never {
    throw new Error('Drive is down');
  }
}

const task = (id: string, jobId: string): AiTask =>
  ({ id, created_at: '', application_id: '', job_id: jobId, type: 'match_job', target_type: 'job', target_id: jobId, status: 'pending' }) as AiTask;

function setup(drive: FakeDrive = new FakeDrive()) {
  const root = drive.ensureFolder(null, 'JobHunters');
  const jobFolder = drive.ensureFolder(root.id, 'Android Developer');
  drive.ensureFolder(jobFolder.id, 'Ad 2026-10-01');
  const jobs = new InMemoryRepository<Job>([
    makeJob({ id: 'j1', status: '', folder_url: jobFolder.url }),
    makeJob({ id: 'j2', status: 'no', folder_url: '' }),
    makeJob({ id: 'j3', status: 'awaiting', folder_url: '' }),
    makeJob({ id: 'j4', status: '', folder_url: jobFolder.url }), // same company and title: the same folder
  ]);
  const tasks = new InMemoryRepository<AiTask>([task('t1', 'j1'), task('t2', 'j1'), task('t3', 'j2')]);
  const applications = new InMemoryRepository<Application>([makeApplication({ id: 'a1', job_id: 'j2' })]);
  const errors: string[] = [];
  const remover = new JobRemover({ jobs, tasks, applications, drive, onError: (where) => errors.push(where) });
  return { remover, jobs, tasks, applications, drive, root, jobFolder, errors };
}

describe('JobRemover', () => {
  it('deletes a job of any status and its AI tasks, and nothing else', () => {
    const { remover, jobs, tasks } = setup();
    expect(remover.remove('j3', { trashFolder: false })).toEqual({ removedTasks: 0, folderTrashed: false, warnings: [] });
    expect(remover.remove('j1', { trashFolder: false })).toEqual({ removedTasks: 2, folderTrashed: false, warnings: [] });
    expect(jobs.list().map((j) => j.id)).toEqual(['j2', 'j4']);
    expect(tasks.list().map((t) => t.id)).toEqual(['t3']);
  });

  it('deletes the entries kept on the job with it, and leaves the entries of other jobs and of applications', () => {
    const entry = (id: string, jobId: string, applicationId: string): Communication => ({
      id, application_id: applicationId, datetime: '2026-10-01T10:00:00.000Z', direction: 'note', channel: 'other', contact_id: '', summary: id, details: '', attachment_url: '', kind: 'message', job_id: jobId,
    });
    const { jobs, tasks, applications, drive } = setup();
    const communications = new InMemoryRepository<Communication>([entry('c1', 'j1', ''), entry('c2', 'j4', ''), entry('c3', '', 'a1')]);
    new JobRemover({ jobs, tasks, applications, communications, drive }).remove('j1', { trashFolder: false });
    expect(communications.list().map((c) => c.id)).toEqual(['c2', 'c3']);
  });

  it('refuses a job that has an application and an unknown job', () => {
    const { remover, jobs, tasks } = setup();
    expect(errorOf(() => remover.remove('j2', { trashFolder: false }))).toMatchObject({ code: 'job_not_deletable', params: { id: 'j2' } });
    expect(errorOf(() => remover.remove('nope', { trashFolder: false }))).toMatchObject({ code: 'job_not_found' });
    expect(jobs.get('j2')).toBeDefined();
    expect(tasks.list()).toHaveLength(3);
  });

  it('trashes the folder when it holds only saved ads and no other job uses it', () => {
    const { remover, jobs, drive, jobFolder } = setup();
    jobs.remove('j4');
    const result = remover.remove('j1', { trashFolder: true });
    expect(result).toMatchObject({ folderTrashed: true, warnings: [] });
    expect(drive.folders.has(jobFolder.id)).toBe(false);
  });

  it('leaves the folder when another job uses it', () => {
    const { remover, drive, jobFolder } = setup();
    const result = remover.remove('j1', { trashFolder: true });
    expect(result.folderTrashed).toBe(false);
    expect(result.warnings).toEqual([{ code: 'job_folder_shared', params: {} }]);
    expect(drive.folders.has(jobFolder.id)).toBe(true);
  });

  it('leaves the folder when it holds anything but saved ads (an application folder or a file)', () => {
    const a = setup();
    a.jobs.remove('j4');
    a.drive.ensureFolder(a.jobFolder.id, 'Example – Android – #1 (2026-10)');
    expect(a.remover.remove('j1', { trashFolder: true }).warnings).toEqual([{ code: 'job_folder_has_other_items', params: {} }]);
    expect(a.drive.folders.has(a.jobFolder.id)).toBe(true);

    const b = setup();
    b.jobs.remove('j4');
    b.drive.saveTextFile(b.jobFolder.id, 'cover-letter.txt', 'x', 'text/plain');
    expect(b.remover.remove('j1', { trashFolder: true }).warnings).toEqual([{ code: 'job_folder_has_other_items', params: {} }]);
  });

  it('does nothing on Drive when the box is off or the job has no folder', () => {
    const { remover, drive, jobFolder } = setup();
    remover.remove('j1', { trashFolder: false });
    expect(drive.folders.has(jobFolder.id)).toBe(true);
    const none = setup();
    expect(none.remover.remove('j3', { trashFolder: true })).toEqual({ removedTasks: 0, folderTrashed: false, warnings: [] });
  });

  it('still deletes the job and warns when Drive fails', () => {
    for (const drive of [new ListFailsDrive(), new TrashFailsDrive()]) {
      const { remover, jobs, errors } = setup(drive);
      jobs.remove('j4');
      const result = remover.remove('j1', { trashFolder: true });
      expect(result.folderTrashed).toBe(false);
      expect(result.warnings).toEqual([{ code: 'job_folder_trash_failed', params: {} }]);
      expect(jobs.get('j1')).toBeUndefined();
      expect(errors).toEqual(['trash-job-folder']);
    }
  });
});
