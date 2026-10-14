import { waitingDays, type ApplicationRow } from '@jobhunters/core';
import { formatDate } from './format';
import { tr } from './i18n.svelte';

/** The match percent of an application's job, or undefined when it has none (the value can also arrive missing). */
export function matchOf(row: ApplicationRow): number | undefined {
  const value: unknown = row.match_percent;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** The value a card is sorted by when it is not already visible on the card; empty for the others. */
export function sortExtra(row: ApplicationRow, by: string, nowMs: number): string {
  switch (by) {
    case 'created':
      return row.created_at === '' ? '' : tr('ui.apps.createdOn', { date: formatDate(row.created_at) });
    case 'sent':
      return row.applied_at === '' ? tr('ui.apps.notSent') : tr('ui.apps.sentOn', { date: formatDate(row.applied_at) });
    case 'waiting': {
      const days = waitingDays(row.waiting_since, nowMs);
      if (days !== undefined) return tr('ui.apps.waitingFor', { count: String(days) });
      return row.status === 'waiting' ? '' : tr('ui.apps.notWaiting');
    }
    default:
      return '';
  }
}
