import { SUPPORTED_LOCALES, ValidationError, type ApplicationStatus } from '@jobhunters/core';
import type { Handler } from './api';
import type { Container } from './container';

function asRecord(args: unknown, method: string): Record<string, unknown> {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    throw new ValidationError('invalid_arguments', `Invalid arguments for ${method}`, { method });
  }
  return args as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string, method: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value === '') {
    throw new ValidationError('invalid_arguments', `Argument ${key} of ${method} must be a non-empty string`, { method });
  }
  return value;
}

function stringRecord(args: unknown, method: string): Record<string, string> {
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

export function createHandlers(c: Container): Record<string, Handler> {
  return {
    getAppInfo: () => ({ version: c.appVersion, locales: [...SUPPORTED_LOCALES] }),

    getSettings: () => {
      const { settings, warnings } = c.settings.get();
      return { settings, warnings };
    },

    updateSettings: (args) => c.lock.run(() => c.settings.update(stringRecord(args, 'updateSettings'))),

    getWarnings: () => c.collectWarnings(),

    setApplicationStatus: (args) => {
      const input = asRecord(args, 'setApplicationStatus');
      const id = requireString(input, 'id', 'setApplicationStatus');
      const to = requireString(input, 'to', 'setApplicationStatus') as ApplicationStatus;
      const remindAt = input.remindAt;
      if (remindAt !== undefined && typeof remindAt !== 'string') {
        throw new ValidationError('invalid_arguments', 'Argument remindAt must be a string', { method: 'setApplicationStatus' });
      }
      return c.lock.run(() => c.applicationService.setStatus(id, to, remindAt === undefined ? {} : { remindAt }));
    },
  };
}
