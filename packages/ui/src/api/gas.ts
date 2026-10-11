import type { ApiResult, Transport } from './client';

interface GoogleRun {
  withSuccessHandler(callback: (result: unknown) => void): {
    withFailureHandler(callback: (error: unknown) => void): { api(method: string, args: unknown): void };
  };
}
declare const google: { script: { run: GoogleRun } };

/** The browser side of `api(method, args)` in main.ts. Missing arguments are sent as null (undefined is not serialisable). */
export const gasTransport: Transport = (method, args) =>
  new Promise<ApiResult>((resolve, reject) => {
    google.script.run
      .withSuccessHandler((result) => resolve(result as ApiResult))
      .withFailureHandler((error) => reject(error instanceof Error ? error : new Error(String(error))))
      .api(method, args ?? null);
  });

export function hasGoogle(): boolean {
  return typeof (globalThis as { google?: unknown }).google !== 'undefined';
}
