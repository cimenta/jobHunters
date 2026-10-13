import { NotFoundError, ValidationError } from '../errors';
import { renderPrompt } from '../prompt';
import type { Repository } from '../repository';
import type { PromptType } from '../seed';
import type { AiTask, Application, ApplicationDocument, Company, Job, Question } from '../types';

export interface AiTaskServiceDeps {
  tasks: Repository<AiTask>;
  jobs: Repository<Job>;
  companies: Repository<Company>;
  documents: Repository<ApplicationDocument>;
  questions: Repository<Question>;
  applications: Repository<Application>;
  newId: () => string;
  /** ISO 8601 date-time. */
  now: () => string;
  /** The candidate's experience from Settings. */
  experience: () => string;
  /** Language the AI should write in: the language of the app. */
  language: () => string;
  /** The prompt template of a task type from Settings. */
  prompt: (type: PromptType) => string;
}

export interface AiTaskRow extends AiTask {
  job_title: string;
  company_name: string;
}

const ACTIVE = ['pending', 'in_progress'];
const LANGUAGE_NAMES: Record<string, string> = { en: 'English', cs: 'Czech' };

/** Task types whose result is the match evaluation of a job. */
const MATCH_TYPES: readonly string[] = ['match_job', 'import_match_job'];

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
    const task = this.deps.tasks.get(id);
    if (!task) throw new NotFoundError('task_not_found', `Task ${id} not found`, { id });
    this.deps.tasks.remove(id);
    if (task.type === 'import_job' || task.type === 'import_match_job') {
      const job = this.deps.jobs.get(task.job_id);
      if (job && job.status === 'awaiting') this.deps.jobs.remove(job.id);
    }
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
    const extra = notes.trim();
    const id = newId();
    const instructions = renderPrompt(this.deps.prompt(type), {
      task_id: id, document_id: doc.id, application_id: application.id, job_id: application.job_id,
      language: LANGUAGE_NAMES[application.language] ?? 'English',
      notes: extra === '' ? '' : `Instructions from the user: ${extra}`,
    });
    return tasks.insert({
      id, created_at: now(), application_id: application.id, job_id: application.job_id, type, target_type: 'document', target_id: doc.id,
      instructions,
      status: 'pending', ai_note: '', completed_at: '',
    });
  }

  /** The newest task that answers the given question. */
  questionTaskFor(questionId: string): AiTask | undefined {
    const found = this.deps.tasks.list().filter((t) => t.target_type === 'question' && t.target_id === questionId);
    return found.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0)).at(-1);
  }

  /** Queues the AI to answer a question; a waiting or running task is returned instead of a duplicate. */
  requestQuestion(questionId: string, notes = ''): AiTask {
    const { tasks, questions, applications, newId, now, experience } = this.deps;
    const question = questions.get(questionId);
    if (!question) throw new NotFoundError('question_not_found', `Question ${questionId} not found`, { id: questionId });
    const application = applications.get(question.application_id);
    if (!application) throw new NotFoundError('application_not_found', `Application ${question.application_id} not found`, { id: question.application_id });
    if (experience().trim() === '') throw new ValidationError('match_experience_required', 'The experience setting is empty', {});
    const current = this.questionTaskFor(questionId);
    if (current && ACTIVE.includes(current.status)) return current;
    const extra = notes.trim();
    const id = newId();
    const instructions = renderPrompt(this.deps.prompt('answer_question'), {
      task_id: id, question_id: question.id, application_id: application.id, job_id: application.job_id,
      language: LANGUAGE_NAMES[application.language] ?? 'English',
      limit: question.max_sentences === null ? '' : `The answer must not exceed ${question.max_sentences} sentences.`,
      notes: extra === '' ? '' : `Instructions from the user: ${extra}`,
    });
    return tasks.insert({
      id, created_at: now(), application_id: application.id, job_id: application.job_id, type: 'answer_question', target_type: 'question', target_id: question.id,
      instructions,
      status: 'pending', ai_note: '', completed_at: '',
    });
  }

  /** One task for every question of the application that has no answer and no waiting task. */
  requestOpenQuestions(applicationId: string): AiTask[] {
    const open = this.deps.questions.list().filter((q) => q.application_id === applicationId && q.answer.trim() === '');
    const created: AiTask[] = [];
    for (const question of open) {
      const current = this.questionTaskFor(question.id);
      if (current && ACTIVE.includes(current.status)) continue;
      created.push(this.requestQuestion(question.id));
    }
    return created;
  }

  /** The newest match task of a job, whatever its state. */
  matchFor(jobId: string): AiTask | undefined {
    const found = this.deps.tasks.list().filter((t) => MATCH_TYPES.includes(t.type) && t.job_id === jobId);
    return found.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0)).at(-1);
  }

  /** Queues a match evaluation; an already waiting or running one is returned instead of a duplicate. */
  requestMatch(jobId: string): AiTask {
    const { tasks, jobs, newId, now, experience, language } = this.deps;
    const job = jobs.get(jobId);
    if (!job) throw new NotFoundError('job_not_found', `Job ${jobId} not found`, { id: jobId });
    if (job.status === 'awaiting') throw new ValidationError('job_awaiting', `Job ${jobId} is waiting for the AI`, { id: jobId });
    if (experience().trim() === '') throw new ValidationError('match_experience_required', 'The experience setting is empty', {});
    const current = this.matchFor(jobId);
    if (current && ACTIVE.includes(current.status)) return current;
    const name = LANGUAGE_NAMES[language()] ?? 'English';
    const id = newId();
    return tasks.insert({
      id, created_at: now(), application_id: '', job_id: jobId, type: 'match_job', target_type: 'job', target_id: jobId,
      instructions: renderPrompt(this.deps.prompt('match_job'), { task_id: id, job_id: jobId, language: name }),
      status: 'pending', ai_note: '', completed_at: '',
    });
  }

  /** Queues the AI to read an ad the app could not download; needs no experience. */
  requestImport(jobId: string): AiTask {
    const { tasks, jobs, newId, now, language } = this.deps;
    const job = jobs.get(jobId);
    if (!job) throw new NotFoundError('job_not_found', `Job ${jobId} not found`, { id: jobId });
    const current = tasks.list().filter((t) => t.type === 'import_job' && t.job_id === jobId && ACTIVE.includes(t.status)).at(0);
    if (current) return current;
    const id = newId();
    return tasks.insert({
      id, created_at: now(), application_id: '', job_id: jobId, type: 'import_job', target_type: 'job', target_id: jobId,
      instructions: renderPrompt(this.deps.prompt('import_job'), { task_id: id, job_id: jobId, url: job.url, language: LANGUAGE_NAMES[language()] ?? 'English' }),
      status: 'pending', ai_note: '', completed_at: '',
    });
  }

  /** The experience setting must be filled in before the AI evaluates a match. */
  assertExperience(): void {
    if (this.deps.experience().trim() === '') throw new ValidationError('match_experience_required', 'The experience setting is empty', {});
  }

  /**
   * Queues one AI task that reads an ad the app did not download, fills in its job and evaluates the match, so the AI
   * has all the information at once. Needs the candidate experience.
   */
  requestImportAndMatch(jobId: string): AiTask {
    const { tasks, jobs, newId, now, language } = this.deps;
    const job = jobs.get(jobId);
    if (!job) throw new NotFoundError('job_not_found', `Job ${jobId} not found`, { id: jobId });
    this.assertExperience();
    const current = tasks.list().filter((t) => t.type === 'import_match_job' && t.job_id === jobId && ACTIVE.includes(t.status)).at(0);
    if (current) return current;
    const id = newId();
    return tasks.insert({
      id, created_at: now(), application_id: '', job_id: jobId, type: 'import_match_job', target_type: 'job', target_id: jobId,
      instructions: renderPrompt(this.deps.prompt('import_match_job'), { task_id: id, job_id: jobId, url: job.url, language: LANGUAGE_NAMES[language()] ?? 'English' }),
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
