import { createDevBackend } from '@jobhunters/gas/dev';
import type { ApiResult, Transport } from './client';

const LATENCY_MS = 150;

/** Development only: the real handlers over in-memory data, with a little delay so loading states are visible. */
const backend = createDevBackend({ seed: true });

export const fakeTransport: Transport = async (method, args) => {
  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
  return backend.call(method, args) as ApiResult;
};
