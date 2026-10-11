import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from './errors';
import { WARNING_CODES } from './row-codec';
import { CATALOGS, createTranslator, isLocale, pluralCategory, SUPPORTED_LOCALES, t, type Catalog, type CatalogValue } from './i18n';
import { APPLICATION_STATUSES } from './status';

describe('t', () => {
  it('returns English by default and the requested locale when given', () => {
    expect(t('status.draft')).toBe('Draft');
    expect(t('status.draft', {}, 'cs')).toBe('Koncept');
  });

  it('interpolates named params and leaves unknown ones visible', () => {
    const tr = createTranslator({ en: { a: 'Hi {name}, {other}' }, cs: {} }, () => {});
    expect(tr('a', { name: 'Eva' })).toBe('Hi Eva, {other}');
  });

  it('falls back to English when the key is missing in the locale', () => {
    const missing: string[] = [];
    const tr = createTranslator({ en: { a: 'A' }, cs: {} }, (key) => missing.push(key));
    expect(tr('a', {}, 'cs')).toBe('A');
    expect(missing).toEqual([]);
  });

  it('returns the key and reports it when missing everywhere, and never throws', () => {
    const missing: string[] = [];
    const tr = createTranslator({ en: {}, cs: {} }, (key, locale) => missing.push(`${locale}:${key}`));
    expect(tr('nope', {}, 'cs')).toBe('nope');
    expect(missing).toEqual(['cs:nope']);
    const throwing = createTranslator({ en: {}, cs: {} }, () => {
      throw new Error('log failed');
    });
    expect(throwing('nope')).toBe('nope');
  });

  it('picks Czech plural forms (1 / 2-4 / 5+)', () => {
    const cases: [number, string][] = [
      [1, '1 přihláška'],
      [2, '2 přihlášky'],
      [4, '4 přihlášky'],
      [5, '5 přihlášek'],
      [0, '0 přihlášek'],
      [11, '11 přihlášek'],
      [100, '100 přihlášek'],
    ];
    for (const [count, text] of cases) expect(t('summary.applications', { count }, 'cs')).toBe(text);
  });

  it('picks English plural forms', () => {
    expect(t('summary.applications', { count: 1 })).toBe('1 application');
    expect(t('summary.applications', { count: 2 })).toBe('2 applications');
  });
});

describe('pluralCategory', () => {
  it('agrees with Intl.PluralRules for integers', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const rules = new Intl.PluralRules(locale);
      for (let n = 0; n <= 120; n++) expect(pluralCategory(locale, n)).toBe(rules.select(n));
    }
  });

  it('treats Czech decimals as "many"', () => {
    expect(pluralCategory('cs', 1.5)).toBe('many');
  });
});

describe('isLocale', () => {
  it('accepts supported locales only', () => {
    expect(isLocale('cs')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

const placeholders = (value: CatalogValue): string[] => {
  const texts = typeof value === 'string' ? [value] : Object.values(value);
  return [...new Set(texts.flatMap((text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!)))].sort();
};

describe('catalog completeness', () => {
  const en: Catalog = CATALOGS.en;
  const cs: Catalog = CATALOGS.cs;

  it('has the same keys in every language', () => {
    expect(Object.keys(cs).sort()).toEqual(Object.keys(en).sort());
  });

  it('uses the same kind (text or plural) and the same {params} for every key', () => {
    for (const key of Object.keys(en)) {
      expect(typeof cs[key], key).toBe(typeof en[key]);
      expect(placeholders(cs[key]!), key).toEqual(placeholders(en[key]!));
    }
  });

  it('has the plural forms each language needs', () => {
    for (const [locale, catalog, required] of [
      ['en', en, ['one', 'other']],
      ['cs', cs, ['one', 'few', 'other']],
    ] as const) {
      for (const [key, value] of Object.entries(catalog)) {
        if (typeof value === 'string') continue;
        for (const form of required) expect(Object.keys(value), `${locale}:${key}`).toContain(form);
      }
    }
  });

  it('has an error.<code> text for every error code and nothing extra', () => {
    const keys = Object.keys(en).filter((k) => k.startsWith('error.')).sort();
    expect(keys).toEqual(ERROR_CODES.map((c) => `error.${c}`).sort());
  });

  it('has a warning.<code> text for every warning code and nothing extra', () => {
    const keys = Object.keys(en).filter((k) => k.startsWith('warning.')).sort();
    expect(keys).toEqual(WARNING_CODES.map((c) => `warning.${c}`).sort());
  });

  it('has a status.<status> text for every application status', () => {
    const keys = Object.keys(en).filter((k) => k.startsWith('status.')).sort();
    expect(keys).toEqual(APPLICATION_STATUSES.map((s) => `status.${s}`).sort());
  });
});
