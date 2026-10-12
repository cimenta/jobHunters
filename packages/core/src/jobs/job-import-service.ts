import { NotFoundError, ValidationError } from '../errors';
import type { AiTaskService } from '../applications/ai-task-service';
import type { Repository } from '../repository';
import type { AppWarning } from '../row-codec';
import type { AiTask, Application, Company, Job } from '../types';
import type { JobService } from './job-service';
import { parseUrl } from './url';

export type ImportResult =
  | { status: 'invalid' }
  | { status: 'duplicate'; job: Job }
  | { status: 'saved'; job: Job; company: Company | undefined; warnings: AppWarning[] }
  | { status: 'queued'; job: Job; task: AiTask; fetchStatus: number };

export interface JobImportDeps {
  jobService: JobService;
  aiTasks: AiTaskService;
  jobs: Repository<Job>;
  tasks: Repository<AiTask>;
  companies: Repository<Company>;
  applications: Repository<Application>;
}

export class JobImportService {
  constructor(private readonly deps: JobImportDeps) {}

  /** Saves a readable ad; an ad that cannot be read becomes a placeholder with one AI task. */
  importOne(rawUrl: string): ImportResult {
    const url = rawUrl.trim();
    const parsed = parseUrl(url);
    if (!parsed || (parsed.protocol !== 'http' && parsed.protocol !== 'https')) return { status: 'invalid' };
    const saved = this.deps.jobService.saveIfReadable({ url });
    if (saved.status !== 'unreadable') {
      if (saved.status === 'duplicate') return { status: 'duplicate', job: saved.job };
      return { status: 'saved', job: saved.job, company: saved.company, warnings: saved.warnings };
    }
    const job = this.deps.jobService.createPlaceholder(url);
    const task = this.deps.aiTasks.requestImport(job.id);
    return { status: 'queued', job, task, fetchStatus: saved.fetchStatus };
  }

  /** Deletes a job that still waits for the AI together with its tasks. */
  deleteAwaiting(id: string): void {
    const { jobs, tasks, applications } = this.deps;
    const job = jobs.get(id);
    if (!job) throw new NotFoundError('job_not_found', `Job ${id} not found`, { id });
    if (job.status !== 'awaiting') throw new ValidationError('job_not_deletable', `Job ${id} is not awaiting`, { id });
    if (applications.list().some((application) => application.job_id === id)) {
      throw new ValidationError('job_not_deletable', `Job ${id} has an application`, { id });
    }
    for (const task of tasks.list().filter((t) => t.job_id === id)) tasks.remove(task.id);
    jobs.remove(id);
  }
}
