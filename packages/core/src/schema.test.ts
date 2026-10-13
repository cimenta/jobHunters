import { describe, expect, it } from 'vitest';
import { ALLOWED_VALUES, columnType, isNullableNumber, SHEETS } from './schema';

const KEYLESS = ['StatusHistory', 'Profile', 'Settings', 'INSTRUCTIONS', 'Log'];

describe('sheet schema', () => {
  it('defines every sheet of the spec, in order', () => {
    expect(Object.keys(SHEETS)).toEqual([
      'Companies', 'Jobs', 'Applications', 'Documents', 'Questions', 'Communications', 'Reminders',
      'Contacts', 'StatusHistory', 'Tasks', 'Templates', 'Profile', 'Settings', 'INSTRUCTIONS', 'Log', 'History',
    ]);
  });

  it.each(Object.entries(SHEETS))('%s: columns are unique snake_case names', (_name, columns) => {
    expect(new Set(columns).size).toBe(columns.length);
    for (const column of columns) expect(column).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it.each(Object.entries(SHEETS).filter(([name]) => !KEYLESS.includes(name)))('%s: starts with an id column', (_name, columns) => {
    expect(columns[0]).toBe('id');
  });

  it('keeps the Job columns in the order given by the spec', () => {
    expect(SHEETS.Jobs).toEqual([
      'id', 'company_id', 'title', 'url', 'source', 'parser_id', 'parsed_at', 'contact_id', 'found_at',
      'is_gig', 'location', 'salary_min', 'salary_max', 'salary_currency', 'salary_period',
      'employment_type', 'remote', 'posted_at', 'valid_until', 'description', 'language', 'availability',
      'availability_reason', 'offline_strikes', 'last_checked_at', 'flags', 'folder_url', 'notes', 'status', 'match_percent', 'ai_salary',
    ]);
  });

  it('types the History columns', () => {
    expect(SHEETS.History).toEqual(['id', 'key', 'version', 'saved_at', 'source', 'restored_from', 'pinned', 'comment', 'text']);
    expect(columnType('version')).toBe('number');
    expect(columnType('pinned')).toBe('boolean');
    expect(columnType('text')).toBe('string');
    expect(ALLOWED_VALUES['History.source']).toEqual(['initial', 'saved', 'reset', 'restored']);
  });

  it('puts the document language on applications', () => {
    expect(SHEETS.Applications.slice(0, 6)).toEqual(['id', 'job_id', 'attempt', 'label', 'language', 'status']);
  });

  it('types numeric and boolean columns, everything else is text', () => {
    expect(columnType('salary_min')).toBe('number');
    expect(columnType('attempt')).toBe('number');
    expect(columnType('is_gig')).toBe('boolean');
    expect(columnType('description')).toBe('string');
    expect(isNullableNumber('salary_min')).toBe(true);
    expect(isNullableNumber('offline_strikes')).toBe(false);
  });

  it('only restricts columns that exist', () => {
    for (const key of Object.keys(ALLOWED_VALUES)) {
      const [sheet, column] = key.split('.') as [keyof typeof SHEETS, string];
      expect((SHEETS[sheet] as readonly string[]).includes(column), key).toBe(true);
    }
  });
});

describe('Tasks.type', () => {
  it('allows import_job', () => {
    expect(ALLOWED_VALUES['Tasks.type']).toContain('import_job');
  });
});
