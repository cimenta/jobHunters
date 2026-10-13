import { afterEach, describe, expect, it, vi } from 'vitest';
import { gasTransport } from './gas';

afterEach(() => vi.unstubAllGlobals());

function stubGoogle(behaviour: (success: (r: unknown) => void, failure: (e: unknown) => void, method: string, args: unknown) => void) {
  vi.stubGlobal('google', {
    script: {
      run: {
        withSuccessHandler: (success: (r: unknown) => void) => ({
          withFailureHandler: (failure: (e: unknown) => void) => ({
            apiJson: (method: string, args: unknown) => behaviour(success, failure, method, args),
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

  it('keeps null properties: the answer travels as one JSON string because google.script.run drops null properties of objects', async () => {
    stubGoogle((success) => success(JSON.stringify({ ok: true, data: { salary_min: null, title: 't' } })));
    const result = await gasTransport('listJobs');
    expect(result).toEqual({ ok: true, data: { salary_min: null, title: 't' } });
    expect((result as { data: { salary_min: unknown } }).data.salary_min).toBeNull();
  });

  it('still accepts an answer that is already an object', async () => {
    stubGoogle((success) => success({ ok: true, data: 2 }));
    await expect(gasTransport('x')).resolves.toEqual({ ok: true, data: 2 });
  });

  it('rejects an answer that is not valid JSON', async () => {
    stubGoogle((success) => success('{not json'));
    await expect(gasTransport('x')).rejects.toThrow();
  });

  it('rejects when google.script.run fails', async () => {
    stubGoogle((_success, failure) => failure(new Error('boom')));
    await expect(gasTransport('x', {})).rejects.toThrow('boom');
  });
});
