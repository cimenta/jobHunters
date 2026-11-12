/** A card of a Kanban board that was dropped and is being saved: shown in its new place until the board is reloaded. */
export interface Move {
  from: string;
  to: string;
  /** Place among the other cards of the target column. */
  index: number;
  /** The save has finished; the card stays where it was dropped until the board reloads. */
  done: boolean;
}

const FALLBACK_MS = 20000;

/** The moves in progress of one board, by card id. Reactive. */
export function createMoves() {
  const moves = $state<Record<string, Move>>({});
  return {
    all: moves,
    start(id: string, move: Omit<Move, 'done'>): void {
      moves[id] = { ...move, done: false };
    },
    /** Saved: keep the card in its new place until the reloaded rows arrive (see settle), or for a while at most. */
    finish(id: string): void {
      const move = moves[id];
      if (move === undefined) return;
      move.done = true;
      setTimeout(() => {
        if (moves[id]?.done === true) delete moves[id];
      }, FALLBACK_MS);
    },
    /** Not saved: the card goes back to where it was. */
    fail(id: string): void {
      delete moves[id];
    },
    /** The rows were reloaded: the saved moves are now in the rows. */
    settle(): void {
      for (const id of Object.keys(moves)) if (moves[id]!.done) delete moves[id];
    },
  };
}
