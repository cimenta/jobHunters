import type { AiTaskService } from '../applications/ai-task-service';
import type { AppWarning } from '../row-codec';
import type { AiTask, Company, Job } from '../types';
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

  /**
   * The user's choice for an ad the app could not read: no download here, a placeholder with ONE AI task that reads the
   * ad, fills in the job and evaluates the match. Needs the candidate experience.
   */
  importWithAi(rawUrl: string): ImportResult {
    const url = rawUrl.trim();
    const parsed = parseUrl(url);
    if (!parsed || (parsed.protocol !== 'http' && parsed.protocol !== 'https')) return { status: 'invalid' };
    const duplicate = this.deps.jobService.duplicateOf(url);
    if (duplicate) return { status: 'duplicate', job: duplicate };
    this.deps.aiTasks.assertExperience();
    const job = this.deps.jobService.createPlaceholder(url);
    const task = this.deps.aiTasks.requestImportAndMatch(job.id);
    return { status: 'queued', job, task, fetchStatus: 0 };
  }
}
