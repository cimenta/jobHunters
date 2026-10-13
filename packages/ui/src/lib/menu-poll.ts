export interface MenuPollerOptions {
  /** Performs one refresh. A rejection is swallowed (the previous numbers stay). */
  fetch: () => Promise<void>;
  /** The latest known number of waiting AI tasks, read at scheduling time. */
  waiting: () => number;
  /** Delay in ms before the next scheduled refresh for that waiting count; 0 (or less) means no scheduled refresh. */
  intervalFor: (waiting: number) => number;
  now: () => number;
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  isHidden: () => boolean;
  /** Minimum gap between refreshes caused by `kick()`. Default 2000 ms. */
  throttleMs?: number;
}

export interface MenuPoller {
  start(): void;
  stop(): void;
  /** Restarts the timer with the current interval (used when the interval may have changed). */
  reschedule(): void;
  /** Refreshes now (focus / becoming visible); ignored when hidden, in flight or within the throttle gap. */
  kick(): void;
}

/** One timer chain, never two requests at once, no request while hidden. */
export function createMenuPoller(options: MenuPollerOptions): MenuPoller {
  const throttleMs = options.throttleMs ?? 2000;
  let handle: unknown;
  let running = false;
  let inFlight = false;
  let flightStarted = 0;
  let flightId = 0;
  let lastRun = Number.NEGATIVE_INFINITY;

  function schedule(): void {
    if (handle !== undefined) options.clearTimeout(handle);
    handle = undefined;
    if (!running) return;
    const ms = options.intervalFor(options.waiting());
    if (Number.isFinite(ms) && ms > 0) handle = options.setTimeout(tick, ms);
  }

  /** A request that never settles must not block polling for ever: after 3 intervals (at least 30 s) it is abandoned. */
  function busy(): boolean {
    if (!inFlight) return false;
    const ms = options.intervalFor(options.waiting());
    const limit = Math.max(30_000, 3 * (Number.isFinite(ms) && ms > 0 ? ms : 0));
    return options.now() - flightStarted < limit;
  }

  async function run(): Promise<void> {
    const mine = ++flightId;
    inFlight = true;
    flightStarted = lastRun = options.now();
    try {
      await options.fetch();
    } catch {
      // keep the previous numbers; try again at the next tick
    } finally {
      if (mine === flightId) inFlight = false;
    }
  }

  function tick(): void {
    handle = undefined;
    if (!running) return;
    if (!options.isHidden() && !busy()) void run();
    schedule();
  }

  return {
    start() {
      if (running) return;
      running = true;
      lastRun = options.now();
      schedule();
    },
    stop() {
      running = false;
      if (handle !== undefined) options.clearTimeout(handle);
      handle = undefined;
    },
    reschedule() {
      if (running) schedule();
    },
    kick() {
      if (!running || options.isHidden() || busy()) return;
      if (options.now() - lastRun < throttleMs) return;
      void run();
      schedule();
    },
  };
}

/** Seconds between refreshes: the busy interval while AI tasks wait, else the normal one; 0 means off. */
export function menuRefreshSeconds(
  settings: { menu_refresh_seconds: number; menu_refresh_busy_seconds: number } | undefined,
  busy: boolean,
): number {
  const normal = settings?.menu_refresh_seconds ?? 60;
  const busySeconds = settings?.menu_refresh_busy_seconds ?? 15;
  return busy ? busySeconds : normal;
}
