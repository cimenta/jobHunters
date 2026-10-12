import { NotFoundError, ValidationError } from '../errors';
import type { Repository } from '../repository';
import type { AppWarning } from '../row-codec';
import type { AiTask, Application, ApplicationDocument, Job } from '../types';
import type { AiTaskService } from './ai-task-service';
import type { ApplicationFactory } from './application-factory';

export interface PrepareResult {
  application: Application;
  documents: ApplicationDocument[];
  tasks: AiTask[];
  warnings: AppWarning[];
}

export interface ApplicationPreparerDeps {
  jobs: Repository<Job>;
  applications: Repository<Application>;
  factory: ApplicationFactory;
  aiTasks: AiTaskService;
  /** The candidate's experience from Settings. */
  experience: () => string;
  /** Settings.default_document_language. */
  defaultLanguage: () => string;
}

/** "Prepare with AI": creates the application of a job and queues an AI task for each of its documents. */
export class ApplicationPreparer {
  constructor(private readonly deps: ApplicationPreparerDeps) {}

  prepare(jobId: string): PrepareResult {
    const { jobs, applications, factory, aiTasks, experience, defaultLanguage } = this.deps;
    // Everything that can fail is checked before anything is created.
    const job = jobs.get(jobId);
    if (!job) throw new NotFoundError('job_not_found', `Job ${jobId} not found`, { id: jobId });
    if (job.status === 'awaiting') throw new ValidationError('job_awaiting', `Job ${job.id} is waiting for the AI`, { id: job.id });
    if (experience().trim() === '') throw new ValidationError('match_experience_required', 'The experience setting is empty', {});
    if (applications.list().some((application) => application.job_id === job.id)) {
      throw new ValidationError('application_exists', `Job ${job.id} already has an application`, { id: job.id });
    }

    const language = job.language === 'en' || job.language === 'cs' ? job.language : defaultLanguage();
    const created = factory.create({ jobId: job.id, language });
    const warnings = [...created.warnings];
    const tasks: AiTask[] = [];
    for (const document of created.documents) {
      try {
        tasks.push(aiTasks.requestDocument(document.id));
      } catch {
        warnings.push({ code: 'ai_task_failed', params: { type: document.type } });
      }
    }
    return { application: created.application, documents: created.documents, tasks, warnings };
  }
}
