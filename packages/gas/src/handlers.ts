import { AppError, EDITABLE_JOB_FIELDS, isHistoryKey, NotFoundError, type HistoryKey, PROMPT_TYPES, PROMPTS_VERSION, SETTINGS_DEFAULTS, SUPPORTED_LOCALES, ValidationError, type ApplicationStatus, type JobOverrides } from '@jobhunters/core';
import type { Handler } from './api';
import { asRecord, invalidArguments, optionalBoolean, optionalString, requireString, stringRecord } from './args';
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
  const html = input.html;
  if (html !== undefined && typeof html !== 'string') fail();
  const raw = input.overrides;
  let overrides: JobOverrides | undefined;
  if (raw !== undefined) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) fail();
    overrides = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!(EDITABLE_JOB_FIELDS as readonly string[]).includes(key)) fail();
      const valid = NUMBER_FIELDS.has(key)
        ? value === null || typeof value === 'number'
        : (key === 'is_gig' || key === 'gig_priority' || key === 'is_remote' || key === 'is_hybrid')
          ? typeof value === 'boolean'
          : typeof value === 'string';
      if (!valid) fail();
      (overrides as Record<string, unknown>)[key] = value;
    }
  }
  return { url, text: text as string | undefined, html: html as string | undefined, overrides };
}

function historyKey(input: Record<string, unknown>, method: string): HistoryKey {
  const key = requireString(input, 'key', method);
  if (!isHistoryKey(key)) invalidArguments(method);
  return key;
}

export function createHandlers(c: Container): Record<string, Handler> {
  return {
    ...createApplicationHandlers(c),

    getAppInfo: () => ({ version: c.appVersion, locales: [...SUPPORTED_LOCALES], timeZone: c.timeZone() }),

    getSettings: () => {
      const { settings, warnings } = c.settings.get();
      return { settings, warnings };
    },

    updateSettings: (args) => c.lock.run(() => c.settings.update(stringRecord(args, 'updateSettings'))),

    /** Brings the built-in prompts back and takes the notice about new prompts as read; every changed prompt gets a history entry. */
    resetPrompts: () =>
      c.lock.run(() =>
        c.settings.update(
          { ...Object.fromEntries(PROMPT_TYPES.map((type) => [`ai_prompt_${type}`, SETTINGS_DEFAULTS[`ai_prompt_${type}`]])), ai_prompts_version: String(PROMPTS_VERSION) },
          { source: 'reset' },
        ),
      ),

    listHistory: (args) => {
      const key = historyKey(asRecord(args, 'listHistory'), 'listHistory');
      try {
        return c.historyService.list(key);
      } catch (error) {
        // The sheet is created by setup; until then there is simply nothing to show.
        if (error instanceof AppError && error.code === 'sheet_missing') return { entries: [], used: 0, max: c.settings.get().settings.history_max_versions, live: c.settings.raw(key) };
        throw error;
      }
    },

    updateHistoryEntry: (args) => {
      const input = asRecord(args, 'updateHistoryEntry');
      const id = requireString(input, 'id', 'updateHistoryEntry');
      const patch: { comment?: string; pinned?: boolean } = {};
      const comment = optionalString(input, 'comment', 'updateHistoryEntry');
      const pinned = optionalBoolean(input, 'pinned', 'updateHistoryEntry');
      if (comment !== undefined) patch.comment = comment;
      if (pinned !== undefined) patch.pinned = pinned;
      return c.lock.run(() => c.historyService.update(id, patch));
    },

    deleteHistoryEntry: (args) => {
      const id = requireString(asRecord(args, 'deleteHistoryEntry'), 'id', 'deleteHistoryEntry');
      c.lock.run(() => c.historyService.remove(id));
      return null;
    },

    restoreHistory: (args) => {
      const input = asRecord(args, 'restoreHistory');
      const key = historyKey(input, 'restoreHistory');
      const id = requireString(input, 'id', 'restoreHistory');
      return c.lock.run(() => {
        const entry = c.historyService.get(id);
        if (entry.key !== key) throw new NotFoundError('history_entry_not_found', `History version ${id} not found`, { id });
        return c.settings.update({ [key]: entry.text }, { source: 'restored', restoredFrom: String(entry.version) });
      });
    },

    getWarnings: () => c.collectWarnings(),

    getSetupStatus: () => {
      const status = c.setupStatus ? c.setupStatus() : { needed: false, reasons: [] };
      // The statuses of the ads that already have an application are moved once; until Setup did it, the red mark says so.
      let pending = 0;
      try {
        pending = c.jobStatusMigration.pending();
      } catch {
        // A sheet that lacks columns is already reported by the setup check itself.
      }
      const reasons = [...status.reasons];
      if (pending > 0) reasons.push(`${pending} ads that already have an application still have the status New (Setup moves them to Applied or Archived)`);
      // Older sheets got formats on the wrong columns; Setup puts them right once and remembers it.
      if (c.setupStatus && c.settings.raw('sheet_formats_repaired') !== '1') reasons.push('The formats of the sheet columns have to be put right (Setup does it)');
      // The new communication type (after a meeting) has to be in the dropdown of the sheet Communications.
      if (c.setupStatus && c.settings.raw('communication_kinds_listed') !== '1') reasons.push('The list of communication types in the sheet Communications has to be updated (Setup does it)');
      // The new status Homework (and the reminder source homework) have to be in the dropdowns of the sheets.
      if (c.setupStatus && c.settings.raw('status_homework_listed') !== '1') reasons.push('The status Homework has to be added to the lists of the sheets Applications and Reminders (Setup does it)');
      return reasons.length > status.reasons.length ? { needed: true, reasons } : status;
    },

    runSetup: () => (c.runSetup ? c.lock.run(() => c.runSetup!()) : { ok: false, lines: ['Setup cannot run here.'] }),

    previewJob: (args) => c.jobService.preview(parseJobInput(args, 'previewJob')),

    saveJob: (args) => {
      const input = parseJobInput(args, 'saveJob');
      return c.lock.run(() => c.jobService.save(input));
    },

    moveApplication: (args) => {
      const input = asRecord(args, 'moveApplication');
      const id = requireString(input, 'id', 'moveApplication');
      const to = requireString(input, 'to', 'moveApplication') as ApplicationStatus;
      const index = input.index;
      if (typeof index !== 'number') throw new ValidationError('invalid_arguments', 'Argument index must be a number', { method: 'moveApplication' });
      const remindAt = input.remindAt;
      if (remindAt !== undefined && typeof remindAt !== 'string') {
        throw new ValidationError('invalid_arguments', 'Argument remindAt must be a string', { method: 'moveApplication' });
      }
      return c.lock.run(() => c.applicationService.move(id, to, index, remindAt === undefined ? {} : { remindAt }));
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
