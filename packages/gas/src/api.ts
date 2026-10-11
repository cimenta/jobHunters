import { AppError, hasOwn, type ErrorParams } from '@jobhunters/core';

export interface ApiFailure {
  ok: false;
  error: { code: string; params: ErrorParams; message: string };
}
export type ApiResult<T = unknown> = { ok: true; data: T } | ApiFailure;
export type Handler = (args: unknown) => unknown;

export interface ApiDeps {
  handlers: Record<string, Handler>;
  /** Writes to the Log sheet. May throw; the api never lets that escape. */
  log: (flow: string, entity: string, message: string) => void;
}

export function toFailure(error: unknown): ApiFailure {
  if (error instanceof AppError) return { ok: false, error: { code: error.code, params: error.params, message: error.message } };
  return { ok: false, error: { code: 'internal_error', params: {}, message: 'Unexpected error' } };
}

export function createApi({ handlers, log }: ApiDeps): (method: string, args?: unknown) => ApiResult {
  const safeLog = (method: string, message: string): void => {
    try {
      log('api', method, message);
    } catch {
      // Logging must never break the answer.
    }
  };

  return (method, args) => {
    const handler = typeof method === 'string' && hasOwn(handlers, method) ? handlers[method] : undefined;
    if (!handler) {
      return { ok: false, error: { code: 'unknown_method', params: { method: String(method) }, message: `Unknown API method "${String(method)}"` } };
    }
    try {
      const data = handler(args);
      return { ok: true, data: data === undefined ? null : data };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      safeLog(method, error instanceof AppError ? `${error.code}: ${detail}` : detail);
      return toFailure(error);
    }
  };
}
