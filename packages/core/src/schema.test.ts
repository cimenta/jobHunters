import { describe, expect, it } from 'vitest';
import { SHEETS } from './schema';

describe('sheet schema', () => {
  it('defines the sheets planned for the foundation, in order', () => {
    expect(Object.keys(SHEETS)).toEqual(['Companies', 'Jobs', 'Applications', 'Reminders', 'StatusHistory']);
  });

  it.each(Object.entries(SHEETS))('%s: columns are unique snake_case names', (_name, columns) => {
    expect(new Set(columns).size).toBe(columns.length);
    for (const column of columns) {
      expect(column).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it.each(Object.entries(SHEETS).filter(([name]) => name !== 'StatusHistory'))(
    '%s: starts with an id column',
    (_name, columns) => {
      expect(columns[0]).toBe('id');
    },
  );

  it('keeps the Job columns in the order given by the spec', () => {
    expect(SHEETS.Jobs).toEqual([
      'id', 'company_id', 'title', 'url', 'source', 'parser_id', 'parsed_at', 'contact_id', 'found_at',
      'is_gig', 'location', 'salary_min', 'salary_max', 'salary_currency', 'salary_period',
      'employment_type', 'remote', 'posted_at', 'valid_until', 'description', 'availability',
      'availability_reason', 'offline_strikes', 'last_checked_at', 'flags', 'folder_url', 'notes',
    ]);
  });
});
