import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import { describeError, describeWarning } from './errors';
import { setLocale } from './i18n.svelte';

describe('describeError', () => {
  it('translates known codes with their params, in the current language', () => {
    setLocale('en');
    expect(describeError(new ApiError('row_not_found', { id: 'r1' }))).toBe('Row r1 was not found.');
    setLocale('cs');
    expect(describeError(new ApiError('row_not_found', { id: 'r1' }))).toBe('Řádek r1 nebyl nalezen.');
    setLocale('en');
  });

  it('never shows a raw code', () => {
    expect(describeError(new ApiError('brand_new_code', {}, 'internal text'))).toBe('Something went wrong. Please try again.');
    expect(describeError(new Error('TypeError: x is undefined'))).toBe('Something went wrong. Please try again.');
    expect(describeError('boom')).toBe('Something went wrong. Please try again.');
  });

  it('has its own message for an unreachable server and for a missing setup', () => {
    expect(describeError(new ApiError('transport_failed'))).toContain('did not answer');
    expect(describeError(new ApiError('setup_required'))).toContain('setup');
  });
});

describe('describeWarning', () => {
  it('translates warnings and falls back for unknown ones', () => {
    expect(describeWarning({ code: 'template_missing', params: { type: 'resume', language: 'cs' } })).toContain('resume');
    expect(describeWarning({ code: 'nope' as never, params: {} })).toBe('Something went wrong. Please try again.');
  });
});
