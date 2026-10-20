import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown, type MdBlock, type MdInline } from './markdown';

const parse = (...lines: string[]) => parseMarkdown(lines.join('\n'));
const text = (value: string): MdInline => ({ t: 'text', text: value });

/** Every piece of text in the tree, to prove nothing the user typed is lost or changed. */
function allText(blocks: readonly MdBlock[]): string {
  const inline = (nodes: readonly MdInline[]): string => nodes.map((node) => (node.t === 'text' || node.t === 'code' ? node.text : node.t === 'br' ? '\n' : inline(node.children))).join('');
  return blocks
    .map((block) => {
      switch (block.t) {
        case 'heading':
        case 'p':
          return inline(block.children);
        case 'list':
          return block.items.map(inline).join('\n');
        case 'quote':
          return allText(block.children);
        case 'pre':
          return block.text;
        case 'hr':
          return '';
      }
    })
    .join('\n');
}

describe('parseMarkdown blocks', () => {
  it('makes headings one level smaller than the page and caps them, and keeps a trailing # of the text', () => {
    expect(parse('# One', '## Two', '### Three', '###### Six').map((b) => (b.t === 'heading' ? b.level : 0))).toEqual([3, 4, 5, 5]);
    expect(parse('# Learn C#')).toEqual([{ t: 'heading', level: 3, children: [text('Learn C#')] }]);
    expect(parse('## Closed ##')).toEqual([{ t: 'heading', level: 4, children: [text('Closed')] }]);
    expect(parse('#NoSpace')).toEqual([{ t: 'p', children: [text('#NoSpace')] }]);
  });

  it('makes paragraphs of blank-line separated text and keeps a single line break', () => {
    expect(parse('first line', 'second line', '', 'next paragraph')).toEqual([
      { t: 'p', children: [text('first line'), { t: 'br' }, text('second line')] },
      { t: 'p', children: [text('next paragraph')] },
    ]);
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown('   \n\n  ')).toEqual([]);
  });

  it('makes bullet and numbered lists, and a list ends a paragraph', () => {
    expect(parse('- a', '* b', '+ c')).toEqual([{ t: 'list', ordered: false, items: [[text('a')], [text('b')], [text('c')]] }]);
    expect(parse('1. one', '2) two')).toEqual([{ t: 'list', ordered: true, items: [[text('one')], [text('two')]] }]);
    expect(parse('Text', '- item').map((b) => b.t)).toEqual(['p', 'list']);
    expect(parse('- a', '1. b').map((b) => (b.t === 'list' ? b.ordered : null))).toEqual([false, true]);
  });

  it('makes quotes (with their own formatting), rules and fenced code', () => {
    expect(parse('> Ask about **goals**', '> and budget')).toEqual([
      { t: 'quote', children: [{ t: 'p', children: [text('Ask about '), { t: 'strong', children: [text('goals')] }, { t: 'br' }, text('and budget')] }] },
    ]);
    expect(parse('---')).toEqual([{ t: 'hr' }]);
    expect(parse('* * *')).toEqual([{ t: 'hr' }]);
    expect(parse('```', 'const a = "<b>";', '**not bold**', '```')).toEqual([{ t: 'pre', text: 'const a = "<b>";\n**not bold**' }]);
    expect(parse('```', 'never closed')).toEqual([{ t: 'pre', text: 'never closed' }]);
  });
});

describe('parseInline', () => {
  it('makes bold, italic and code, and leaves snake_case and spaced stars alone', () => {
    expect(parseInline('**bold** and __bold__ and *it* and _it_')).toEqual([
      { t: 'strong', children: [text('bold')] }, text(' and '), { t: 'strong', children: [text('bold')] }, text(' and '),
      { t: 'em', children: [text('it')] }, text(' and '), { t: 'em', children: [text('it')] },
    ]);
    expect(parseInline('use `a < b` here')).toEqual([text('use '), { t: 'code', text: 'a < b' }, text(' here')]);
    expect(parseInline('snake_case_name and 2 * 3 * 4')).toEqual([text('snake_case_name and 2 * 3 * 4')]);
    expect(parseInline('`**no** emphasis`')).toEqual([{ t: 'code', text: '**no** emphasis' }]);
  });

  it('keeps a link only for http and https and formats its text', () => {
    expect(parseInline('[site **now**](https://example.com/a?b=1&c=2)')).toEqual([
      { t: 'link', href: 'https://example.com/a?b=1&c=2', children: [text('site '), { t: 'strong', children: [text('now')] }] },
    ]);
    expect(parseInline('[x](http://example.com)')).toEqual([{ t: 'link', href: 'http://example.com', children: [text('x')] }]);
    for (const bad of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', 'vbscript:x', '//example.com', 'mailto:a@example.com']) {
      expect(parseInline(`[x](${bad})`).some((node) => node.t === 'link'), bad).toBe(false);
    }
  });
});

describe('parseMarkdown keeps what was typed', () => {
  it('leaves raw HTML as plain text, byte for byte', () => {
    const typed = '<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n<b onclick="x">hi</b>';
    expect(allText(parseMarkdown(typed))).toBe(typed);
  });

  it('has no node that carries markup: only text, code, links with a web address, and structure', () => {
    const tree = JSON.stringify(parseMarkdown('[a](https://example.com/"onmouseover="alert(1)) [b](javascript:alert(1)) <i>x</i>'));
    expect(tree).not.toMatch(/"href":"(?!https?:\/\/)/);
    expect(parseInline('[a](https://example.com/**x**)')).toEqual([{ t: 'link', href: 'https://example.com/**x**', children: [text('a')] }]);
  });

  it('handles a long text quickly', () => {
    const long = Array.from({ length: 2000 }, (_, index) => `- item ${index} with **bold** and [link](https://example.com/${index})`).join('\n');
    const started = Date.now();
    const blocks = parseMarkdown(long);
    expect(blocks[0]).toMatchObject({ t: 'list' });
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
