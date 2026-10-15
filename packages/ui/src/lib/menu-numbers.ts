import { tr } from './i18n.svelte';
import { formatCount } from './format';

export interface MenuBadge {
  /** What the badge shows: one number, or "first / second". */
  text: string;
  /** What the numbers mean, one line per number; shown on hover. */
  title: string;
  /** The same sentences on one line, for the accessible name of the menu link. */
  label: string;
}

/**
 * The badge of a menu item for the numbers the user chose. It is hidden (undefined) when nothing is chosen or every
 * chosen number is zero; one zero next to a non-zero number is still shown, so "0 / 12" says that the first is really 0.
 */
export function menuBadge(item: string, chosen: readonly string[], counts: Record<string, number> | undefined): MenuBadge | undefined {
  const parts = chosen.map((id) => ({ id, count: counts?.[id] ?? 0 }));
  if (parts.length === 0 || parts.every((part) => part.count === 0)) return undefined;
  const sentences = parts.map((part) => tr('ui.nav.metricTip', { label: tr(`ui.menuMetric.${item}.${part.id}`), count: part.count }));
  return { text: parts.map((part) => formatCount(part.count)).join(' / '), title: sentences.join('\n'), label: sentences.join(', ') };
}
