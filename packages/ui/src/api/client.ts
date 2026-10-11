export interface ApiFailure {
  ok: false;
  error: { code: string; params: Record<string, string | number>; message: string };
}
export type ApiResult = { ok: true; data: unknown } | ApiFailure;
export type Transport = (method: string, args?: unknown) => Promise<ApiResult>;

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly params: Record<string, string | number> = {},
    message = code,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let transport: Transport | undefined;

export function setTransport(next: Transport | undefined): void {
  transport = next;
}

export async function call<T>(method: string, args?: unknown): Promise<T> {
  if (!transport) throw new Error('No API transport has been set');
  let result: ApiResult;
  try {
    result = await transport(method, args);
  } catch (cause) {
    throw new ApiError('transport_failed', {}, cause instanceof Error ? cause.message : 'The server did not answer');
  }
  if (!result.ok) throw new ApiError(result.error.code, result.error.params, result.error.message);
  return result.data as T;
}
