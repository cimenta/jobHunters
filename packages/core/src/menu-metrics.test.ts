import { describe, expect, it } from 'vitest';
import { makeApplication, makeJob } from './testing/fixtures';
import { computeMenuMetrics, DEFAULT_MENU_NUMBERS, MENU_METRICS, parseMenuNumbers, stringifyMenuNumbers } from './menu-metrics';
import { SETTINGS_DEFAULTS, parseSettings } from './settings';

describe('computeMenuMetrics', () => {
  const jobs = [
    makeJob({ id: 'j1', status: 'new' }),
    makeJob({ id: 'j2', status: 'new' }),
    makeJob({ id: 'j3', status: 'no' }),
    makeJob({ id: 'j4', status: 'no' }),
    makeJob({ id: 'j5', status: 'awaiting' }),
  ];
  const applications = [
    makeApplication({ id: 'a1', job_id: 'j1', status: 'draft' }),
    makeApplication({ id: 'a2', job_id: 'j3', status: 'waiting' }),
    makeApplication({ id: 'a3', job_id: 'j3', status: 'sent' }),
    makeApplication({ id: 'a4', job_id: 'j4', status: 'rejected' }),
    makeApplication({ id: 'a5', job_id: 'j4', status: 'ghosted' }),
    makeApplication({ id: 'a6', job_id: 'j4', status: 'weird' }),
  ];

  it('counts jobs with and without an application, never counting ads that wait for the AI', () => {
    const { jobs: counts } = computeMenuMetrics({ jobs, applications, tasks: [] });
    expect(counts).toEqual({ new: 2, new_no_application: 1, no_application: 1, all: 4 });
  });

  it('counts applications by status and the active ones (not closed, not of an unknown status)', () => {
    const { applications: counts } = computeMenuMetrics({ jobs, applications, tasks: [] });
    expect(counts).toEqual({ draft: 1, waiting: 1, sent: 1, active: 3 });
  });

  it('has a count for every number the settings offer', () => {
    const metrics = computeMenuMetrics({ jobs: [], applications: [], tasks: [] });
    for (const [item, ids] of Object.entries(MENU_METRICS)) {
      for (const id of ids) expect(metrics[item as keyof typeof metrics]).toHaveProperty(id);
    }
  });
});

describe('parseMenuNumbers', () => {
  it('reads the choice and keeps the default for an item that is missing', () => {
    expect(parseMenuNumbers('{"jobs":["new_no_application","new"],"tasks":[]}')).toEqual({
      jobs: ['new_no_application', 'new'], applications: ['draft'], tasks: [],
    });
  });

  it('drops unknown and repeated ids and keeps at most two numbers', () => {
    expect(parseMenuNumbers('{"jobs":["new","nope","new","all","no_application"]}')!.jobs).toEqual(['new', 'all']);
  });

  it('rejects text that is not JSON, not an object, or an item that is not a list of text', () => {
    expect(parseMenuNumbers('nope')).toBeUndefined();
    expect(parseMenuNumbers('[]')).toBeUndefined();
    expect(parseMenuNumbers('{"jobs":"new"}')).toBeUndefined();
    expect(parseMenuNumbers('{"jobs":[1]}')).toBeUndefined();
  });

  it('round-trips and is the default setting', () => {
    expect(parseMenuNumbers(stringifyMenuNumbers(DEFAULT_MENU_NUMBERS))).toEqual(DEFAULT_MENU_NUMBERS);
    expect(parseSettings({}).settings.menu_numbers).toEqual(DEFAULT_MENU_NUMBERS);
    expect(SETTINGS_DEFAULTS.menu_numbers).toBe(stringifyMenuNumbers(DEFAULT_MENU_NUMBERS));
  });

  it('warns and falls back to the default when the stored value is invalid', () => {
    const { settings, warnings } = parseSettings({ menu_numbers: 'garbage' });
    expect(settings.menu_numbers).toEqual(DEFAULT_MENU_NUMBERS);
    expect(warnings).toContainEqual({ code: 'setting_invalid', params: { key: 'menu_numbers', value: 'garbage' } });
  });
});
