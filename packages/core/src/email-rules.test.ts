import { describe, expect, it } from 'vitest';
import { parseEmail } from './email-parser';
import {
  checkEmailPatterns,
  compileEmailRules,
  DEFAULT_EMAIL_RULES,
  EMAIL_RULE_CATEGORIES,
  effectiveEmailRules,
  isRelayAddress,
  parseEmailRules,
  serializeEmailRules,
} from './email-rules';
import { parseSettings, SETTINGS_DEFAULTS } from './settings';

const mail = (subject: string, body: string) => ({ subject, body, direction: 'incoming', from_email: 'hr@example.invalid', from_name: 'HR', is_bulk: false });

describe('email rules', () => {
  it('has defaults for every category and each default pattern compiles', () => {
    for (const category of EMAIL_RULE_CATEGORIES) expect(DEFAULT_EMAIL_RULES[category].length, category).toBeGreaterThan(0);
    for (const category of EMAIL_RULE_CATEGORIES) {
      if (category !== 'relay_domains') expect(checkEmailPatterns(DEFAULT_EMAIL_RULES[category]), category).toBeUndefined();
    }
  });

  it('keeps the default of a category the user did not change and the lines of one the user changed', () => {
    const rules = effectiveEmailRules({ rejection: ['nechceme vas'] });
    expect(rules.rejection).toEqual(['nechceme vas']);
    expect(rules.confirmation).toEqual(DEFAULT_EMAIL_RULES.confirmation);
  });

  it('treats an empty category as a real choice: no patterns', () => {
    const parsed = parseEmailRules('{"homework":[]}');
    expect(parsed).toEqual({ homework: [] });
    expect(effectiveEmailRules(parsed).homework).toEqual([]);
    const result = parseEmail(mail('Next step', 'Please complete the take-home assignment.'), compileEmailRules(effectiveEmailRules(parsed)));
    expect(result.type).not.toBe('homework');
  });

  it('parses the stored value: unknown categories are dropped, lines are cleaned, wrong shapes are invalid', () => {
    expect(parseEmailRules('')).toEqual({});
    expect(parseEmailRules('{"rejection":["  a  ","","a","b"],"nope":["x"]}')).toEqual({ rejection: ['a', 'b'] });
    expect(parseEmailRules('[]')).toBeUndefined();
    expect(parseEmailRules('not json')).toBeUndefined();
    expect(parseEmailRules('{"rejection":"a"}')).toBeUndefined();
    expect(parseEmailRules('{"rejection":[1]}')).toBeUndefined();
    expect(parseEmailRules(`{"rejection":${JSON.stringify(Array.from({ length: 101 }, (_, i) => `x${i}`))}}`)).toBeUndefined();
  });

  it('names the line of a pattern that is not a valid regular expression', () => {
    expect(checkEmailPatterns(['fine', 'broken(', 'fine'])).toMatchObject({ line: 2 });
    expect(checkEmailPatterns(['x'.repeat(301)])).toMatchObject({ line: 1 });
    expect(checkEmailPatterns(['a|b', '^start'])).toBeUndefined();
    expect(parseEmailRules('{"rejection":["broken("]}')).toBeUndefined();
    expect(parseEmailRules('{"relay_domains":["broken("]}')).toEqual({ relay_domains: ['broken('] });
  });

  it('never throws when a stored pattern does not compile; the line is skipped', () => {
    const rules = { ...effectiveEmailRules(undefined), rejection: ['broken(', 'we are sorry'] };
    expect(() => parseEmail(mail('x', 'we are sorry about it'), compileEmailRules(rules))).not.toThrow();
    expect(parseEmail(mail('x', 'we are sorry about it'), compileEmailRules(rules)).type).toBe('rejection');
  });

  it('lets a changed rule change the result and the default rules are reused between calls', () => {
    const custom = compileEmailRules(effectiveEmailRules({ confirmation: ['zdravime vas'] }));
    expect(parseEmail(mail('Hi', 'zdravime vas z firmy'), custom).type).toBe('confirmation');
    expect(parseEmail(mail('Hi', 'zdravime vas z firmy')).type).not.toBe('confirmation');
    const rules = effectiveEmailRules(undefined);
    expect(compileEmailRules(rules)).toBe(compileEmailRules(rules));
  });

  it('recognizes relay addresses by domain and subdomain, case insensitively', () => {
    const relay = effectiveEmailRules(undefined).relay_domains;
    // built from the list, so no address of a real service is written here
    expect(isRelayAddress(`bot@${relay[1]}`, relay)).toBe(true);
    expect(isRelayAddress(`x@mail.${relay[0]!.toUpperCase()}`, relay)).toBe(true);
    expect(isRelayAddress('hr@acme-company.example', relay)).toBe(false);
    expect(isRelayAddress('nothing', relay)).toBe(false);
  });

  it('is stored in the settings: defaults, a stored value and a broken value that falls back with a warning', () => {
    expect(parseSettings({}).settings.email_rules).toEqual({});
    expect(parseSettings({}).settings.email_auto_save).toBe(false);
    expect(SETTINGS_DEFAULTS.email_rules).toBe('{}');
    const stored = parseSettings({ email_rules: serializeEmailRules({ offer: ['x'] }), email_auto_save: 'TRUE' });
    expect(stored.settings.email_rules).toEqual({ offer: ['x'] });
    expect(stored.settings.email_auto_save).toBe(true);
    const broken = parseSettings({ email_rules: '{"offer":["x("]}' });
    expect(broken.settings.email_rules).toEqual({});
    expect(broken.warnings.some((warning) => warning.code === 'setting_invalid')).toBe(true);
  });
});
