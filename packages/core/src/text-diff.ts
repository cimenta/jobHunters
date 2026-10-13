/**
 * Difference between two texts: by lines, and inside a changed line by words. Pure; used by the History window to show
 * what changes in the current text when an older version is used.
 *
 * `diffTexts(current, version)`: a row is `removed` when it is in the first text only (it disappears) and `added` when it
 * is in the second text only (it appears).
 */

export type DiffKind = 'same' | 'added' | 'removed';

export interface DiffSegment {
  text: string;
  /** True for the words that differ from the paired line. */
  changed: boolean;
}

export interface DiffRow {
  kind: DiffKind;
  segments: DiffSegment[];
}

export interface TextDiff {
  rows: DiffRow[];
  /** Lines only in the second text. */
  added: number;
  /** Lines only in the first text. */
  removed: number;
}

export type DiffItem = { type: 'row'; row: DiffRow } | { type: 'fold'; count: number; rows: DiffRow[] };

/** Longest common subsequence tables above this many cells are not built: the part is shown as replaced as a whole. */
const MAX_CELLS = 16_000_000;
const MAX_WORD_CELLS = 4_000_000;

const splitLines = (text: string): string[] => (text === '' ? [] : text.replace(/\r\n?/g, '\n').split('\n'));

type Op = { kind: DiffKind; a?: string; b?: string };

/** Longest-common-subsequence walk over two lists; `keep` means equal. Falls back to "all replaced" when too big. */
function align(a: readonly string[], b: readonly string[], limit: number): Op[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const ops: Op[] = [];
  for (let i = 0; i < start; i++) ops.push({ kind: 'same', a: a[i], b: b[i] });
  const n = endA - start;
  const m = endB - start;
  if (n * m > limit || n > 60_000 || m > 60_000) {
    for (let i = start; i < endA; i++) ops.push({ kind: 'removed', a: a[i] });
    for (let j = start; j < endB; j++) ops.push({ kind: 'added', b: b[j] });
  } else {
    const width = m + 1;
    const table = new Uint16Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i * width + j] = a[start + i] === b[start + j] ? table[(i + 1) * width + j + 1]! + 1 : Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && a[start + i] === b[start + j]) {
        ops.push({ kind: 'same', a: a[start + i], b: b[start + j] });
        i++;
        j++;
      } else if (j >= m || (i < n && table[(i + 1) * width + j]! >= table[i * width + j + 1]!)) {
        ops.push({ kind: 'removed', a: a[start + i] });
        i++;
      } else {
        ops.push({ kind: 'added', b: b[start + j] });
        j++;
      }
    }
  }
  for (let i = endA; i < a.length; i++) ops.push({ kind: 'same', a: a[i], b: b[i - endA + endB] });
  return ops;
}

function merge(segments: DiffSegment[]): DiffSegment[] {
  const out: DiffSegment[] = [];
  for (const segment of segments) {
    const last = out[out.length - 1];
    if (last && last.changed === segment.changed) last.text += segment.text;
    else out.push({ ...segment });
  }
  return out;
}

const whole = (text: string, changed: boolean): DiffSegment[] => (text === '' ? [] : [{ text, changed }]);

/** The words of two paired lines: which words of each are not in the other. */
function pairWords(from: string, to: string): { removed: DiffSegment[]; added: DiffSegment[] } {
  const a = from.split(/(\s+)/).filter((token) => token !== '');
  const b = to.split(/(\s+)/).filter((token) => token !== '');
  const ops = align(a, b, MAX_WORD_CELLS);
  const removed: DiffSegment[] = [];
  const added: DiffSegment[] = [];
  for (const op of ops) {
    if (op.kind === 'same') {
      removed.push({ text: op.a!, changed: false });
      added.push({ text: op.b!, changed: false });
    } else if (op.kind === 'removed') removed.push({ text: op.a!, changed: true });
    else added.push({ text: op.b!, changed: true });
  }
  return { removed: merge(removed), added: merge(added) };
}

export function diffTexts(from: string, to: string): TextDiff {
  const ops = align(splitLines(from), splitLines(to), MAX_CELLS);
  const rows: DiffRow[] = [];
  let added = 0;
  let removed = 0;
  for (let index = 0; index < ops.length; ) {
    const op = ops[index]!;
    if (op.kind === 'same') {
      rows.push({ kind: 'same', segments: whole(op.a!, false) });
      index++;
      continue;
    }
    // A run of removed lines followed by a run of added lines is a change: pair them line by line for the word marks.
    const gone: string[] = [];
    const come: string[] = [];
    while (index < ops.length && ops[index]!.kind === 'removed') gone.push(ops[index++]!.a!);
    while (index < ops.length && ops[index]!.kind === 'added') come.push(ops[index++]!.b!);
    removed += gone.length;
    added += come.length;
    const paired = Math.min(gone.length, come.length);
    for (let k = 0; k < paired; k++) {
      const words = pairWords(gone[k]!, come[k]!);
      rows.push({ kind: 'removed', segments: words.removed });
      rows.push({ kind: 'added', segments: words.added });
    }
    for (let k = paired; k < gone.length; k++) rows.push({ kind: 'removed', segments: whole(gone[k]!, true) });
    for (let k = paired; k < come.length; k++) rows.push({ kind: 'added', segments: whole(come[k]!, true) });
  }
  return { rows, added, removed };
}

/**
 * The rows to show: long runs of equal lines are folded, keeping `context` equal lines next to a change. A run is
 * folded only when it hides at least two lines. `all` returns every row.
 */
export function collapseDiff(diff: TextDiff, options: { all?: boolean; context?: number } = {}): DiffItem[] {
  const rows = diff.rows;
  if (options.all) return rows.map((row) => ({ type: 'row', row }));
  const context = options.context ?? 1;
  const items: DiffItem[] = [];
  for (let index = 0; index < rows.length; ) {
    if (rows[index]!.kind !== 'same') {
      items.push({ type: 'row', row: rows[index++]! });
      continue;
    }
    let end = index;
    while (end < rows.length && rows[end]!.kind === 'same') end++;
    const run = rows.slice(index, end);
    const before = index > 0 ? Math.min(context, run.length) : 0;
    const after = end < rows.length ? Math.min(context, run.length - before) : 0;
    const hidden = run.slice(before, run.length - after);
    if (hidden.length < 2) {
      for (const row of run) items.push({ type: 'row', row });
    } else {
      for (const row of run.slice(0, before)) items.push({ type: 'row', row });
      items.push({ type: 'fold', count: hidden.length, rows: hidden });
      for (const row of run.slice(run.length - after)) items.push({ type: 'row', row });
    }
    index = end;
  }
  return items;
}
