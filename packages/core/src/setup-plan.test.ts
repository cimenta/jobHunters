import { describe, expect, it } from 'vitest';
import { SHEETS } from './schema';
import { SETTING_KEYS } from './settings';
import { actualColumns, buildSetupPlan, columnSpans } from './setup-plan';

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
    expect(sheet('Jobs').checkboxColumns).toEqual(['is_gig', 'is_remote', 'is_hybrid', 'gig_priority', 'is_contract'].map((name) => sheet('Jobs').headers.indexOf(name) + 1));
    expect(sheet('Companies').checkboxColumns).toEqual([]);
  });

  it('adds dropdowns for restricted columns, without the empty value', () => {
    const applications = sheet('Applications');
    const status = applications.dropdowns.find((d) => d.column === applications.headers.indexOf('status') + 1);
    expect(status?.values).toHaveLength(9);
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

describe('columns found by name', () => {
  const jobs = sheet('Jobs');
  // The Jobs sheet of an installation older than the checkboxes Remote and Hybrid: they were added at the END.
  const olderHeader = jobs.headers.filter((name) => name !== 'is_remote' && name !== 'is_hybrid').concat(['is_remote', 'is_hybrid']);

  it('finds a plan column where the sheet really has it, not at its number in the plan', () => {
    const plan = (name: string) => jobs.headers.indexOf(name) + 1;
    expect(actualColumns(jobs, olderHeader, [plan('is_remote'), plan('is_hybrid')])).toEqual([olderHeader.length - 1, olderHeader.length]);
    expect(actualColumns(jobs, olderHeader, [plan('posted_at')])).toEqual([olderHeader.indexOf('posted_at') + 1]);
    // The plan number of is_remote is where an older sheet keeps posted_at: a checkbox must never land there.
    expect(actualColumns(jobs, olderHeader, jobs.checkboxColumns)).not.toContain(olderHeader.indexOf('posted_at') + 1);
    expect(actualColumns(jobs, olderHeader, jobs.checkboxColumns)).not.toContain(olderHeader.indexOf('valid_until') + 1);
  });

  it('is the identity for a sheet that has the columns of the plan in the plan order', () => {
    expect(actualColumns(jobs, jobs.headers, jobs.checkboxColumns)).toEqual(jobs.checkboxColumns);
    expect(actualColumns(jobs, jobs.headers, jobs.textColumns)).toEqual(jobs.textColumns);
  });

  it('leaves out a plan column the sheet lacks', () => {
    const number = (name: string) => jobs.headers.indexOf(name) + 1;
    expect(actualColumns(jobs, ['id', 'title'], [number('id'), number('title'), number('no_reason')])).toEqual([1, 2]);
  });

  it('groups neighbouring columns into runs of [first, count]', () => {
    expect(columnSpans([5, 1, 2, 3, 9, 10, 3])).toEqual([[1, 3], [5, 1], [9, 2]]);
    expect(columnSpans([])).toEqual([]);
  });
});
