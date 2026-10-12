import type { Application } from './types';

/**
 * Order of cards in a Kanban column: cards without a stored position come first (new or just moved here),
 * the most recently active first; then the cards with a position, by position.
 */
export function compareBoard(a: Pick<Application, 'board_position' | 'last_activity_at'>, b: Pick<Application, 'board_position' | 'last_activity_at'>): number {
  if (a.board_position === null && b.board_position === null) return a.last_activity_at < b.last_activity_at ? 1 : a.last_activity_at > b.last_activity_at ? -1 : 0;
  if (a.board_position === null) return -1;
  if (b.board_position === null) return 1;
  return a.board_position - b.board_position;
}

export function sortBoard<T extends Pick<Application, 'board_position' | 'last_activity_at'>>(items: readonly T[]): T[] {
  return [...items].sort(compareBoard);
}
