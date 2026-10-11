import { EDITABLE_JOB_FIELDS, SUPPORTED_LOCALES, ValidationError, type ApplicationStatus, type JobOverrides } from '@jobhunters/core';
import type { Handler } from './api';
import { asRecord, requireString, stringRecord } from './args';
import type { Container } from './container';
import { createApplicationHandlers } from './handlers-applications';

const NUMBER_FIELDS = new Set(['salary_min', 'salary_max']);

function parseJobInput(args: unknown, method: string) {
  const input = asRecord(args, method);
  const fail = (): never => {
    throw new ValidationError('invalid_arguments', `Invalid arguments for ${method}`, { method });
  };
  const url = requireString(input, 'url', method);
  const text = input.text;
  if (text !== undefined && typeof text !== 'string') fail();
  const raw = input.overrides;
  let overrides: JobOverrides | undefined;
  if (raw !== undefined) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) fail();
    overrides = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!(EDITABLE_JOB_FIELDS as readonly string[]).includes(key)) fail();
      const valid = NUMBER_FIELDS.has(key)
        ? value === null || typeof value === 'number'
        : key === 'is_gig'
          ? typeof value === 'boolean'
          : typeof value === 'string';
      if (!valid) fail();
      (overrides as Record<string, unknown>)[key] = value;
    }
  }
  return { url, text: text as string | undefined, overrides };
}

export function createHandlers(c: Container): Record<string, Handler> {
  return {
    ...createApplicationHandlers(c),

    getAppInfo: () => ({ version: c.appVersion, locales: [...SUPPORTED_LOCALES] }),

    getSettings: () => {
      const { settings, warnings } = c.settings.get();
      return { settings, warnings };
    },

    updateSettings: (args) => c.lock.run(() => c.settings.update(stringRecord(args, 'updateSettings'))),

    getWarnings: () => c.collectWarnings(),

    previewJob: (args) => c.jobService.preview(parseJobInput(args, 'previewJob')),

    saveJob: (args) => {
      const input = parseJobInput(args, 'saveJob');
      return c.lock.run(() => c.jobService.save(input));
    },

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
