import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';
import { afterEach, beforeEach, vi } from 'vitest';
import { setTransport } from './api/client';
import { setLocale } from './lib/i18n.svelte';
import { parseRoute } from './lib/route';
import { router } from './lib/router.svelte';
import { app } from './state/app.svelte';
import { ids } from './state/ids.svelte';
import { toasts } from './state/toast.svelte';

// Only Date is faked, so timers still run; UI code that reads "today" agrees with the dev backend's clock.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-11T08:00:00.000Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setTransport(undefined);
  setLocale('en');
  router.current = parseRoute('');
  app.phase = 'loading';
  app.error = undefined;
  app.version = '';
  app.settings = undefined;
  app.warnings = [];
  toasts.length = 0;
  ids.visible = false;
  localStorage.clear();
});
