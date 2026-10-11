import { AppError } from '../errors';

/** Runs `fn`, expects it to throw an AppError and returns it. */
export function errorOf(fn: () => unknown): AppError {
  try {
    fn();
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('Expected the function to throw');
}
