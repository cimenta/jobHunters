import { fileIdFromUrl, type DriveGateway } from '../drive';
import { NotFoundError, ValidationError } from '../errors';
import type { Repository } from '../repository';
import type { AppWarning } from '../row-codec';
import type { AiTask, Application, Job } from '../types';

export interface JobRemoverDeps {
  jobs: Repository<Job>;
  tasks: Repository<AiTask>;
  applications: Repository<Application>;
  drive: DriveGateway;
  /** Reports a swallowed failure to the Log. */
  onError?: (where: string, error: unknown) => void;
}

export interface JobRemoveResult {
  removedTasks: number;
  folderTrashed: boolean;
  warnings: AppWarning[];
}

/** The folder a job made for its saved ads: `Ad <date>`. */
const SAVED_AD_FOLDER = /^Ad \d{4}-\d{2}-\d{2}$/;

export class JobRemover {
  constructor(private readonly deps: JobRemoverDeps) {}

  /**
   * Deletes a job that has no application, together with its AI tasks. The job folder on Drive is moved to the trash
   * (recoverable) only when asked AND only when it is safe: no other job uses it and it holds nothing but saved ads
   * (the folders of applications live inside it too). A Drive problem never undoes the deletion, it becomes a warning.
   */
  remove(jobId: string, options: { trashFolder: boolean }): JobRemoveResult {
    const { jobs, tasks, applications, drive } = this.deps;
    const job = jobs.get(jobId);
    if (!job) throw new NotFoundError('job_not_found', `Job ${jobId} not found`, { id: jobId });
    if (applications.list().some((application) => application.job_id === jobId)) {
      throw new ValidationError('job_not_deletable', `Job ${jobId} has an application`, { id: jobId });
    }

    const folderId = fileIdFromUrl(job.folder_url);
    const shared = folderId !== '' && jobs.list().some((other) => other.id !== jobId && fileIdFromUrl(other.folder_url) === folderId);

    const own = tasks.list().filter((task) => task.job_id === jobId);
    for (const task of own) tasks.remove(task.id);
    jobs.remove(jobId);

    const warnings: AppWarning[] = [];
    let folderTrashed = false;
    if (options.trashFolder && folderId !== '') {
      if (shared) {
        warnings.push({ code: 'job_folder_shared', params: {} });
      } else {
        try {
          const { folders, files } = drive.listChildren(folderId);
          if (files === 0 && folders.every((name) => SAVED_AD_FOLDER.test(name))) {
            drive.trashFolder(folderId);
            folderTrashed = true;
          } else {
            warnings.push({ code: 'job_folder_has_other_items', params: {} });
          }
        } catch (error) {
          this.report('trash-job-folder', error);
          warnings.push({ code: 'job_folder_trash_failed', params: {} });
        }
      }
    }
    return { removedTasks: own.length, folderTrashed, warnings };
  }

  private report(where: string, error: unknown): void {
    try {
      this.deps.onError?.(where, error);
    } catch {
      // Reporting must never break the flow.
    }
  }
}
