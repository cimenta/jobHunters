import { createLock } from '@jobhunters/core';

/** One script-wide lock, re-entrant within a single execution. */
export const gasLock = createLock(() => {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  return () => lock.releaseLock();
});
