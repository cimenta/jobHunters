export const invalidation = $state({ version: 0 });

/** Every screen that loaded data re-reads it after a change. */
export function invalidate(): void {
  invalidation.version++;
}
