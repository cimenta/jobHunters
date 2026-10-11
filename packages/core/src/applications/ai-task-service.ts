import { NotFoundError, ValidationError } from '../errors';
import type { Repository } from '../repository';
import { DEFAULT_PROMPTS } from '../seed';
import type { AiTask, Application, ApplicationDocument, Company, Job } from '../types';

export interface AiTaskServiceDeps {
  tasks: Repository<AiTask>;
  jobs: Repository<Job>;
  companies: Repository<Company>;
  documents: Repository<ApplicationDocument>;
  applications: Repository<Application>;
  newId: () => string;
  /** ISO 8601 date-time. */
  now: () => string;
  /** The candidate's experience from Settings. */
  experience: () => string;
  /** Language the AI should write in: the language of the app. */
  language: () => string;
}

export interface AiTaskRow extends AiTask {
  job_title: string;
  company_name: string;
}

const ACTIVE = ['pending', 'in_progress'];
const LANGUAGE_NAMES: Record<string, string> = { en: 'English', cs: 'Czech' };

export class AiTaskService {
  constructor(private readonly deps: AiTaskServiceDeps) {}

  /** All tasks, newest first, with the title of their job. */
  list(): AiTaskRow[] {
    const names = new Map(this.deps.companies.list().map((company) => [company.id, company.name]));
    const jobs = new Map(this.deps.jobs.list().map((job) => [job.id, { title: job.title, company: names.get(job.company_id) ?? '' }]));
    return this.deps.tasks.list()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
      .map((task) => ({ ...task, job_title: jobs.get(task.job_id)?.title ?? '', company_name: jobs.get(task.job_id)?.company ?? '' }));
  }

  /** The tasks of one application, newest first. */
  listForApplication(applicationId: string): AiTaskRow[] {
    return this.list().filter((task) => task.application_id === applicationId);
  }

  /** Deletes a task whatever its state, e.g. one the AI left in progress. */
  remove(id: string): void {
    if (!this.deps.tasks.get(id)) throw new NotFoundError('task_not_found', `Task ${id} not found`, { id });
    this.deps.tasks.remove(id);
  }

  /** The newest task that writes the given document. */
  documentTaskFor(documentId: string): AiTask | undefined {
    const found = this.deps.tasks.list().filter((t) => t.target_type === 'document' && t.target_id === documentId);
    return found.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0)).at(-1);
  }

  /** Queues the AI to write the content of a document; a waiting or running task is returned instead of a duplicate. */
  requestDocument(documentId: string, notes = ''): AiTask {
    const { tasks, documents, applications, newId, now, experience } = this.deps;
    const doc = documents.get(documentId);
    if (!doc) throw new NotFoundError('document_not_found', `Document ${documentId} not found`, { id: documentId });
    const application = applications.get(doc.application_id);
    if (!application) throw new NotFoundError('application_not_found', `Application ${doc.application_id} not found`, { id: doc.application_id });
    if (experience().trim() === '') throw new ValidationError('match_experience_required', 'The experience setting is empty', {});
    const current = this.documentTaskFor(documentId);
    if (current && ACTIVE.includes(current.status)) return current;
    const type = doc.type === 'resume' ? 'resume_tailor' : doc.type === 'cover_letter' ? 'cover_letter' : 'other';
    const standing = DEFAULT_PROMPTS.find((p) => p.type === type)?.instruction ?? '';
    const language = LANGUAGE_NAMES[application.language] ?? 'English';
    const extra = notes.trim();
    return tasks.insert({
      id: newId(), created_at: now(), application_id: application.id, job_id: application.job_id, type, target_type: 'document', target_id: doc.id,
      instructions: [
        `Write the content of the Google Doc in the Documents sheet row ${doc.id} (doc_url) for the application ${application.id}. Replace placeholders and fill an empty Doc; keep the layout of the template.`,
        `Use the job ad in the Jobs sheet row ${application.job_id}, the Profile sheet and the candidate_experience setting. Write in ${language}. Never invent experience.`,
        standing,
        extra === '' ? '' : `Instructions from the user: ${extra}`,
        'When finished set the status to done and put a short note in ai_note.',
      ].filter((line) => line !== '').join(' '),
      status: 'pending', ai_note: '', completed_at: '',
    });
  }

  /** The newest match task of a job, whatever its state. */
  matchFor(jobId: string): AiTask | undefined {
    const found = this.deps.tasks.list().filter((t) => t.type === 'match_job' && t.job_id === jobId);
    return found.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0)).at(-1);
  }

  /** Queues a match evaluation; an already waiting or running one is returned instead of a duplicate. */
  requestMatch(jobId: string): AiTask {
    const { tasks, jobs, newId, now, experience, language } = this.deps;
    if (!jobs.get(jobId)) throw new NotFoundError('job_not_found', `Job ${jobId} not found`, { id: jobId });
    if (experience().trim() === '') throw new ValidationError('match_experience_required', 'The experience setting is empty', {});
    const current = this.matchFor(jobId);
    if (current && ACTIVE.includes(current.status)) return current;
    const name = LANGUAGE_NAMES[language()] ?? 'English';
    return tasks.insert({
      id: newId(), created_at: now(), application_id: '', job_id: jobId, type: 'match_job', target_type: 'job', target_id: jobId,
      instructions:
        `Evaluate whether the candidate described in the Settings sheet (key candidate_experience, plus the Profile sheet) is a suitable candidate for the job in the Jobs sheet with id ${jobId}. ` +
        `Write a concise evaluation (strengths, gaps, overall verdict) in ${name} into ai_note and set the status to done.`,
      status: 'pending', ai_note: '', completed_at: '',
    });
  }

  /** Withdraws a task that nobody has started yet. */
  cancel(id: string): void {
    const task = this.deps.tasks.get(id);
    if (!task) throw new NotFoundError('task_not_found', `Task ${id} not found`, { id });
    if (task.status !== 'pending') throw new ValidationError('task_not_cancellable', `Task ${id} is ${task.status}`, { id });
    this.deps.tasks.remove(id);
  }
}
