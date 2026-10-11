import { CATALOGS, hasOwn, type AppWarning } from '@jobhunters/core';
import { ApiError } from '../api/client';
import { tr } from './i18n.svelte';

/** Always a translated sentence: raw codes and technical messages never reach the screen. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'transport_failed') return tr('ui.error.transport');
    if (hasOwn(CATALOGS.en, `error.${error.code}`)) return tr(`error.${error.code}`, error.params);
  }
  return tr('ui.error.generic');
}

export function describeWarning(warning: AppWarning): string {
  return hasOwn(CATALOGS.en, `warning.${warning.code}`) ? tr(`warning.${warning.code}`, warning.params) : tr('ui.error.generic');
}
