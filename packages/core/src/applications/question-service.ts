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

/** Number of sentences: runs of text ended by . ! ? or an ellipsis, or by the end of the text. */
export function countSentences(text: string): number {
  return text.split(/[.!?…]+(?:\s+|$)/).filter((part) => part.trim() !== '').length;
}

function checkMaxSentences(maxSentences: number | null | undefined): number | null | undefined {
  if (maxSentences === undefined || maxSentences === null) return maxSentences;
  if (!Number.isInteger(maxSentences) || maxSentences < 1) {
    throw new ValidationError('max_sentences_invalid', `Invalid max_sentences ${maxSentences}`, {});
  }
  return maxSentences;
}

function checkQuestion(text: string): string {
  const trimmed = text.trim();
  if (trimmed === '') throw new ValidationError('question_required', 'The question is empty', {});
  return trimmed;
}

export class QuestionService {
  constructor(private readonly deps: QuestionServiceDeps) {}

  add(applicationId: string, input: { question: string; maxSentences?: number | null }): Question {
    const { questions, applications, newId, now } = this.deps;
    if (!applications.get(applicationId)) {
      throw new NotFoundError('application_not_found', `Application ${applicationId} not found`, { id: applicationId });
    }
    const question = checkQuestion(input.question);
    const maxSentences = checkMaxSentences(input.maxSentences) ?? null;
    const timestamp = now();
    // max + 1, not count + 1: removing a question must not make a later position collide.
    const position = questions.list().filter((q) => q.application_id === applicationId).reduce((max, q) => Math.max(max, q.position), 0) + 1;
    const created = questions.insert({
      id: newId(), application_id: applicationId, position, question, answer: '', max_sentences: maxSentences,
      status: 'open', created_at: timestamp, updated_at: timestamp,
    });
    applications.update(applicationId, { last_activity_at: timestamp });
    return created;
  }

  answer(id: string, answer: string): Question {
    const question = this.require(id);
    if (question.max_sentences !== null && countSentences(answer) > question.max_sentences) {
      throw new ValidationError('answer_too_long', `The answer exceeds ${question.max_sentences} sentences`, {
        max: question.max_sentences,
        length: countSentences(answer),
      });
    }
    const text = answer.trim() === '' ? '' : answer;
    return this.deps.questions.update(id, { answer: text, status: text === '' ? 'open' : 'answered', updated_at: this.deps.now() });
  }

  update(id: string, patch: { question?: string; maxSentences?: number | null }): Question {
    this.require(id);
    const change: Partial<Omit<Question, 'id'>> = { updated_at: this.deps.now() };
    if (patch.question !== undefined) change.question = checkQuestion(patch.question);
    if (patch.maxSentences !== undefined) change.max_sentences = checkMaxSentences(patch.maxSentences) ?? null;
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
