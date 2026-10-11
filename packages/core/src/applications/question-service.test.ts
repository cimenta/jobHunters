import { describe, expect, it } from 'vitest';
import { InMemoryRepository } from '../repository';
import { errorOf } from '../testing/errors';
import { makeApplication, sequentialIds } from '../testing/fixtures';
import type { Application, Question } from '../types';
import { QuestionService } from './question-service';

const NOW = '2026-10-11T08:00:00.000Z';

function setup() {
  const questions = new InMemoryRepository<Question>();
  const applications = new InMemoryRepository<Application>([makeApplication({ id: 'a1' })]);
  return { service: new QuestionService({ questions, applications, newId: sequentialIds('q'), now: () => NOW }), questions, applications };
}

describe('QuestionService', () => {
  it('adds open questions with increasing positions and touches the application', () => {
    const { service, applications } = setup();
    const first = service.add('a1', { question: ' Why us? ' });
    const second = service.add('a1', { question: 'Salary?', maxLength: 200 });
    expect(first).toMatchObject({ id: 'q1', position: 1, question: 'Why us?', answer: '', max_length: null, status: 'open', created_at: NOW, updated_at: NOW });
    expect(second).toMatchObject({ position: 2, max_length: 200 });
    expect(applications.get('a1')!.last_activity_at).toBe(NOW);
    expect(service.listFor('a1').map((q) => q.id)).toEqual(['q1', 'q2']);
  });

  it('answers within the limit, marks answered, and reopens when the answer is cleared', () => {
    const { service } = setup();
    service.add('a1', { question: 'Why?', maxLength: 10 });
    expect(service.answer('q1', 'Because.')).toMatchObject({ answer: 'Because.', status: 'answered' });
    expect(service.answer('q1', '   ')).toMatchObject({ answer: '', status: 'open' });
  });

  it('refuses an answer longer than max_length and keeps the old answer', () => {
    const { service, questions } = setup();
    service.add('a1', { question: 'Why?', maxLength: 5 });
    service.answer('q1', 'ok');
    expect(errorOf(() => service.answer('q1', 'too long answer'))).toMatchObject({ code: 'answer_too_long', params: { max: 5, length: 15 } });
    expect(questions.get('q1')!.answer).toBe('ok');
  });

  it('validates input', () => {
    const { service } = setup();
    expect(errorOf(() => service.add('a1', { question: '  ' }))).toMatchObject({ code: 'question_required' });
    for (const maxLength of [0, -1, 1.5, Number.NaN]) {
      expect(errorOf(() => service.add('a1', { question: 'x', maxLength })), String(maxLength)).toMatchObject({ code: 'max_length_invalid' });
    }
    expect(errorOf(() => service.add('ghost', { question: 'x' }))).toMatchObject({ code: 'application_not_found' });
    expect(errorOf(() => service.answer('ghost', 'x'))).toMatchObject({ code: 'question_not_found' });
  });

  it('updates the question text and limit, and removes questions', () => {
    const { service } = setup();
    service.add('a1', { question: 'Old' });
    expect(service.update('q1', { question: 'New', maxLength: 50 })).toMatchObject({ question: 'New', max_length: 50 });
    expect(service.update('q1', { maxLength: null })).toMatchObject({ max_length: null });
    expect(errorOf(() => service.update('q1', { question: '' }))).toMatchObject({ code: 'question_required' });
    service.remove('q1');
    expect(service.listFor('a1')).toEqual([]);
    expect(errorOf(() => service.remove('q1'))).toMatchObject({ code: 'question_not_found' });
  });

  it('keeps positions unique after a removal', () => {
    const { service } = setup();
    service.add('a1', { question: 'A' });
    service.add('a1', { question: 'B' });
    service.remove('q1');
    expect(service.add('a1', { question: 'C' }).position).toBe(3);
  });
});
