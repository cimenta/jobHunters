import { describe, expect, it } from 'vitest';
import { PROMPT_PLACEHOLDERS } from './prompt';
import { DEFAULT_PROMPTS, PROMPTS_VERSION } from './seed';

const prompt = (type: string): string => DEFAULT_PROMPTS.find((entry) => entry.type === type)!.instruction;

describe('built-in prompts: the job match is written to the job itself', () => {
  it('writes the evaluation to the column match_note of the job in every task that evaluates, next to the note of the task', () => {
    for (const type of ['match_job', 'import_match_job']) {
      expect(prompt(type), type).toContain('column match_note = the evaluation from step');
      expect(prompt(type), type).toContain('match_note');
    }
  });

  it('lets the resume and the cover letter evaluate the match too, only while match_percent is empty, and never over an existing one', () => {
    for (const type of ['resume_tailor', 'cover_letter']) {
      const text = prompt(type);
      expect(text, type).toContain('8. Job match. Do this step ONLY when the column match_percent of the sheet Jobs, the row with id {{job_id}}, is EMPTY.');
      expect(text, type).toContain('an earlier evaluation is never overwritten');
      for (const word of ['match_percent', 'match_note', 'Strengths:', 'Gaps:', 'Verdict:', 'is_remote', 'is_hybrid', 'contact_person', '{{app_language}}']) expect(text, `${type} ${word}`).toContain(word);
      expect(text, type).toContain('On the Jobs row change only ai_salary and, when match_percent was empty, match_percent, match_note, is_remote, is_hybrid and contact_person.');
      expect(text, type).toContain('ONLY when match_percent was empty before step 8');
      expect(text, type).toContain('the one exception: it is written in {{app_language}}');
    }
  });

  it('numbers the steps of the document tasks one after another and points RESULT at the right ones', () => {
    for (const type of ['resume_tailor', 'cover_letter']) {
      const text = prompt(type);
      const steps = [...text.slice(text.indexOf('STEPS'), text.indexOf('RULES')).matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1]));
      expect(steps, type).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      expect(text, type).toContain('9. Salary suggestion');
      expect(text, type).toContain('the whole number from step 8c');
      expect(text, type).toContain('the evaluation from step 8d');
      const result = text.slice(text.indexOf('RESULT (exactly'), text.lastIndexOf('CHECK BEFORE YOU FINISH'));
      expect([...result.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1])), type).toEqual([1, 2, 3, 4]);
    }
  });

  it('leaves the other document prompt without the match, and the evaluation form is the same wherever it is written', () => {
    const other = prompt('other');
    expect(other).not.toContain('Job match');
    expect(other).not.toContain('match_note');
    expect([...other.slice(other.indexOf('STEPS'), other.indexOf('RULES')).matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1]))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const form = 'Verdict: suitable, partly suitable or not suitable, then one sentence with the main reason. The verdict agrees with the number: 70 or more is suitable, 40 to 69 partly suitable, below 40 not suitable.';
    for (const type of ['match_job', 'import_match_job', 'resume_tailor', 'cover_letter']) expect(prompt(type), type).toContain(form);
  });

  it('gives the document prompts the language of the app as a placeholder', () => {
    expect(PROMPT_PLACEHOLDERS.resume_tailor).toContain('app_language');
    expect(PROMPT_PLACEHOLDERS.cover_letter).toContain('app_language');
  });
});

describe('built-in prompts: work mode and contact person', () => {
  it('has a new prompts version, so that the red mark asks users to reset their prompts', () => {
    expect(PROMPTS_VERSION).toBe(4);
  });

  it('asks the AI of the match task to fill is_remote, is_hybrid and contact_person only from the ad and never to clear a value', () => {
    const text = prompt('match_job');
    for (const word of ['is_remote', 'is_hybrid', 'contact_person', 'never overwrite a value that is already there', 'never clear it', 'Never invent a person']) expect(text).toContain(word);
    expect(text).toContain('On the Jobs row change only match_percent, match_note, is_remote, is_hybrid and contact_person.');
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
