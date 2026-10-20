import { describe, expect, it } from 'vitest';
import { applyMarkdownTool } from './markdown-edit';

const pick = (edit: { value: string; start: number; end: number }) => [edit.value, edit.value.slice(edit.start, edit.end)];

describe('applyMarkdownTool', () => {
  it('wraps the selection in bold or italic marks and keeps it selected', () => {
    expect(pick(applyMarkdownTool('say hello now', 4, 9, 'bold', 'text'))).toEqual(['say **hello** now', 'hello']);
    expect(pick(applyMarkdownTool('say hello now', 4, 9, 'italic', 'text'))).toEqual(['say *hello* now', 'hello']);
  });

  it('inserts the marks around a placeholder when nothing is selected', () => {
    expect(pick(applyMarkdownTool('ab', 1, 1, 'bold', 'text'))).toEqual(['a**text**b', 'text']);
  });

  it('wraps a single line of code in backticks and several lines in a fence', () => {
    expect(pick(applyMarkdownTool('run npm test', 4, 12, 'code', 'code'))).toEqual(['run `npm test`', 'npm test']);
    expect(pick(applyMarkdownTool('a\nb', 0, 3, 'code', 'code'))).toEqual(['```\na\nb\n```', 'a\nb']);
  });

  it('makes a link and selects the address to type over', () => {
    expect(pick(applyMarkdownTool('see site here', 4, 8, 'link', 'text'))).toEqual(['see [site](https://) here', 'https://']);
    expect(pick(applyMarkdownTool('x', 1, 1, 'link', 'text'))).toEqual(['x[text](https://)', 'https://']);
  });

  it('turns the lines of the selection into a heading and takes it off again', () => {
    expect(pick(applyMarkdownTool('one\ntwo\nthree', 5, 6, 'heading', 'text'))).toEqual(['one\n## two\nthree', '## two']);
    expect(applyMarkdownTool('one\n## two\nthree', 6, 6, 'heading', 'text').value).toBe('one\ntwo\nthree');
    expect(applyMarkdownTool('### three', 0, 0, 'heading', 'text').value).toBe('## three');
  });

  it('prefixes every selected line of a list and takes the marks off when all have them', () => {
    expect(pick(applyMarkdownTool('a\nb\nc', 0, 3, 'list', 'text'))).toEqual(['- a\n- b\nc', '- a\n- b']);
    expect(applyMarkdownTool('- a\n- b\nc', 0, 7, 'list', 'text').value).toBe('a\nb\nc');
    expect(applyMarkdownTool('- a\nb', 0, 5, 'list', 'text').value).toBe('- a\n- b');
  });

  it('works on the first line and on an empty text', () => {
    expect(applyMarkdownTool('', 0, 0, 'list', 'text').value).toBe('- ');
    expect(applyMarkdownTool('\nb', 0, 0, 'heading', 'text').value).toBe('## \nb');
  });
});
