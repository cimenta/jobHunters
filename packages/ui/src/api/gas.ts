import type { ApiResult, Transport } from './client';

interface GoogleRun {
  withSuccessHandler(callback: (result: unknown) => void): {
    withFailureHandler(callback: (error: unknown) => void): { apiJson(method: string, args: unknown): void };
  };
}
declare const google: { script: { run: GoogleRun } };

/**
 * The browser side of `apiJson(method, args)` in main.ts. Missing arguments are sent as null (undefined is not serialisable).
 * The answer is one JSON string, because google.script.run drops the null properties of objects (they would arrive as
 * undefined, for example an empty salary or an ad without a match).
 */
export const gasTransport: Transport = (method, args) =>
  new Promise<ApiResult>((resolve, reject) => {
    google.script.run
      .withSuccessHandler((result) => {
        try {
          resolve((typeof result === 'string' ? JSON.parse(result) : result) as ApiResult);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      })
      .withFailureHandler((error) => reject(error instanceof Error ? error : new Error(String(error))))
      .apiJson(method, args ?? null);
  });

export function hasGoogle(): boolean {
  return typeof (globalThis as { google?: unknown }).google !== 'undefined';
}
