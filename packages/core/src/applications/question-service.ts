import { NotFoundError, ValidationError } from '../errors';
import type { Repository } from '../repository';
import type { Application, Question } from '../types';

export interface QuestionServiceDeps {
  questions: Repository<Question>;
  applications: Repository<Application>;
  newId: () => string;
  /** ISO 8601 date-time. */
  now: () => string;
}

function checkMaxLength(maxLength: number | null | undefined): number | null | undefined {
  if (maxLength === undefined || maxLength === null) return maxLength;
  if (!Number.isInteger(maxLength) || maxLength < 1) {
    throw new ValidationError('max_length_invalid', `Invalid max_length ${maxLength}`, {});
  }
  return maxLength;
}

function checkQuestion(text: string): string {
  const trimmed = text.trim();
  if (trimmed === '') throw new ValidationError('question_required', 'The question is empty', {});
  return trimmed;
}

export class QuestionService {
  constructor(private readonly deps: QuestionServiceDeps) {}

  add(applicationId: string, input: { question: string; maxLength?: number | null }): Question {
    const { questions, applications, newId, now } = this.deps;
    if (!applications.get(applicationId)) {
      throw new NotFoundError('application_not_found', `Application ${applicationId} not found`, { id: applicationId });
    }
    const question = checkQuestion(input.question);
    const maxLength = checkMaxLength(input.maxLength) ?? null;
    const timestamp = now();
    // max + 1, not count + 1: removing a question must not make a later position collide.
    const position = questions.list().filter((q) => q.application_id === applicationId).reduce((max, q) => Math.max(max, q.position), 0) + 1;
    const created = questions.insert({
      id: newId(), application_id: applicationId, position, question, answer: '', max_length: maxLength,
      status: 'open', created_at: timestamp, updated_at: timestamp,
    });
    applications.update(applicationId, { last_activity_at: timestamp });
    return created;
  }

  answer(id: string, answer: string): Question {
    const question = this.require(id);
    if (question.max_length !== null && answer.length > question.max_length) {
      throw new ValidationError('answer_too_long', `The answer exceeds ${question.max_length} characters`, {
        max: question.max_length,
        length: answer.length,
      });
    }
    const text = answer.trim() === '' ? '' : answer;
    return this.deps.questions.update(id, { answer: text, status: text === '' ? 'open' : 'answered', updated_at: this.deps.now() });
  }

  update(id: string, patch: { question?: string; maxLength?: number | null }): Question {
    this.require(id);
    const change: Partial<Omit<Question, 'id'>> = { updated_at: this.deps.now() };
    if (patch.question !== undefined) change.question = checkQuestion(patch.question);
    if (patch.maxLength !== undefined) change.max_length = checkMaxLength(patch.maxLength) ?? null;
    return this.deps.questions.update(id, change);
  }

  remove(id: string): void {
    this.require(id);
    this.deps.questions.remove(id);
  }

  listFor(applicationId: string): Question[] {
    return this.deps.questions.list().filter((q) => q.application_id === applicationId).sort((a, b) => a.position - b.position);
  }

  private require(id: string): Question {
    const found = this.deps.questions.get(id);
    if (!found) throw new NotFoundError('question_not_found', `Question ${id} not found`, { id });
    return found;
  }
}
