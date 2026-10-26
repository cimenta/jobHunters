import { emptyParsedJob } from '@jobhunters/core';
import { describe, expect, it } from 'vitest';
import { emptyDraft, parseAmount, toDraft, toOverrides } from './job-draft';

describe('parseAmount', () => {
  it.each([
    ['60 000', 60000],
    ['60000', 60000],
    ['1,5', 1.5],
    ['', null],
    ['   ', null],
  ])('reads %j as %j', (text, expected) => {
    expect(parseAmount(text)).toBe(expected);
  });
  it.each(['abc', '-5', '1.2.3'])('rejects %j', (text) => {
    expect(parseAmount(text)).toBeUndefined();
  });
});

describe('toDraft / toOverrides', () => {
  it('turns a parsed job into form text and back into the values to save', () => {
    const parsed = { ...emptyParsedJob(), title: 'Dev', company: 'Acme', salary_min: 60000, salary_max: 80000, salary_currency: 'CZK', salary_period: 'month', is_gig: true, description: 'Text' };
    const draft = toDraft(parsed);
    expect(draft).toMatchObject({ title: 'Dev', salary_min: '60000', salary_max: '80000', is_gig: true });
    expect(toOverrides(draft)).toEqual({
      valid: true,
      overrides: {
        title: 'Dev', company: 'Acme', location: '', salary_min: 60000, salary_max: 80000, salary_currency: 'CZK', salary_period: 'month',
        contact_person: '', gig_shift: '', gig_priority: false, is_gig: true, is_remote: false, is_hybrid: false, is_contract: false, description: 'Text', notes: '',
      },
    });
  });
  it('sends the shift only while Gig is ticked', () => {
    expect(toOverrides({ ...emptyDraft(), contact_person: 'Jana', gig_shift: 'Sat', is_gig: true }).overrides).toMatchObject({ contact_person: 'Jana', gig_shift: 'Sat' });
    expect(toOverrides({ ...emptyDraft(), gig_shift: 'Sat', is_gig: false }).overrides).toMatchObject({ gig_shift: '' });
  });
  it('sends null for an empty salary and reports an invalid one', () => {
    expect(toOverrides({ ...emptyDraft(), salary_min: '', salary_max: '' }).overrides).toMatchObject({ salary_min: null, salary_max: null });
    expect(toOverrides({ ...emptyDraft(), salary_min: 'lots' }).valid).toBe(false);
  });
});
