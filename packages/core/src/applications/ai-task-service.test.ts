import { describe, expect, it } from 'vitest';
import { InMemoryRepository } from '../repository';
import { errorOf } from '../testing/errors';
import { makeApplication, makeJob, sequentialIds } from '../testing/fixtures';
import type { AiTask, Application, ApplicationDocument, Job } from '../types';
import { AiTaskService } from './ai-task-service';

function setup(experience = 'Ten years of TypeScript') {
  const tasks = new InMemoryRepository<AiTask>();
  const service = new AiTaskService({
    tasks,
    jobs: new InMemoryRepository<Job>([makeJob({ id: 'j1' })]),
    applications: new InMemoryRepository<Application>([makeApplication({ id: 'a1', job_id: 'j1', language: 'cs' })]),
    documents: new InMemoryRepository<ApplicationDocument>([
      { id: 'd1', application_id: 'a1', type: 'cover_letter', doc_url: 'https://docs.google.com/document/d/x/edit', pdf_url: '', template_id: '', created_at: '', pdf_exported_at: '' },
      { id: 'd2', application_id: 'a1', type: 'resume', doc_url: 'https://docs.google.com/document/d/y/edit', pdf_url: '', template_id: '', created_at: '', pdf_exported_at: '' },
    ]),
    newId: sequentialIds('t'),
    now: () => '2026-10-11T08:00:00.000Z',
    experience: () => experience,
    language: () => 'cs',
  });
  return { tasks, service };
}

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
    expect(service.list()).toMatchObject([{ id: first.id, job_title: expect.any(String) }]);
    service.remove(first.id);
    expect(service.list()).toEqual([]);
    expect(errorOf(() => service.remove(first.id))).toMatchObject({ code: 'task_not_found' });
  });

  it('queues the writing of a document in the language of the application, with the standing and the user instructions', () => {
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
