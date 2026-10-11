import { t, type Locale } from '@jobhunters/core';

export const ui = $state<{ locale: Locale }>({ locale: 'en' });

export function setLocale(locale: Locale): void {
  ui.locale = locale;
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}

/** Translates with the current language; reading `ui.locale` makes templates update when the language changes. */
export function tr(key: string, params: Record<string, string | number> = {}): string {
  return t(key, params, ui.locale);
}
