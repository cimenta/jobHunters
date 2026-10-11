import { afterEach, describe, expect, it, vi } from 'vitest';
import { gasTransport } from './gas';

afterEach(() => vi.unstubAllGlobals());

function stubGoogle(behaviour: (success: (r: unknown) => void, failure: (e: unknown) => void, method: string, args: unknown) => void) {
  vi.stubGlobal('google', {
    script: {
      run: {
        withSuccessHandler: (success: (r: unknown) => void) => ({
          withFailureHandler: (failure: (e: unknown) => void) => ({
            api: (method: string, args: unknown) => behaviour(success, failure, method, args),
          }),
        }),
      },
    },
  });
}

describe('gasTransport', () => {
  it('resolves with the answer of google.script.run and sends null for missing arguments', async () => {
    const seen: unknown[] = [];
    stubGoogle((success, _failure, method, args) => {
      seen.push([method, args]);
      success({ ok: true, data: 1 });
    });
    await expect(gasTransport('listJobs')).resolves.toEqual({ ok: true, data: 1 });
    expect(seen).toEqual([['listJobs', null]]);
  });

  it('rejects when google.script.run fails', async () => {
    stubGoogle((_success, failure) => failure(new Error('boom')));
    await expect(gasTransport('x', {})).rejects.toThrow('boom');
  });
});
