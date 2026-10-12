import { describe, expect, it } from 'vitest';
import { InMemoryRepository } from '../repository';
import { errorOf } from '../testing/errors';
import { makeApplication, makeJob, sequentialIds } from '../testing/fixtures';
import type { AiTask, Application, ApplicationDocument, Company, Job, Question } from '../types';
import { DEFAULT_PROMPTS, type PromptType } from '../seed';
import { AiTaskService } from './ai-task-service';

function setup(experience = 'Ten years of TypeScript', templates: Partial<Record<PromptType, string>> = {}) {
  const tasks = new InMemoryRepository<AiTask>();
  const jobs = new InMemoryRepository<Job>([makeJob({ id: 'j1', company_id: 'c1' })]);
  const service = new AiTaskService({
    tasks,
    jobs,
    companies: new InMemoryRepository<Company>([{ id: 'c1', name: 'Example s.r.o.', website: '', notes: '' }]),
    applications: new InMemoryRepository<Application>([makeApplication({ id: 'a1', job_id: 'j1', language: 'cs' })]),
    questions: new InMemoryRepository<Question>([
      { id: 'q1', application_id: 'a1', position: 1, question: 'Why us?', answer: '', max_sentences: 500, status: 'open', created_at: '', updated_at: '' },
      { id: 'q2', application_id: 'a1', position: 2, question: 'Salary?', answer: '', max_sentences: null, status: 'open', created_at: '', updated_at: '' },
      { id: 'q3', application_id: 'a1', position: 3, question: 'Notice period?', answer: 'Two months', max_sentences: null, status: 'answered', created_at: '', updated_at: '' },
    ]),
    documents: new InMemoryRepository<ApplicationDocument>([
      { id: 'd1', application_id: 'a1', type: 'cover_letter', doc_url: 'https://docs.google.com/document/d/x/edit', pdf_url: '', template_id: '', created_at: '', pdf_exported_at: '' },
      { id: 'd2', application_id: 'a1', type: 'resume', doc_url: 'https://docs.google.com/document/d/y/edit', pdf_url: '', template_id: '', created_at: '', pdf_exported_at: '' },
    ]),
    newId: sequentialIds('t'),
    now: () => '2026-10-11T08:00:00.000Z',
    experience: () => experience,
    language: () => 'cs',
    prompt: (type) => templates[type] ?? DEFAULT_PROMPTS.find((p) => p.type === type)!.instruction,
  });
  return { tasks, jobs, service };
}

describe('AiTaskService prompts', () => {
  it('fills the placeholders of the template from Settings and drops lines left empty', () => {
    const { service } = setup('Ten years of TypeScript', {
      cover_letter: 'Doc {{document_id}} of {{application_id}} in {{language}}.\n{{notes}}\nKeep it short. {{unknown}}',
      answer_question: 'Q {{question_id}}\n{{limit}}\nEnd',
      match_job: 'Job {{job_id}} in {{language}}',
    });
    expect(service.requestDocument('d1').instructions).toBe('Doc d1 of a1 in Czech.\nKeep it short. {{unknown}}');
    expect(service.requestDocument('d2', 'Be bold').instructions).toContain('Instructions from the user: Be bold');
    expect(service.requestQuestion('q1').instructions).toBe('Q q1\nThe answer must not exceed 500 sentences.\nEnd');
    expect(service.requestQuestion('q2').instructions).toBe('Q q2\nEnd');
    expect(service.requestMatch('j1').instructions).toBe('Job j1 in Czech');
  });

  it('uses the default templates with the ids the AI needs to find the rows', () => {
    const { service } = setup();
    const text = service.requestDocument('d1').instructions;
    expect(text).toContain('the sheet Documents, the row with id d1');
    expect(text).toContain('the sheet Tasks, the row with id t');
    expect(text).toContain('the row with key candidate_experience');
    expect(text).toContain('at most 250 words');
    expect(text).not.toMatch(/{{(task_id|document_id|application_id|job_id|language|notes)}}/);
    expect(service.requestDocument('d2').instructions).toContain('Tailor the resume');
  });
});

describe('AiTaskService', () => {
  it('queues a match task and asks for the language of the app', () => {
    const { service } = setup();
    const task = service.requestMatch('j1');
    expect(task).toMatchObject({ type: 'match_job', target_type: 'job', target_id: 'j1', job_id: 'j1', status: 'pending' });
    expect(task.instructions).toContain('Czech');
    expect(service.matchFor('j1')?.id).toBe(task.id);
  });

  it('does not queue a second task while one is waiting or running', () => {
    const { service, tasks } = setup();
    const first = service.requestMatch('j1');
    expect(service.requestMatch('j1').id).toBe(first.id);
    tasks.update(first.id, { status: 'in_progress' });
    expect(service.requestMatch('j1').id).toBe(first.id);
    expect(tasks.list()).toHaveLength(1);
  });

  it('queues a new task after the previous one finished', () => {
    const { service, tasks } = setup();
    const first = service.requestMatch('j1');
    tasks.update(first.id, { status: 'done', ai_note: 'Good fit' });
    const second = service.requestMatch('j1');
    expect(second.id).not.toBe(first.id);
    expect(service.matchFor('j1')?.id).toBe(second.id);
  });

  it('needs the experience text and an existing job', () => {
    expect(errorOf(() => setup('  ').service.requestMatch('j1'))).toMatchObject({ code: 'match_experience_required' });
    expect(errorOf(() => setup().service.requestMatch('zz'))).toMatchObject({ code: 'job_not_found' });
  });

  it('lists tasks newest first with the job title and removes any task', () => {
    const { service, tasks } = setup();
    const first = service.requestMatch('j1');
    tasks.update(first.id, { status: 'in_progress' });
    expect(service.list()).toMatchObject([{ id: first.id, job_title: expect.any(String), company_name: 'Example s.r.o.' }]);
    service.remove(first.id);
    expect(service.list()).toEqual([]);
    expect(errorOf(() => service.remove(first.id))).toMatchObject({ code: 'task_not_found' });
  });

  it('queues the writing of a document in the language of the application, with the template and the user instructions', () => {
    const { service } = setup();
    const letter = service.requestDocument('d1', 'Mention my open-source work');
    expect(letter).toMatchObject({ type: 'cover_letter', target_type: 'document', target_id: 'd1', application_id: 'a1', job_id: 'j1', status: 'pending' });
    expect(letter.instructions).toContain('Czech');
    expect(letter.instructions).toContain('at most 250 words');
    expect(letter.instructions).toContain('Mention my open-source work');
    expect(service.requestDocument('d2')).toMatchObject({ type: 'resume_tailor' });
    expect(service.documentTaskFor('d1')?.id).toBe(letter.id);
  });

  it('does not queue a document twice and needs the experience and an existing document', () => {
    const { service, tasks } = setup();
    const first = service.requestDocument('d1');
    expect(service.requestDocument('d1').id).toBe(first.id);
    tasks.update(first.id, { status: 'done' });
    expect(service.requestDocument('d1').id).not.toBe(first.id);
    expect(errorOf(() => service.requestDocument('zz'))).toMatchObject({ code: 'document_not_found' });
    expect(errorOf(() => setup('').service.requestDocument('d1'))).toMatchObject({ code: 'match_experience_required' });
  });

  it('queues the answer to a question with the limit, the language and the user instructions', () => {
    const { service } = setup();
    const task = service.requestQuestion('q1', 'Stress remote work');
    expect(task).toMatchObject({ type: 'answer_question', target_type: 'question', target_id: 'q1', application_id: 'a1', job_id: 'j1', status: 'pending' });
    expect(task.instructions).toContain('Czech');
    expect(task.instructions).toContain('500 sentences');
    expect(task.instructions).toContain('Stress remote work');
    expect(service.requestQuestion('q1').id).toBe(task.id);
    expect(service.questionTaskFor('q1')?.id).toBe(task.id);
    expect(errorOf(() => service.requestQuestion('zz'))).toMatchObject({ code: 'question_not_found' });
    expect(errorOf(() => setup(' ').service.requestQuestion('q1'))).toMatchObject({ code: 'match_experience_required' });
  });

  it('queues all the unanswered questions once', () => {
    const { service } = setup();
    service.requestQuestion('q1');
    const created = service.requestOpenQuestions('a1');
    expect(created.map((t) => t.target_id)).toEqual(['q2']);
    expect(service.requestOpenQuestions('a1')).toEqual([]);
  });

  it('cancels only a pending task', () => {
    const { service, tasks } = setup();
    const task = service.requestMatch('j1');
    service.cancel(task.id);
    expect(service.matchFor('j1')).toBeUndefined();
    const again = service.requestMatch('j1');
    tasks.update(again.id, { status: 'in_progress' });
    expect(errorOf(() => service.cancel(again.id))).toMatchObject({ code: 'task_not_cancellable' });
    expect(errorOf(() => service.cancel('zz'))).toMatchObject({ code: 'task_not_found' });
  });
});

describe('AiTaskService import', () => {
  it('refuses to match an awaiting job but still queues its import', () => {
    const { service, jobs } = setup();
    jobs.update('j1', { status: 'awaiting' });
    expect(errorOf(() => service.requestMatch('j1')).code).toBe('job_awaiting');
    expect(service.requestImport('j1').type).toBe('import_job');
  });

  it('queues an import task with the url and task id in the instructions, even without experience', () => {
    const { service } = setup('');
    const task = service.requestImport('j1');
    expect(task).toMatchObject({ type: 'import_job', target_type: 'job', target_id: 'j1', job_id: 'j1', application_id: '', status: 'pending' });
    expect(task.instructions).toContain('https://example.com/job/1');
    expect(task.instructions).toContain(task.id);
    expect(task.instructions).not.toContain('{{');
  });

  it('returns the active import task instead of a second one', () => {
    const { service, tasks } = setup();
    const first = service.requestImport('j1');
    expect(service.requestImport('j1').id).toBe(first.id);
    expect(tasks.list()).toHaveLength(1);
  });

  it('rejects an unknown job', () => {
    const { service } = setup();
    expect(errorOf(() => service.requestImport('nope')).code).toBe('job_not_found');
  });

  it('removing an import task deletes its awaiting job but not a job in another status', () => {
    const { service, jobs } = setup();
    jobs.update('j1', { status: 'awaiting' });
    const task = service.requestImport('j1');
    service.remove(task.id);
    expect(jobs.get('j1')).toBeUndefined();

    const other = setup();
    const t = other.service.requestImport('j1');
    other.service.remove(t.id);
    expect(other.jobs.get('j1')).toBeDefined();
  });
});
