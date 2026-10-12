import { describe, expect, it } from 'vitest';
import {
  jobStatusChecksAvailability, jobStatusOf, matchColor, parseJobStatusStyles, resolveJobStatus, serializeJobStatusStyles,
} from './job-status';

const custom = '{"s_abc123":{"text":{"en":"Maybe","cs":"Možná"},"color":"#AA00BB"}}';

describe('parseJobStatusStyles', () => {
  it('always holds the built-in statuses with their defaults', () => {
    for (const raw of ['', '{}']) {
      expect(parseJobStatusStyles(raw)).toEqual({ new: { color: '#2563eb', check: true }, no: { color: '#6b7280', check: false } });
    }
  });

  it('changes a built-in status and adds a custom one that checks availability by default', () => {
    const styles = parseJobStatusStyles(`{"no":{"check":true,"color":"#111111"},${custom.slice(1)}`)!;
    expect(styles.no).toEqual({ color: '#111111', check: true });
    expect(styles.s_abc123).toEqual({ text: { en: 'Maybe', cs: 'Možná' }, color: '#aa00bb', check: true });
    expect(parseJobStatusStyles(serializeJobStatusStyles(styles))).toEqual(styles);
  });

  it('rejects the whole value for anything invalid', () => {
    for (const raw of [
      'not json', '[]', '{"new":"x"}', '{"new":{"color":"blue"}}', '{"new":{"check":"yes"}}', '{"new":{"text":{"de":"x"}}}',
      '{"new":{"text":{"en":""}}}', '{"Bad Code":{"color":"#000000","text":{"en":"x"}}}',
      '{"s_1":{"color":"#000000"}}', '{"s_1":{"text":{"en":"x"}}}',
    ]) {
      expect(parseJobStatusStyles(raw), raw).toBeUndefined();
    }
  });
});

describe('job status helpers', () => {
  const styles = parseJobStatusStyles(custom)!;

  it('treats an empty or unknown status as new', () => {
    expect(jobStatusOf(styles, '')).toBe('new');
    expect(jobStatusOf(styles, 'gone')).toBe('new');
    expect(jobStatusOf(styles, 'no')).toBe('no');
    expect(jobStatusOf(styles, 's_abc123')).toBe('s_abc123');
  });

  it('knows which statuses check availability', () => {
    expect(jobStatusChecksAvailability(styles, '')).toBe(true);
    expect(jobStatusChecksAvailability(styles, 'no')).toBe(false);
    expect(jobStatusChecksAvailability(styles, 's_abc123')).toBe(true);
  });

  it('colours the match: red below 40, orange below 70, green from 70', () => {
    expect([0, 39, 40, 69, 70, 100].map(matchColor)).toEqual(['#b91c1c', '#b91c1c', '#b45309', '#b45309', '#15803d', '#15803d']);
  });

  it('shows the match for a new ad that was evaluated, the name of the status otherwise', () => {
    expect(resolveJobStatus(styles, 'new', 78, 'en')).toMatchObject({ text: 'Match 78 %', color: '#15803d' });
    expect(resolveJobStatus(styles, '', 30, 'cs')).toMatchObject({ text: 'Shoda 30 %', color: '#b91c1c' });
    expect(resolveJobStatus(styles, 'new', null, 'en')).toMatchObject({ text: 'New', color: '#2563eb' });
    expect(resolveJobStatus(styles, 'no', 90, 'cs')).toMatchObject({ text: 'Ne', color: '#6b7280' });
    expect(resolveJobStatus(styles, 's_abc123', 90, 'cs')).toMatchObject({ text: 'Možná', color: '#aa00bb' });
  });
});
