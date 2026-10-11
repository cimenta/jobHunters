import { parseRoute, type Route } from './route';

export const router = $state<{ current: Route }>({ current: parseRoute(typeof window === 'undefined' ? '' : window.location.hash) });

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    router.current = parseRoute(window.location.hash);
  });
}

/** `hash` is a link from `paths`, for example `#/jobs/j1`. */
export function navigate(hash: string): void {
  router.current = parseRoute(hash);
  if (typeof window !== 'undefined') window.location.hash = hash;
}
