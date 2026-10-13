import { describe, expect, it } from 'vitest';
import { SHEETS } from './schema';
import { SETTING_KEYS } from './settings';
import { buildSetupPlan } from './setup-plan';

const plan = buildSetupPlan();
const sheet = (name: string) => plan.find((p) => p.name === name)!;

describe('buildSetupPlan', () => {
  it('has one entry per sheet with the schema headers', () => {
    expect(plan.map((p) => p.name)).toEqual(Object.keys(SHEETS));
    for (const p of plan) expect(p.headers).toEqual(SHEETS[p.name as keyof typeof SHEETS]);
  });

  it('formats every text column as plain text so ad text can never become a formula', () => {
    const jobs = sheet('Jobs');
    for (const column of ['description', 'notes', 'title', 'url', 'language']) {
      expect(jobs.textColumns).toContain(jobs.headers.indexOf(column) + 1);
    }
    expect(jobs.textColumns).not.toContain(jobs.headers.indexOf('salary_min') + 1);
    expect(jobs.textColumns).not.toContain(jobs.headers.indexOf('is_gig') + 1);
    expect(sheet('Questions').textColumns).toContain(sheet('Questions').headers.indexOf('answer') + 1);
    expect(sheet('INSTRUCTIONS').textColumns).toEqual([1]);
  });

  it('has the ai_salary column on Jobs, right after match_percent, as plain text', () => {
    const jobs = sheet('Jobs');
    expect(jobs.headers.indexOf('ai_salary')).toBe(jobs.headers.indexOf('match_percent') + 1);
    expect(jobs.textColumns).toContain(jobs.headers.indexOf('ai_salary') + 1);
  });

  it('seeds the Profile sheet with the profile keys and empty values', () => {
    expect(sheet('Profile').seedRows).toEqual([['name', ''], ['email', ''], ['phone', ''], ['address', ''], ['portfolio', ''], ['linkedin', ''], ['github', ''], ['website', ''], ['links', '']]);
  });

  it('seeds the Settings sheet with the current prompts version, while an existing installation without the row reads "never accepted"', async () => {
    const { PROMPTS_VERSION, SETTINGS_DEFAULTS } = await import('./index');
    const seeded = sheet('Settings').seedRows.find((row) => row[0] === 'ai_prompts_version');
    expect(seeded).toEqual(['ai_prompts_version', String(PROMPTS_VERSION)]);
    expect(SETTINGS_DEFAULTS.ai_prompts_version).toBe('');
  });

  it('uses checkboxes for booleans', () => {
    expect(sheet('Jobs').checkboxColumns).toEqual([sheet('Jobs').headers.indexOf('is_gig') + 1]);
    expect(sheet('Companies').checkboxColumns).toEqual([]);
  });

  it('adds dropdowns for restricted columns, without the empty value', () => {
    const applications = sheet('Applications');
    const status = applications.dropdowns.find((d) => d.column === applications.headers.indexOf('status') + 1);
    expect(status?.values).toHaveLength(8);
    const jobs = sheet('Jobs');
    const remote = jobs.dropdowns.find((d) => d.column === jobs.headers.indexOf('remote') + 1);
    expect(remote?.values).toEqual(['yes', 'no', 'hybrid']);
  });

  it('seeds Settings with every setting, INSTRUCTIONS in English', () => {
    expect(sheet('Settings').seedRows.map((r) => r[0])).toEqual([...SETTING_KEYS]);
    expect(sheet('INSTRUCTIONS').seedRows.length).toBeGreaterThan(5);
    for (const p of plan) for (const row of p.seedRows) expect(row).toHaveLength(p.headers.length);
  });

  it('creates the History sheet with plain-text columns, a checkbox for pinned and a dropdown for the source', () => {
    const history = sheet('History');
    expect(history.headers).toEqual(['id', 'key', 'version', 'saved_at', 'source', 'restored_from', 'pinned', 'comment', 'text']);
    expect(history.checkboxColumns).toEqual([7]);
    expect(history.textColumns).toEqual([1, 2, 4, 5, 6, 8, 9]);
    expect(history.dropdowns).toEqual([{ column: 5, values: ['initial', 'saved', 'reset', 'restored'] }]);
    expect(history.seedRows).toEqual([]);
  });

  it('seeds no data into entity sheets', () => {
    for (const name of ['Companies', 'Jobs', 'Applications', 'Reminders', 'Log']) expect(sheet(name).seedRows).toEqual([]);
  });
});
