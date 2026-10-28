import { emailMarkKey, resolveEmailMark, type EmailMarkKey } from '@jobhunters/core';
import type { IconName } from '../components/Icon.svelte';
import { uiState } from '../state/ui-state';
import { tr } from './i18n.svelte';

export type EmailTone = 'new' | 'suggested' | 'saved' | 'ignored';

export interface EmailMark {
  key: EmailMarkKey;
  tone: EmailTone;
  icon: IconName;
  /** The color the user chose in Settings; empty uses the color of the theme. */
  color: string;
  /** Tooltip and screen reader text. */
  label: string;
}

/** The name of a kind of mark in the current language. */
export function markName(key: EmailMarkKey): string {
  return tr(`ui.emailMark.${key}`);
}

/**
 * The mark in the upper left of a mail in the list. The icon and the color belong to the kind of mail (new, confirmation,
 * meeting, ...) and are chosen in Settings; the look of the ring says how far the mail is: suggested or saved.
 */
export function emailMark(row: { state: string; type: string; signals: string }): EmailMark {
  const key = emailMarkKey(row);
  const { icon, color } = resolveEmailMark(uiState().email_marks, key);
  const tone: EmailTone = key === 'ignored' && row.state !== 'ignored' ? 'suggested' : key === 'ignored' ? 'ignored' : row.state === 'confirmed' ? 'saved' : row.state === 'suggested' ? 'suggested' : 'new';
  const label =
    row.state === 'ignored'
      ? tr('ui.emails.state.ignored')
      : tone === 'new'
        ? tr('ui.emails.state.new')
        : key === 'ignored'
          ? tr('ui.emails.state.noise')
          : tr(tone === 'saved' ? 'ui.emails.state.saved' : 'ui.emails.state.suggested', { kind: markName(key) });
  return { key, tone, icon: icon as IconName, color, label };
}
