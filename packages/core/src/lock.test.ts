import { describe, expect, it } from 'vitest';
import { createLock } from './lock';

function counting() {
  const events: string[] = [];
  const lock = createLock(() => {
    events.push('acquire');
    return () => events.push('release');
  });
  return { events, lock };
}

describe('createLock', () => {
  it('acquires once for nested runs and releases at the end', () => {
    const { events, lock } = counting();
    const result = lock.run(() => lock.run(() => 42));
    expect(result).toBe(42);
    expect(events).toEqual(['acquire', 'release']);
  });

  it('releases when the function throws, and can be used again', () => {
    const { events, lock } = counting();
    expect(() => lock.run(() => { throw new Error('boom'); })).toThrow('boom');
    lock.run(() => undefined);
    expect(events).toEqual(['acquire', 'release', 'acquire', 'release']);
  });

  it('releases the outer lock even if an inner run throws and is caught', () => {
    const { events, lock } = counting();
    lock.run(() => {
      try {
        lock.run(() => { throw new Error('inner'); });
      } catch {
        // swallowed
      }
    });
    expect(events).toEqual(['acquire', 'release']);
  });
});
