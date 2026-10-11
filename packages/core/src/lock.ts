export interface Lock {
  run<T>(fn: () => T): T;
}

export const NO_LOCK: Lock = { run: (fn) => fn() };

/**
 * Re-entrant lock: only the outermost run() acquires and releases, so a handler can hold the lock
 * while the repositories it calls take it again. `acquire` returns the release function.
 */
export function createLock(acquire: () => () => void): Lock {
  let depth = 0;
  let release: (() => void) | undefined;
  return {
    run<T>(fn: () => T): T {
      if (depth === 0) release = acquire();
      depth++;
      try {
        return fn();
      } finally {
        depth--;
        if (depth === 0) {
          const done = release;
          release = undefined;
          done?.();
        }
      }
    },
  };
}
