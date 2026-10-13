import { createDevBackend } from '@jobhunters/gas/dev';
import { setTransport, type ApiResult } from '../api/client';

export const FIXED_NOW = '2026-10-11T08:00:00.000Z';

/**
 * What the real Apps Script transport (google.script.run) does to an answer: the properties of objects that hold null
 * are dropped, so the browser sees them as undefined (an empty salary, an ad without a match). The in-memory backend
 * passes objects untouched, which hid this from the tests until 0.13.2; every test now goes through this on purpose.
 */
export function dropNullProperties<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => dropNullProperties(item)) as T;
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== null) out[key] = dropNullProperties(entry);
    }
    return out as T;
  }
  return value;
}

/**
 * Seeded in-memory backend with a fixed clock; installs itself as the UI transport. Answers pass through
 * `dropNullProperties` like in Apps Script; `keepNulls: true` switches that off for a test that needs the raw answer.
 */
export function useDevBackend(options: { seed?: boolean; keepNulls?: boolean; setupNeeded?: boolean; promptsOutdated?: boolean } = {}) {
  const backend = createDevBackend({ seed: options.seed ?? true, now: () => FIXED_NOW, setupNeeded: options.setupNeeded, promptsOutdated: options.promptsOutdated });
  setTransport(async (method, args) => {
    const result = backend.call(method, args) as ApiResult;
    return options.keepNulls ? result : dropNullProperties(result);
  });
  return backend;
}
