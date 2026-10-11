import { afterEach, describe, expect, it } from 'vitest';
import { ApiError, call, setTransport } from './client';

afterEach(() => setTransport(undefined));

describe('call', () => {
  it('returns the data of a successful answer', async () => {
    setTransport(async () => ({ ok: true, data: { a: 1 } }));
    await expect(call('x')).resolves.toEqual({ a: 1 });
  });

  it('turns an error answer into an ApiError with code and params', async () => {
    setTransport(async () => ({ ok: false, error: { code: 'row_not_found', params: { id: 'r1' }, message: 'Row r1 not found' } }));
    const error = await call('x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'row_not_found', params: { id: 'r1' }, message: 'Row r1 not found' });
  });

  it('turns a failing transport into a transport_failed ApiError', async () => {
    setTransport(async () => {
      throw new Error('network down');
    });
    await expect(call('x')).rejects.toMatchObject({ code: 'transport_failed' });
  });

  it('fails clearly when no transport was set', async () => {
    await expect(call('x')).rejects.toThrow('transport');
  });

  it('passes method and arguments to the transport', async () => {
    const seen: unknown[] = [];
    setTransport(async (method, args) => {
      seen.push([method, args]);
      return { ok: true, data: null };
    });
    await call('getJob', { id: 'j1' });
    expect(seen).toEqual([['getJob', { id: 'j1' }]]);
  });
});
