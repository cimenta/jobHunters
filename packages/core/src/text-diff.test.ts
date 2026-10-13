import { describe, expect, it } from 'vitest';
import { collapseDiff, diffTexts } from './text-diff';

const kinds = (from: string, to: string) => diffTexts(from, to).rows.map((row) => `${row.kind}:${row.segments.map((s) => s.text).join('')}`);

describe('diffTexts', () => {
  it('finds nothing in identical texts', () => {
    const diff = diffTexts('a\nb', 'a\nb');
    expect(diff).toMatchObject({ added: 0, removed: 0 });
    expect(diff.rows.map((row) => row.kind)).toEqual(['same', 'same']);
  });

  it('marks lines that disappear from the first text as removed and new lines as added', () => {
    expect(kinds('one\ntwo\nthree', 'one\nthree\nfour')).toEqual(['same:one', 'removed:two', 'same:three', 'added:four']);
    expect(diffTexts('one\ntwo\nthree', 'one\nthree\nfour')).toMatchObject({ added: 1, removed: 1 });
  });

  it('highlights only the changed words inside a changed line', () => {
    const diff = diffTexts('Senior engineer, 10 years in TypeScript.', 'Senior engineer, 12 years in TypeScript and cloud.');
    const [removed, added] = diff.rows;
    expect(removed).toMatchObject({ kind: 'removed' });
    expect(removed!.segments.filter((s) => s.changed).map((s) => s.text.trim())).toEqual(['10', 'TypeScript.']);
    expect(added).toMatchObject({ kind: 'added' });
    expect(added!.segments.filter((s) => s.changed).map((s) => s.text.trim()).join(' ')).toContain('12');
    expect(added!.segments.map((s) => s.text).join('')).toBe('Senior engineer, 12 years in TypeScript and cloud.');
    expect(removed!.segments.map((s) => s.text).join('')).toBe('Senior engineer, 10 years in TypeScript.');
  });

  it('shows an unpaired line whole as changed', () => {
    const diff = diffTexts('keep', 'keep\nnew line');
    expect(diff.rows[1]).toEqual({ kind: 'added', segments: [{ text: 'new line', changed: true }] });
  });

  it('treats an empty text as having no lines', () => {
    expect(diffTexts('', 'a\nb')).toMatchObject({ added: 2, removed: 0 });
    expect(diffTexts('a\nb', '')).toMatchObject({ added: 0, removed: 2 });
    expect(diffTexts('', '').rows).toEqual([]);
  });

  it('ignores the difference between Windows and Unix line ends', () => {
    expect(diffTexts('a\r\nb', 'a\nb')).toMatchObject({ added: 0, removed: 0 });
  });

  it('counts a changed line as one removed and one added', () => {
    expect(diffTexts('a', 'b')).toMatchObject({ added: 1, removed: 1 });
  });

  it('copes with a very long text without hanging', () => {
    const from = Array.from({ length: 3000 }, (_, i) => `line ${i}`).join('\n');
    const to = Array.from({ length: 3000 }, (_, i) => (i % 2 ? `line ${i}` : `changed ${i}`)).join('\n');
    const diff = diffTexts(from, to);
    expect(diff.added).toBe(1500);
    expect(diff.removed).toBe(1500);
  });
});

describe('collapseDiff', () => {
  const same = (n: number) => Array.from({ length: n }, (_, i) => `s${i}`).join('\n');

  it('keeps one equal line around a change and folds the rest of a long equal run', () => {
    const items = collapseDiff(diffTexts(`${same(6)}\nold`, `${same(6)}\nnew`));
    expect(items.map((item) => (item.type === 'fold' ? `fold:${item.count}` : `${item.row.kind}`))).toEqual(['fold:5', 'same', 'removed', 'added']);
  });

  it('does not fold a run that would hide fewer than two lines', () => {
    const items = collapseDiff(diffTexts('a\nb\nold', 'a\nb\nnew'));
    expect(items.some((item) => item.type === 'fold')).toBe(false);
  });

  it('folds an equal text as a whole when nothing changed', () => {
    const items = collapseDiff(diffTexts(same(5), same(5)));
    expect(items).toEqual([expect.objectContaining({ type: 'fold', count: 5 })]);
  });

  it('can show everything', () => {
    const diff = diffTexts(`${same(6)}\nold`, `${same(6)}\nnew`);
    expect(collapseDiff(diff, { all: true }).every((item) => item.type === 'row')).toBe(true);
  });
});
