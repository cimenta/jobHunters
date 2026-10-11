import { resolveStatusStyle, type ResolvedStatusStyle } from '@jobhunters/core';
import { app } from '../state/app.svelte';
import { ui } from './i18n.svelte';

/** Text and colours of a status with the user's customisation applied; reactive to settings and language. */
export function statusStyle(status: string): ResolvedStatusStyle {
  return resolveStatusStyle(app.settings?.status_styles ?? {}, status, ui.locale);
}
