import { describe, expect, it } from 'vitest';
import { PROMPT_PLACEHOLDERS, renderPrompt } from './prompt';
import { DEFAULT_PROMPTS, PROMPT_TYPES } from './seed';

describe('renderPrompt', () => {
  it('replaces known placeholders, keeps unknown ones and drops lines that came out empty', () => {
    expect(renderPrompt('A {{ x }} {{y}}\n{{empty}}\n\nB {{missing}}', { x: '1', y: '2', empty: '' })).toBe('A 1 2\n\nB {{missing}}');
  });
});

describe('default prompts', () => {
  it('includes import_job among the prompt types', () => {
    expect(PROMPT_TYPES).toContain('import_job');
  });

  it.each(DEFAULT_PROMPTS.map((p) => [p.type, p.instruction] as const))('%s uses only listed placeholders', (type, instruction) => {
    const used = [...instruction.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]!);
    // {{name}}, {{email}}, ... are placeholders of the document template, not of the prompt itself.
    const documentFields = ['name', 'email', 'phone', 'address', 'links', 'company', 'position', 'location', 'date', 'body', 'placeholders'];
    for (const name of used.filter((n) => !documentFields.includes(n))) expect(PROMPT_PLACEHOLDERS[type]).toContain(name);
  });

  const instruction = (type: string): string => DEFAULT_PROMPTS.find((p) => p.type === type)!.instruction;
  const section = (text: string, from: string, to?: string): string => {
    const start = text.indexOf(from);
    const end = to === undefined ? -1 : text.indexOf(to, start);
    return text.slice(start, end === -1 ? undefined : end);
  };

  it.each(['match_job', 'resume_tailor', 'cover_letter'])('%s asks for the ai_salary estimate in steps, RESULT and CHECK', (type) => {
    const text = instruction(type);
    expect(text).toContain('column ai_salary');
    expect(text).toContain('95000 (80000-125000)');
    expect(text).toContain('<ask> (<min>-<max>)');
    expect(text).toContain('{{job_id}}');
    expect(section(text, 'STEPS', 'RESULT')).toMatch(/If the cell is EMPTY/);
    expect(section(text, 'STEPS', 'RESULT')).toMatch(/do not change it/);
    expect(section(text, 'RESULT', 'CHECK BEFORE')).toMatch(/column ai_salary = the estimate, ONLY if it was empty/);
    expect(section(text, 'CHECK BEFORE', 'IF YOU CANNOT')).toMatch(/ai_salary is empty only if you could not estimate/);
    expect(section(text, 'CHECK BEFORE', 'IF YOU CANNOT')).toMatch(/non-empty cell was left untouched/);
    expect(text).toMatch(/never overwrite/i);
  });

  it.each(['match_job', 'resume_tailor', 'cover_letter'])('%s writes ai_salary before status = done', (type) => {
    const result = section(instruction(type), 'RESULT', 'CHECK BEFORE');
    const salary = result.indexOf('column ai_salary');
    const done = result.indexOf('status = done');
    expect(salary).toBeGreaterThan(-1);
    expect(done).toBeGreaterThan(salary);
    expect(result.slice(done)).not.toMatch(/ai_salary/);
  });

  it.each(['other', 'answer_question', 'import_job'])('%s does not mention ai_salary', (type) => {
    expect(instruction(type)).not.toContain('ai_salary');
  });
});
