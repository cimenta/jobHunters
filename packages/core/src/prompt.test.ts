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
});
