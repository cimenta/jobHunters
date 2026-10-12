import { describe, expect, it } from 'vitest';
import { describeSheetChange, reportSetup } from './setup-report';

describe('reportSetup', () => {
  it('logs every step and ends with OK', () => {
    const lines: string[] = [];
    const result = reportSetup((line) => lines.push(line), (say) => {
      say('Root folder "JobHunters": created');
      say('Sheet Jobs: unchanged');
    });
    expect(result).toBe('OK');
    expect(lines).toEqual(['Setup started', 'Root folder "JobHunters": created', 'Sheet Jobs: unchanged', 'Setup finished: OK']);
  });

  it('keeps the steps done before a failure and ends with NOT OK and the reason', () => {
    const lines: string[] = [];
    const result = reportSetup((line) => lines.push(line), (say) => {
      say('Root folder "JobHunters": found');
      throw new Error('Drive is unavailable');
    });
    expect(result).toBe('NOT OK: Drive is unavailable');
    expect(lines).toEqual(['Setup started', 'Root folder "JobHunters": found', 'Setup failed: Drive is unavailable', 'Setup finished: NOT OK']);
  });

  it('reports a thrown non-error too', () => {
    const lines: string[] = [];
    expect(reportSetup((line) => lines.push(line), () => { throw 'boom'; })).toBe('NOT OK: boom');
  });

  it('survives a failing log writer', () => {
    expect(reportSetup(() => { throw new Error('log failed'); }, () => undefined)).toBe('OK');
  });
});

describe('describeSheetChange', () => {
  it('describes a new sheet', () => {
    expect(describeSheetChange('Jobs', { created: true, columns: 12, seedRows: 0, addedColumns: [] })).toBe('Sheet Jobs: created with 12 columns');
    expect(describeSheetChange('Settings', { created: true, columns: 2, seedRows: 21, addedColumns: [] })).toBe('Sheet Settings: created with 2 columns and 21 default rows');
  });

  it('describes columns added to an existing sheet and an unchanged one', () => {
    expect(describeSheetChange('Jobs', { created: false, columns: 12, seedRows: 0, addedColumns: ['status', 'match_percent'] })).toBe('Sheet Jobs: existing, added columns status, match_percent');
    expect(describeSheetChange('Jobs', { created: false, columns: 12, seedRows: 0, addedColumns: [] })).toBe('Sheet Jobs: existing, nothing to add');
  });
});
