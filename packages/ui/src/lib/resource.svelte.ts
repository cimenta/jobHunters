import { untrack } from 'svelte';
import { invalidation } from '../state/invalidate.svelte';

export class Resource<T> {
  status = $state<'loading' | 'ready' | 'error'>('loading');
  data = $state<T>();
  error = $state<unknown>();
  private ticket = 0;

  reset(): void {
    this.ticket++;
    this.status = 'loading';
    this.data = undefined;
    this.error = undefined;
  }

  async run(promise: Promise<T>): Promise<void> {
    const mine = ++this.ticket;
    try {
      const value = await promise;
      if (mine !== this.ticket) return;
      this.data = value;
      this.error = undefined;
      this.status = 'ready';
    } catch (error) {
      if (mine !== this.ticket) return;
      this.error = error;
      this.status = 'error';
    }
  }
}

/**
 * Loads on mount, again whenever something read inside `loader` changes (for example a route id) and after every
 * `invalidate()`. A change of `key` clears the old data first, so a detail never shows the previous record. Call it
 * during component setup.
 */
export function useResource<T>(loader: () => Promise<T>, key?: () => unknown): Resource<T> {
  const resource = new Resource<T>();
  let lastKey: unknown = undefined;
  let first = true;
  $effect(() => {
    void invalidation.version;
    const currentKey = key?.();
    const promise = loader();
    untrack(() => {
      if (!first && currentKey !== lastKey) resource.reset();
      first = false;
      lastKey = currentKey;
      void resource.run(promise);
    });
  });
  return resource;
}
