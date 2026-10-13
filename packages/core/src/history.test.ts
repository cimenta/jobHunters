import { describe, expect, it } from 'vitest';
import { HISTORY_COMMENT_MAX, HistoryService } from './history';
import { InMemoryKeyValueStore } from './key-value';
import { InMemoryRepository } from './repository';
import { SettingsService } from './settings';
import { errorOf } from './testing/errors';
import type { HistoryEntry } from './types';

const KEY = 'candidate_experience';

function setup(max = 50) {
  const entries = new InMemoryRepository<HistoryEntry>();
  let n = 0;
  const store = new InMemoryKeyValueStore();
  const history = new HistoryService({ entries, maxVersions: () => max, current: (key) => store.getAll()[key] ?? '', newId: () => `h${++n}`, now: () => '2026-10-13T08:00:00.000Z' });
  const settings = new SettingsService(store, undefined, history);
  const texts = () => history.list(KEY).entries.map((e) => [e.version, e.source, e.text]);
  return { entries, history, store, settings, texts, setMax: (value: number) => (max = value) };
}

describe('recording through SettingsService', () => {
  it('keeps the text before the first change as the pinned initial version, then records each change', () => {
    const { settings, history, texts } = setup();
    settings.update({ [KEY]: 'One' });
    settings.update({ [KEY]: 'Two' });
    expect(texts()).toEqual([[3, 'saved', 'Two'], [2, 'saved', 'One'], [1, 'initial', '']]);
    expect(history.list(KEY).entries.map((e) => e.pinned)).toEqual([false, false, true]);
    expect(history.list(KEY)).toMatchObject({ used: 2, max: 50 });
  });

  it('records nothing when the text did not change', () => {
    const { settings, texts } = setup();
    settings.update({ [KEY]: 'One' });
    settings.update({ [KEY]: 'One' });
    expect(texts()).toEqual([[2, 'saved', 'One'], [1, 'initial', '']]);
  });

  it('does not create the initial version for a save that changes nothing', () => {
    const { settings, texts } = setup();
    settings.update({ [KEY]: '' });
    expect(texts()).toEqual([]);
  });

  it('does not record settings that are not tracked', () => {
    const { settings, entries } = setup();
    settings.update({ ui_language: 'cs' });
    expect(entries.list()).toEqual([]);
  });

  it('passes the source and the restored version on', () => {
    const { settings, history } = setup();
    settings.update({ [KEY]: 'One' });
    settings.update({ [KEY]: 'Two' });
    settings.update({ [KEY]: 'One' }, { source: 'restored', restoredFrom: '2' });
    expect(history.list(KEY).entries[0]).toMatchObject({ version: 4, source: 'restored', restored_from: '2', text: 'One', pinned: false, comment: '' });
  });

  it('refuses a changing save when the unpinned versions reached the limit, and writes nothing', () => {
    const { settings, store, texts } = setup(1);
    settings.update({ [KEY]: 'One' });
    const error = errorOf(() => settings.update({ [KEY]: 'Two', ui_language: 'cs' }));
    expect(error).toMatchObject({ code: 'history_full', params: { used: 1, max: 1 } });
    expect(store.getAll()).toEqual({ [KEY]: 'One' });
    expect(texts()).toEqual([[2, 'saved', 'One'], [1, 'initial', '']]);
  });

  it('still accepts an unchanged save when the history is full', () => {
    const { settings } = setup(1);
    settings.update({ [KEY]: 'One' });
    expect(() => settings.update({ [KEY]: 'One' })).not.toThrow();
  });

  it('refuses until the user makes room, and a lowered limit deletes nothing', () => {
    const { settings, history, setMax, texts } = setup(5);
    for (const text of ['A', 'B', 'C']) settings.update({ [KEY]: text });
    setMax(2);
    expect(errorOf(() => settings.update({ [KEY]: 'D' }))).toMatchObject({ code: 'history_full', params: { used: 3, max: 2 } });
    expect(texts()).toHaveLength(4);
    history.remove(history.list(KEY).entries.find((e) => e.text === 'A')!.id);
    history.remove(history.list(KEY).entries.find((e) => e.text === 'B')!.id);
    settings.update({ [KEY]: 'D' });
    expect(texts().map((row) => row[2])).toEqual(['D', 'C', '']);
  });

  it('works when the text was edited outside the app (the live text differs from the newest version)', () => {
    const { settings, store, texts } = setup();
    settings.update({ [KEY]: 'One' });
    store.set(KEY, 'Edited in the sheet');
    settings.update({ [KEY]: 'Two' });
    expect(texts()[0]).toEqual([3, 'saved', 'Two']);
  });
});

describe('HistoryService live text and reads', () => {
  it('reports the live text, which can differ from every saved version', () => {
    const { settings, store, history } = setup();
    settings.update({ [KEY]: 'One' });
    expect(history.list(KEY).live).toBe('One');
    store.set(KEY, 'Edited in the sheet');
    expect(history.list(KEY).live).toBe('Edited in the sheet');
  });

  it('reads the entries once when it records a version', () => {
    const inner = new InMemoryRepository<HistoryEntry>();
    let reads = 0;
    const entries = Object.assign(Object.create(inner) as InMemoryRepository<HistoryEntry>, { list: () => (reads++, inner.list()) });
    let n = 0;
    const history = new HistoryService({ entries, maxVersions: () => 50, current: () => '', newId: () => `h${++n}`, now: () => '2026-10-13T08:00:00.000Z' });
    history.record(KEY, '', 'One', 'saved');
    expect(reads).toBe(1);
  });
});

describe('HistoryService', () => {
  function withVersions() {
    const ctx = setup();
    for (const text of ['A', 'B', 'C']) ctx.settings.update({ [KEY]: text });
    const byText = (text: string) => ctx.history.list(KEY).entries.find((e) => e.text === text)!;
    return { ...ctx, byText };
  }

  it('updates the comment and the pin, with the initial version always pinned', () => {
    const { history, byText } = withVersions();
    expect(history.update(byText('B').id, { comment: 'Sent to Acme', pinned: true })).toMatchObject({ comment: 'Sent to Acme', pinned: true });
    expect(errorOf(() => history.update(byText('').id, { pinned: false }))).toMatchObject({ code: 'history_entry_locked' });
    expect(history.update(byText('').id, { comment: 'Start' }).comment).toBe('Start');
    expect(history.update(byText('').id, { pinned: true }).pinned).toBe(true);
  });

  it('limits the comment length', () => {
    const { history, byText } = withVersions();
    expect(history.update(byText('B').id, { comment: 'x'.repeat(HISTORY_COMMENT_MAX) }).comment).toHaveLength(HISTORY_COMMENT_MAX);
    expect(errorOf(() => history.update(byText('B').id, { comment: 'x'.repeat(HISTORY_COMMENT_MAX + 1) }))).toMatchObject({ code: 'history_comment_too_long', params: { max: HISTORY_COMMENT_MAX } });
  });

  it('pinned versions do not count towards the limit', () => {
    const { history, byText } = withVersions();
    expect(history.list(KEY).used).toBe(3);
    history.update(byText('A').id, { pinned: true });
    expect(history.list(KEY).used).toBe(2);
  });

  it('deletes only unpinned versions that are not the newest', () => {
    const { history, byText } = withVersions();
    expect(errorOf(() => history.remove(byText('').id))).toMatchObject({ code: 'history_entry_locked' });
    expect(errorOf(() => history.remove(byText('C').id))).toMatchObject({ code: 'history_entry_locked' });
    history.update(byText('A').id, { pinned: true });
    expect(errorOf(() => history.remove(byText('A').id))).toMatchObject({ code: 'history_entry_locked' });
    history.remove(byText('B').id);
    expect(history.list(KEY).entries.map((e) => e.text)).toEqual(['C', 'A', '']);
  });

  it('never reuses a version number after a delete', () => {
    const { history, settings, byText } = withVersions();
    history.remove(byText('B').id);
    settings.update({ [KEY]: 'D' });
    expect(history.list(KEY).entries.map((e) => e.version)).toEqual([5, 4, 2, 1]);
  });

  it('reports a missing version', () => {
    const { history } = setup();
    expect(errorOf(() => history.get('nope'))).toMatchObject({ code: 'history_entry_not_found', params: { id: 'nope' } });
    expect(errorOf(() => history.update('nope', {}))).toMatchObject({ code: 'history_entry_not_found' });
    expect(errorOf(() => history.remove('nope'))).toMatchObject({ code: 'history_entry_not_found' });
  });
});
