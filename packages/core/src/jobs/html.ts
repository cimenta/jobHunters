import { hasOwn } from '../util';

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', euro: '€',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body.startsWith('#')) {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    const name = body.toLowerCase();
    return hasOwn(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name]! : match;
  });
}

export function stripTags(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|svg)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<[^>]*>/g, '');
}

/** Readable text with paragraph and list structure. Entities are decoded after the tags are gone. */
export function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|ul|ol|section|article)\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ');
  return decodeEntities(stripTags(withBreaks))
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parseAttrs(tag: string): Record<string, string> {
  const attrs = Object.create(null) as Record<string, string>;
  const pattern = /([^\s=<>"'\/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tag)) !== null) {
    const name = match[1]!.toLowerCase();
    if (!hasOwn(attrs, name)) attrs[name] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attrs;
}

export function metaContent(html: string, key: string): string {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs = parseAttrs(tag);
    if ((attrs.property === key || attrs.name === key) && attrs.content !== undefined) return attrs.content.trim();
  }
  return '';
}

export function titleTag(html: string): string {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? decodeEntities(stripTags(match[1]!)).replace(/\s+/g, ' ').trim() : '';
}

function collectObjects(node: unknown, out: Record<string, unknown>[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectObjects(item, out);
  } else if (typeof node === 'object' && node !== null) {
    const record = node as Record<string, unknown>;
    out.push(record);
    if (Array.isArray(record['@graph'])) collectObjects(record['@graph'], out);
  }
}

/** Every object found in the page's application/ld+json blocks, @graph flattened. Invalid blocks are skipped. */
export function jsonLdObjects(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const pattern = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    try {
      collectObjects(JSON.parse(match[1]!), out);
    } catch {
      // A broken block must not hide the others.
    }
  }
  return out;
}

const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

function findClosing(html: string, name: string, from: number): number {
  const pattern = new RegExp(`<(/?)${name}\\b[^>]*>`, 'gi');
  pattern.lastIndex = from;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    if (match[1] === '/') {
      depth--;
      if (depth === 0) return match.index;
    } else if (!match[0].endsWith('/>')) {
      depth++;
    }
  }
  return -1;
}

/**
 * Inner HTML of every element whose opening tag matches `openTag` (a non-global RegExp tested against
 * the tag text, e.g. /data-test="x"/ or /^<h1\b/i). Works on strings because Apps Script has no DOM.
 */
export function elementsInnerHtml(html: string, openTag: RegExp): string[] {
  const results: string[] = [];
  const opening = /<([a-zA-Z][\w-]*)\b[^>]*>/g;
  let match: RegExpExecArray | null;
  while ((match = opening.exec(html)) !== null) {
    const tag = match[0];
    const name = match[1]!.toLowerCase();
    if (VOID_ELEMENTS.has(name) || tag.endsWith('/>') || !openTag.test(tag)) continue;
    const start = match.index + tag.length;
    const end = findClosing(html, name, start);
    if (end >= 0) results.push(html.slice(start, end));
  }
  return results;
}

export function foldDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Sheets cells hold at most 50 000 characters. */
export const CELL_LIMIT = 49000;

export function truncateForCell(text: string, limit: number = CELL_LIMIT): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;
}

const ENGLISH_WORDS = new Set(['the', 'and', 'with', 'for', 'you', 'our', 'will', 'are', 'of', 'to', 'in', 'we', 'is', 'a', 'an', 'your', 'as', 'on', 'be']);

export function detectLanguage(text: string): 'en' | 'cs' | '' {
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  if (letters < 40) return '';
  const czech = (text.match(/[ěščřžýáíéúůďťňóĚŠČŘŽÝÁÍÉÚŮĎŤŇÓ]/g) ?? []).length;
  if (czech / letters >= 0.02) return 'cs';
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const english = words.filter((word) => ENGLISH_WORDS.has(word)).length;
  return words.length > 0 && english / words.length >= 0.12 ? 'en' : '';
}
