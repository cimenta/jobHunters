import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { invalidate } from '../state/invalidate.svelte';
import ResourceProbe from '../test/ResourceProbe.svelte';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useResource', () => {
  it('loads, shows loading first and the data afterwards', async () => {
    const d = deferred<string>();
    render(ResourceProbe, { load: () => d.promise, id: 'a' });
    expect(screen.getByTestId('status')).toHaveTextContent('loading');
    d.resolve('hello');
    await waitFor(() => expect(screen.getByTestId('data')).toHaveTextContent('hello'));
    expect(screen.getByTestId('status')).toHaveTextContent('ready');
  });

  it('reports a failure', async () => {
    const d = deferred<string>();
    render(ResourceProbe, { load: () => d.promise, id: 'a' });
    d.reject(new Error('x'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'));
    expect(screen.getByTestId('error')).toHaveTextContent('failed');
  });

  it('ignores a slow answer for a previous key', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const load = (id: string) => (id === 'a' ? first.promise : second.promise);
    const { rerender } = render(ResourceProbe, { load, id: 'a' });
    await rerender({ load, id: 'b' });
    second.resolve('B');
    await waitFor(() => expect(screen.getByTestId('data')).toHaveTextContent('B'));
    first.resolve('A');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByTestId('data')).toHaveTextContent('B');
  });

  it('clears the old data when the key changes', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const load = (id: string) => (id === 'a' ? first.promise : second.promise);
    const { rerender } = render(ResourceProbe, { load, id: 'a' });
    first.resolve('A');
    await waitFor(() => expect(screen.getByTestId('data')).toHaveTextContent('A'));
    await rerender({ load, id: 'b' });
    expect(screen.getByTestId('data')).toHaveTextContent('');
    expect(screen.getByTestId('status')).toHaveTextContent('loading');
  });

  it('reloads after invalidate() and keeps showing the old data meanwhile', async () => {
    let calls = 0;
    const load = async () => `call ${++calls}`;
    render(ResourceProbe, { load, id: 'a' });
    await waitFor(() => expect(screen.getByTestId('data')).toHaveTextContent('call 1'));
    invalidate();
    await waitFor(() => expect(screen.getByTestId('data')).toHaveTextContent('call 2'));
  });
});
