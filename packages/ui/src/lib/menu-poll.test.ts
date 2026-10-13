import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMenuPoller, menuRefreshSeconds } from './menu-poll';

describe('createMenuPoller', () => {
  let waiting = 0;
  let intervals = { normal: 60_000, busy: 15_000 };
  let hidden = false;
  let fetch: ReturnType<typeof vi.fn>;

  const make = () =>
    createMenuPoller({
      fetch: fetch as unknown as () => Promise<void>,
      waiting: () => waiting,
      intervalFor: (w) => (w > 0 ? intervals.busy : intervals.normal),
      now: () => Date.now(),
      setTimeout: (cb, ms) => setTimeout(cb, ms),
      clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      isHidden: () => hidden,
    });

  beforeEach(() => {
    vi.useFakeTimers();
    waiting = 0;
    intervals = { normal: 60_000, busy: 15_000 };
    hidden = false;
    fetch = vi.fn().mockResolvedValue(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('ticks at the interval for the latest waiting count', async () => {
    const poller = make();
    poller.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    waiting = 3;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetch).toHaveBeenCalledTimes(3);
    poller.stop();
  });

  it('uses a changed interval after reschedule()', async () => {
    const poller = make();
    poller.start();
    intervals.normal = 10_000;
    poller.reschedule();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it('0 turns the timer off for that state but kick() still refreshes', async () => {
    intervals.normal = 0;
    const poller = make();
    poller.start();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(fetch).not.toHaveBeenCalled();
    poller.kick();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it('skips ticks and kicks while hidden', async () => {
    const poller = make();
    poller.start();
    hidden = true;
    await vi.advanceTimersByTimeAsync(180_000);
    poller.kick();
    expect(fetch).not.toHaveBeenCalled();
    hidden = false;
    poller.kick();
    expect(fetch).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it('never runs two requests at once and gives up on a request that never settles', async () => {
    fetch.mockImplementation(() => new Promise(() => {}));
    const poller = make();
    poller.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    poller.stop();
  });

  it('stop() ends all calls', async () => {
    const poller = make();
    poller.start();
    poller.stop();
    await vi.advanceTimersByTimeAsync(600_000);
    poller.kick();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('menuRefreshSeconds', () => {
  it('picks the busy or the normal interval and falls back to the defaults', () => {
    expect(menuRefreshSeconds(undefined, false)).toBe(60);
    expect(menuRefreshSeconds(undefined, true)).toBe(15);
    expect(menuRefreshSeconds({ menu_refresh_seconds: 0, menu_refresh_busy_seconds: 7 }, true)).toBe(7);
    expect(menuRefreshSeconds({ menu_refresh_seconds: 0, menu_refresh_busy_seconds: 7 }, false)).toBe(0);
  });
});
