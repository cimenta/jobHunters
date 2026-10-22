import type { PromptType } from './seed';

/** Placeholders each AI prompt may use; the UI lists them next to the editor. */
export const PROMPT_PLACEHOLDERS: Readonly<Record<PromptType, readonly string[]>> = {
  resume_tailor: ['task_id', 'document_id', 'application_id', 'job_id', 'language', 'app_language', 'notes'],
  cover_letter: ['task_id', 'document_id', 'application_id', 'job_id', 'language', 'app_language', 'notes'],
  other: ['task_id', 'document_id', 'application_id', 'job_id', 'language', 'notes'],
  answer_question: ['task_id', 'question_id', 'application_id', 'job_id', 'language', 'limit', 'notes'],
  match_job: ['task_id', 'job_id', 'language'],
  import_job: ['task_id', 'job_id', 'url', 'language'],
  import_match_job: ['task_id', 'job_id', 'url', 'language', 'notes'],
};

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

/**
 * Replaces {{name}} with its value; an unknown name stays as typed. A line that only held placeholders
 * which came out empty (no limit, no notes) is dropped.
 */
export function renderPrompt(template: string, values: Readonly<Record<string, string>>): string {
  const lines: string[] = [];
  for (const line of template.split(/\r?\n/)) {
    const rendered = line.replace(PLACEHOLDER, (match, name: string) => (Object.prototype.hasOwnProperty.call(values, name) ? values[name]! : match));
    if (rendered.trim() === '' && line.trim() !== '') continue;
    lines.push(rendered);
  }
  return lines.join('\n').trim();
}
