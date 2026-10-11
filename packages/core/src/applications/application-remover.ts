import { fileIdFromUrl, type DriveGateway } from '../drive';
import { NotFoundError } from '../errors';
import type { Repository } from '../repository';
import type { AppWarning } from '../row-codec';
import type { Application, ApplicationDocument, Communication, Question, Reminder } from '../types';

export interface ApplicationRemoverDeps {
  applications: Repository<Application>;
  documents: Repository<ApplicationDocument>;
  questions: Repository<Question>;
  communications: Repository<Communication>;
  reminders: Repository<Reminder>;
  drive: DriveGateway;
  /** Reports a swallowed failure to the Log. */
  onError?: (where: string, error: unknown) => void;
}

export interface RemoveResult {
  removed: { documents: number; questions: number; communications: number; reminders: number };
  folderTrashed: boolean;
  warnings: AppWarning[];
}

export class ApplicationRemover {
  constructor(private readonly deps: ApplicationRemoverDeps) {}

  /**
   * Deletes the application and its documents, questions, communication and reminders. The status history is an
   * append-only log and stays. The Drive folder is moved to the trash (recoverable) only when asked; a Drive failure
   * never undoes the deletion, it becomes a warning.
   */
  remove(applicationId: string, options: { trashFolder: boolean }): RemoveResult {
    const { applications, documents, questions, communications, reminders, drive } = this.deps;
    const application = applications.get(applicationId);
    if (!application) throw new NotFoundError('application_not_found', `Application ${applicationId} not found`, { id: applicationId });

    const own = <T extends { application_id: string; id: string }>(repository: Repository<T>): T[] =>
      repository.list().filter((row) => row.application_id === applicationId);
    const removeAll = <T extends { application_id: string; id: string }>(repository: Repository<T>): number => {
      const rows = own(repository);
      for (const row of rows) repository.remove(row.id);
      return rows.length;
    };
    const removed = {
      documents: removeAll(documents),
      questions: removeAll(questions),
      communications: removeAll(communications),
      reminders: removeAll(reminders),
    };
    applications.remove(applicationId);

    const warnings: AppWarning[] = [];
    let folderTrashed = false;
    const folderId = fileIdFromUrl(application.folder_url);
    if (options.trashFolder && folderId !== '') {
      try {
        drive.trashFolder(folderId);
        folderTrashed = true;
      } catch (error) {
        this.report('trash-folder', error);
        warnings.push({ code: 'folder_trash_failed', params: {} });
      }
    }
    return { removed, folderTrashed, warnings };
  }

  private report(where: string, error: unknown): void {
    try {
      this.deps.onError?.(where, error);
    } catch {
      // Reporting must never break the flow.
    }
  }
}
