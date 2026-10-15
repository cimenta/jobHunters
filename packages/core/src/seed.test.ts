import { describe, expect, it } from 'vitest';
import { PROMPT_PLACEHOLDERS } from './prompt';
import { DEFAULT_PROMPTS, PROMPTS_VERSION } from './seed';

const prompt = (type: string): string => DEFAULT_PROMPTS.find((entry) => entry.type === type)!.instruction;

describe('built-in prompts: work mode and contact person', () => {
  it('has a new prompts version, so that the red mark asks users to reset their prompts', () => {
    expect(PROMPTS_VERSION).toBe(3);
  });

  it('asks the AI of the match task to fill is_remote, is_hybrid and contact_person only from the ad and never to clear a value', () => {
    const text = prompt('match_job');
    for (const word of ['is_remote', 'is_hybrid', 'contact_person', 'never overwrite a value that is already there', 'never clear it', 'Never invent a person']) expect(text).toContain(word);
    expect(text).toContain('On the Jobs row change only match_percent, is_remote, is_hybrid and contact_person.');
    expect(text).not.toMatch(/remote:/);
  });

  it('numbers the steps of the match task one after another and points RESULT at the right ones', () => {
    const text = prompt('match_job');
    const steps = [...text.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1]));
    expect(steps.slice(0, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(text).toContain('the whole number from step 6');
    expect(text).toContain('the evaluation from step 7');
  });

  it('asks both import tasks for contact_person, and only the import-and-match task has the place for the instructions of the user', () => {
    expect(prompt('import_job')).toContain('contact_person');
    expect(prompt('import_match_job')).toContain('contact_person');
    expect(prompt('import_match_job')).toContain('{{notes}}');
    expect(prompt('import_job')).not.toContain('{{notes}}');
    expect(PROMPT_PLACEHOLDERS.import_match_job).toContain('notes');
  });
});
