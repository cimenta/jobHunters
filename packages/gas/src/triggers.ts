/** The one time trigger of the app: it fires every hour and the scheduler decides what runs. */
export const TICK_HANDLER = 'onHourlyTick';

/** Idempotent. Returns true when it created the trigger. */
export function ensureHourlyTrigger(): boolean {
  const exists = ScriptApp.getProjectTriggers().some((trigger) => trigger.getHandlerFunction() === TICK_HANDLER);
  if (exists) return false;
  ScriptApp.newTrigger(TICK_HANDLER).timeBased().everyHours(1).create();
  return true;
}
