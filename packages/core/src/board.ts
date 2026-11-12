import type { Application, Job } from './types';

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

type JobCard = Pick<Job, 'board_position' | 'found_at'>;

/** Order of the ads in a column of the Kanban board of ads: the same rule, with the date the ad was found as its activity. */
export function compareJobBoard(a: JobCard, b: JobCard): number {
  return compareBoard({ board_position: a.board_position, last_activity_at: a.found_at }, { board_position: b.board_position, last_activity_at: b.found_at });
}

export function sortJobBoard<T extends JobCard>(items: readonly T[]): T[] {
  return [...items].sort(compareJobBoard);
}
