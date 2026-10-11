import { createDevBackend } from '@jobhunters/gas/dev';
import { setTransport, type ApiResult } from '../api/client';

export const FIXED_NOW = '2026-10-11T08:00:00.000Z';

/** Seeded in-memory backend with a fixed clock; installs itself as the UI transport. */
export function useDevBackend(options: { seed?: boolean } = {}) {
  const backend = createDevBackend({ seed: options.seed ?? true, now: () => FIXED_NOW });
  setTransport(async (method, args) => backend.call(method, args) as ApiResult);
  return backend;
}
