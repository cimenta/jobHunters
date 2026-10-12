import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { expect, it } from 'vitest';

/**
 * Every important element carries a data-ui identifier (or `ui=` for shared components), so the identifier labels
 * (Alt+Shift+I) cover the whole interface. A new unlabeled control fails this test.
 */

const NATIVE = ['button', 'input', 'select', 'textarea', 'summary', 'details', 'table'];
// ConfirmDialog is not listed: its `ui` prop defaults to 'confirm-dialog' (existing id), so it is always labeled.
const COMPONENTS = ['Button', 'Dialog', 'Card', 'EmptyState'];

/** Explicit exemptions: `snippet` must be contained in the offending tag text. Keep this list tiny. */
const EXEMPT: { file: string; snippet: string; reason: string }[] = [
  {
    file: 'components/IdOverlay.svelte',
    snippet: 'data-id-tag',
    reason: 'These buttons ARE the identifier labels; giving them data-ui would make the overlay label itself.',
  },
];

function svelteFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return svelteFiles(path);
    return name.endsWith('.svelte') ? [path] : [];
  });
}

/** Replaces HTML comments, <script> and <style> bodies by spaces (newlines kept) so line numbers stay right. */
function blank(source: string): string {
  const wipe = (text: string): string => text.replace(/[^\n]/g, ' ');
  return source
    .replace(/<!--[\s\S]*?-->/g, wipe)
    .replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/g, (_m, a: string, b: string, c: string) => a + wipe(b) + c)
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/g, (_m, a: string, b: string, c: string) => a + wipe(b) + c);
}

/** Text of the opening tag starting at `start` (the `<`), up to its closing `>` ignoring `>` inside {...} and quotes. */
function tagText(source: string, start: number): string {
  let depth = 0;
  let quote = '';
  for (let i = start + 1; i < source.length; i += 1) {
    const ch = source[i]!;
    if (depth > 0) {
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
    } else if (quote) {
      if (ch === quote) quote = '';
      else if (ch === '{') depth = 1;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '{') depth = 1;
    else if (ch === '>') return source.slice(start, i + 1);
  }
  return source.slice(start);
}

function offenders(): string[] {
  const root = __dirname;
  const found: string[] = [];
  const names = [...NATIVE, ...COMPONENTS, 'a'].join('|');
  const opener = new RegExp(`<(${names})(?=[\\s/>])`, 'g');
  const roleOpener = /<(div|span|li|section|article|header|nav|ul|label)(?=\s)/g;
  const labeled = /\bdata-ui=(?!""|'')|\bui=(?!""|'')|\{\.\.\.|\{ui\}/;
  for (const file of svelteFiles(root)) {
    const rel = relative(root, file).split(sep).join('/');
    const source = blank(readFileSync(file, 'utf8'));
    const check = (index: number, tag: string): void => {
      const text = tagText(source, index);
      if (labeled.test(text)) return;
      if (EXEMPT.some((e) => e.file === rel && text.includes(e.snippet))) return;
      const line = source.slice(0, index).split('\n').length;
      found.push(`${rel}:${line} <${tag}> ${text.replace(/\s+/g, ' ').slice(0, 90)}`);
    };
    for (const match of source.matchAll(opener)) {
      const tag = match[1]!;
      if (tag === 'a' && !/\bhref\b/.test(tagText(source, match.index))) continue;
      check(match.index, tag);
    }
    for (const match of source.matchAll(roleOpener)) {
      if (/\brole=["'](button|tab|dialog|listitem|row)["']/.test(tagText(source, match.index))) check(match.index, match[1]!);
    }
  }
  return found;
}

/** Intentional repeats of a static id inside one file (e.g. different {#if} branches). Each needs a reason. */
const DUPLICATE_OK: { file: string; id: string; reason: string }[] = [];

function duplicates(): string[] {
  const root = __dirname;
  const found: string[] = [];
  for (const file of svelteFiles(root)) {
    const rel = relative(root, file).split(sep).join('/');
    const seen = new Map<string, number>();
    for (const match of blank(readFileSync(file, 'utf8')).matchAll(/(?:data-ui|ui)="([^"{}]+)"/g)) {
      seen.set(match[1]!, (seen.get(match[1]!) ?? 0) + 1);
    }
    for (const [id, count] of seen) {
      if (count > 1 && !DUPLICATE_OK.some((d) => d.file === rel && d.id === id)) found.push(`${rel}: "${id}" x${count}`);
    }
  }
  return found;
}

it('uses each static identifier only once per file', () => {
  expect(duplicates()).toEqual([]);
});

it('gives every important element a data-ui identifier', () => {
  expect(offenders()).toEqual([]);
});
