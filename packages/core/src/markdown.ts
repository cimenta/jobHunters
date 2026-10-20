/**
 * A small Markdown parser for notes the user writes. It returns a tree, never HTML: the screen draws the tree with
 * ordinary elements, so nothing the user typed can become markup or run. It supports headings, bold, italic, inline
 * code, fenced code, bullet and numbered lists (one level), quotes, a horizontal rule, http(s) links and paragraphs; a
 * single line break stays a line break. A link is kept only when its address starts with http:// or https://; anything
 * else stays text.
 */
export type MdInline =
  | { t: 'text'; text: string }
  | { t: 'strong' | 'em'; children: MdInline[] }
  | { t: 'code'; text: string }
  | { t: 'link'; href: string; children: MdInline[] }
  | { t: 'br' };

export type MdBlock =
  | { t: 'heading'; level: 3 | 4 | 5; children: MdInline[] }
  | { t: 'p'; children: MdInline[] }
  | { t: 'list'; ordered: boolean; items: MdInline[][] }
  | { t: 'quote'; children: MdBlock[] }
  | { t: 'pre'; text: string }
  | { t: 'hr' };

const LIST_MARK = /^\s*(?:[-*+]|\d+[.)])\s+/;

function isBlank(line: string): boolean {
  return line.trim() === '';
}

function isRule(line: string): boolean {
  return /^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line);
}

function isQuote(line: string): boolean {
  return /^\s{0,3}>/.test(line);
}

function isFence(line: string): boolean {
  return line.trim().startsWith('```');
}

function listKind(line: string): 'ul' | 'ol' | undefined {
  if (isRule(line)) return undefined;
  if (/^\s*[-*+]\s+/.test(line)) return 'ul';
  if (/^\s*\d+[.)]\s+/.test(line)) return 'ol';
  return undefined;
}

function startsBlock(line: string): boolean {
  return isFence(line) || /^\s{0,3}#{1,6}\s+/.test(line) || isRule(line) || isQuote(line) || listKind(line) !== undefined;
}

export function parseMarkdown(source: string): MdBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: MdBlock[] = [];
  let at = 0;
  while (at < lines.length) {
    const line = lines[at]!;
    if (isBlank(line)) {
      at += 1;
      continue;
    }
    if (isFence(line)) {
      const code: string[] = [];
      at += 1;
      while (at < lines.length && !isFence(lines[at]!)) code.push(lines[at++]!);
      at += 1;
      blocks.push({ t: 'pre', text: code.join('\n') });
      continue;
    }
    const heading = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/.exec(line);
    if (heading) {
      blocks.push({ t: 'heading', level: Math.min(heading[1]!.length + 2, 5) as 3 | 4 | 5, children: parseInline(heading[2]!) });
      at += 1;
      continue;
    }
    if (isRule(line)) {
      blocks.push({ t: 'hr' });
      at += 1;
      continue;
    }
    if (isQuote(line)) {
      const quoted: string[] = [];
      while (at < lines.length && isQuote(lines[at]!)) quoted.push(lines[at++]!.replace(/^\s{0,3}>\s?/, ''));
      blocks.push({ t: 'quote', children: parseMarkdown(quoted.join('\n')) });
      continue;
    }
    const kind = listKind(line);
    if (kind !== undefined) {
      const items: MdInline[][] = [];
      while (at < lines.length && listKind(lines[at]!) === kind) items.push(parseInline(lines[at++]!.replace(LIST_MARK, '')));
      blocks.push({ t: 'list', ordered: kind === 'ol', items });
      continue;
    }
    const paragraph: string[] = [];
    while (at < lines.length && !isBlank(lines[at]!) && (paragraph.length === 0 || !startsBlock(lines[at]!))) paragraph.push(lines[at++]!);
    const children: MdInline[] = [];
    paragraph.forEach((text, index) => {
      if (index > 0) children.push({ t: 'br' });
      children.push(...parseInline(text));
    });
    blocks.push({ t: 'p', children });
  }
  return blocks;
}

// Code, link, bold, italic; the first that starts earliest wins. Underscores only count at word edges (snake_case stays text).
const TOKEN = new RegExp(
  [
    '`([^`\\n]+)`',
    '\\[([^\\]\\n]+)\\]\\((https?:\\/\\/[^)\\s]+)\\)',
    '\\*\\*(?!\\s)(.+?)(?<!\\s)\\*\\*',
    '(?<!\\w)__(?!\\s)(.+?)(?<!\\s)__(?!\\w)',
    '\\*(?!\\s)(.+?)(?<!\\s)\\*',
    '(?<!\\w)_(?!\\s)(.+?)(?<!\\s)_(?!\\w)',
  ].join('|'),
  'gi',
);

export function parseInline(text: string): MdInline[] {
  const nodes: MdInline[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push({ t: 'text', text: text.slice(last, start) });
    const [, code, label, href, bold, boldUnderscore, italic, italicUnderscore] = match;
    if (code !== undefined) nodes.push({ t: 'code', text: code });
    else if (label !== undefined && href !== undefined) nodes.push({ t: 'link', href, children: parseInline(label) });
    else if (bold !== undefined || boldUnderscore !== undefined) nodes.push({ t: 'strong', children: parseInline((bold ?? boldUnderscore)!) });
    else nodes.push({ t: 'em', children: parseInline((italic ?? italicUnderscore)!) });
    last = start + match[0].length;
  }
  if (last < text.length) nodes.push({ t: 'text', text: text.slice(last) });
  return nodes;
}
