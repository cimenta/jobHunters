import { ValidationError } from '@jobhunters/core';

export function invalidArguments(method: string): never {
  throw new ValidationError('invalid_arguments', `Invalid arguments for ${method}`, { method });
}

export function asRecord(args: unknown, method: string): Record<string, unknown> {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) return invalidArguments(method);
  return args as Record<string, unknown>;
}

export function requireString(record: Record<string, unknown>, key: string, method: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value === '') {
    throw new ValidationError('invalid_arguments', `Argument ${key} of ${method} must be a non-empty string`, { method });
  }
  return value;
}

export function optionalString(record: Record<string, unknown>, key: string, method: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return invalidArguments(method);
  return value;
}

/** A number, `null` (clear the value) or undefined (not given). */
export function optionalNumber(record: Record<string, unknown>, key: string, method: string): number | null | undefined {
  const value = record[key];
  if (value === undefined || value === null) return value;
  if (typeof value !== 'number') return invalidArguments(method);
  return value;
}

export function stringRecord(args: unknown, method: string): Record<string, string> {
  const record = asRecord(args, method);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (typeof value !== 'string') {
      throw new ValidationError('invalid_arguments', `Argument ${key} of ${method} must be a string`, { method });
    }
    out[key] = value;
  }
  return out;
}

export function optionalBoolean(record: Record<string, unknown>, key: string, method: string): boolean | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') return invalidArguments(method);
  return value;
}
