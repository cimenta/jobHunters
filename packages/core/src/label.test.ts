import { describe, expect, it } from 'vitest';
import { ValidationError } from './errors';
import { buildLabel } from './label';

const base = { company: 'IBM', title: 'Senior Developer', attempt: 2, date: '2026-10-12' };

describe('buildLabel', () => {
  it('builds "Firma – Pozice – #pořadí (měsíc)"', () => {
    expect(buildLabel(base)).toBe('IBM – Senior Developer – #2 (2026-10)');
  });

  it('accepts a month-only date and a full timestamp', () => {
    expect(buildLabel({ ...base, date: '2026-10' })).toBe('IBM – Senior Developer – #2 (2026-10)');
    expect(buildLabel({ ...base, date: '2026-10-12T08:00:00.000Z' })).toBe('IBM – Senior Developer – #2 (2026-10)');
  });

  it('trims surrounding whitespace', () => {
    expect(buildLabel({ ...base, company: '  IBM ', title: ' Senior Developer  ' })).toBe(
      'IBM – Senior Developer – #2 (2026-10)',
    );
  });

  it.each([
    ['blank company', { company: '   ' }],
    ['blank title', { title: '' }],
    ['attempt 0', { attempt: 0 }],
    ['fractional attempt', { attempt: 1.5 }],
    ['NaN attempt', { attempt: Number.NaN }],
    ['slash date', { date: '10/2026' }],
    ['empty date', { date: '' }],
    ['month 13', { date: '2026-13-01' }],
    ['month 00', { date: '2026-00-10' }],
  ])('rejects %s', (_name, override) => {
    expect(() => buildLabel({ ...base, ...override })).toThrow(ValidationError);
  });
});
