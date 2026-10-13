import { NotFoundError, ValidationError } from './errors';
import type { Repository } from './repository';
import type { HistoryEntry, HistorySource } from './types';

/** The settings whose text keeps a history. Add a key here to track another text. */
export const HISTORY_KEYS = ['candidate_experience'] as const;
export type HistoryKey = (typeof HISTORY_KEYS)[number];

export function isHistoryKey(key: string): key is HistoryKey {
  return (HISTORY_KEYS as readonly string[]).includes(key);
}

export const HISTORY_COMMENT_MAX = 500;

export interface HistoryList {
  /** Newest first. */
  entries: HistoryEntry[];
  /** Unpinned versions of this text: the ones the limit counts. */
  used: number;
  max: number;
  /** The text as it is now. It can differ from every saved version when it was edited outside the app. */
  live: string;
}

/** What SettingsService needs from the history: a check before any write, and the recording. */
export interface SettingsHistory {
  /** Throws history_full when no unpinned version can be added. */
  assertRoom(key: string): void;
  /** Records `next` as a new version (and the version before the first change as the initial one). A no-op when the text did not change. */
  record(key: string, previous: string, next: string, source: HistorySource, restoredFrom?: string): void;
}

export interface HistoryDeps {
  entries: Repository<HistoryEntry>;
  /** The history_max_versions setting. */
  maxVersions: () => number;
  /** The text as it is now. */
  current: (key: string) => string;
  newId: () => string;
  /** ISO 8601 date-time. */
  now: () => string;
}

export class HistoryService implements SettingsHistory {
  constructor(private readonly deps: HistoryDeps) {}

  /** The versions of one text, oldest first. */
  private ofKey(key: string): HistoryEntry[] {
    return this.deps.entries.list().filter((entry) => entry.key === key).sort((a, b) => a.version - b.version);
  }

  list(key: string): HistoryList {
    const all = this.ofKey(key);
    return { entries: [...all].reverse(), used: all.filter((entry) => !entry.pinned).length, max: this.deps.maxVersions(), live: this.deps.current(key) };
  }

  get(id: string): HistoryEntry {
    const found = this.deps.entries.get(id);
    if (found === undefined) throw new NotFoundError('history_entry_not_found', `History version ${id} not found`, { id });
    return found;
  }

  assertRoom(key: string): void {
    const { used, max } = this.list(key);
    if (used >= max) throw new ValidationError('history_full', `The history of ${key} is full`, { used, max });
  }

  record(key: string, previous: string, next: string, source: HistorySource, restoredFrom = ''): void {
    if (previous === next) return;
    const all = this.ofKey(key);
    const used = all.filter((entry) => !entry.pinned).length;
    const max = this.deps.maxVersions();
    if (used >= max) throw new ValidationError('history_full', `The history of ${key} is full`, { used, max });
    let version = (all[all.length - 1]?.version ?? 0) + 1;
    const base = { key, restored_from: '', comment: '' };
    if (all.length === 0) {
      this.deps.entries.insert({ ...base, id: this.deps.newId(), version, saved_at: this.deps.now(), source: 'initial', pinned: true, text: previous });
      version += 1;
    }
    this.deps.entries.insert({ ...base, id: this.deps.newId(), version, saved_at: this.deps.now(), source, restored_from: restoredFrom, pinned: false, text: next });
  }

  update(id: string, patch: { comment?: string; pinned?: boolean }): HistoryEntry {
    const entry = this.get(id);
    if (patch.comment !== undefined && patch.comment.length > HISTORY_COMMENT_MAX) {
      throw new ValidationError('history_comment_too_long', 'The comment is too long', { max: HISTORY_COMMENT_MAX });
    }
    if (patch.pinned === false && entry.source === 'initial') {
      throw new ValidationError('history_entry_locked', 'The initial version stays pinned', { id });
    }
    const next: Partial<Omit<HistoryEntry, 'id'>> = {};
    if (patch.comment !== undefined) next.comment = patch.comment;
    if (patch.pinned !== undefined) next.pinned = patch.pinned;
    return this.deps.entries.update(id, next);
  }

  remove(id: string): void {
    const entry = this.get(id);
    const newest = this.ofKey(entry.key).at(-1);
    if (entry.source === 'initial' || entry.pinned || newest?.id === entry.id) {
      throw new ValidationError('history_entry_locked', 'This version cannot be deleted', { id });
    }
    this.deps.entries.remove(id);
  }
}
