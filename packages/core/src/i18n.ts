import cs from './locales/cs.json';
import en from './locales/en.json';

export const SUPPORTED_LOCALES = ['en', 'cs'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export interface PluralForms {
  one?: string;
  few?: string;
  many?: string;
  other: string;
}
export type CatalogValue = string | PluralForms;
export type Catalog = Record<string, CatalogValue>;
export type TranslateParams = Record<string, string | number>;
export type PluralCategory = 'one' | 'few' | 'many' | 'other';

export const CATALOGS: Record<Locale, Catalog> = { en, cs };

/** Own implementation of the CLDR rules for en and cs: Intl.PluralRules is not guaranteed in Apps Script. */
export function pluralCategory(locale: Locale, count: number): PluralCategory {
  if (locale === 'cs') {
    if (!Number.isInteger(count)) return 'many';
    if (count === 1) return 'one';
    if (count >= 2 && count <= 4) return 'few';
    return 'other';
  }
  return count === 1 ? 'one' : 'other';
}

export type MissingKeyHandler = (key: string, locale: Locale) => void;
export type TranslateFn = (key: string, params?: TranslateParams, locale?: Locale) => string;

function format(template: string, params: TranslateParams): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

export function createTranslator(catalogs: Record<Locale, Catalog>, onMissing: MissingKeyHandler): TranslateFn {
  return (key, params = {}, locale = DEFAULT_LOCALE) => {
    const value = catalogs[locale][key] ?? catalogs[DEFAULT_LOCALE][key];
    if (value === undefined) {
      try {
        onMissing(key, locale);
      } catch {
        // Reporting a missing key must never break the caller.
      }
      return key;
    }
    if (typeof value === 'string') return format(value, params);
    const count = params.count;
    const form = typeof count === 'number' ? value[pluralCategory(locale, count)] : undefined;
    return format(form ?? value.other, params);
  };
}

let missingKeyHandler: MissingKeyHandler = () => {};

/** The backend wires this to the Log sheet. */
export function setMissingKeyHandler(handler: MissingKeyHandler): void {
  missingKeyHandler = handler;
}

export const t: TranslateFn = createTranslator(CATALOGS, (key, locale) => missingKeyHandler(key, locale));
