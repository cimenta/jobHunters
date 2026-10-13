import { createDevBackend } from '@jobhunters/gas/dev';
import type { ApiResult, Transport } from './client';

const LATENCY_MS = 150;

/** Development only: the real handlers over in-memory data, with a little delay so loading states are visible. */
// Open the dev page with ?demo for fictional showcase data and no "action needed" marks (used for the README screenshots).
const demoParam = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('demo') : null;
const demo = demoParam !== null;
const backend = demo ? createDevBackend({ seed: false, showcase: true }) : createDevBackend({ seed: true, setupNeeded: true, promptsOutdated: true });

// ?demo=kanban opens the applications as a Kanban board.
if (demoParam === 'kanban') backend.call('updateSettings', { ui_state: JSON.stringify({ applications_kanban: true, applications_hide_empty: true, applications_status_board: ['sent', 'waiting', 'interview', 'offer'] }) });

export const fakeTransport: Transport = async (method, args) => {
  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
  return backend.call(method, args) as ApiResult;
};
