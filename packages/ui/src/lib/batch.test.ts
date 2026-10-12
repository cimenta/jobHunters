import { describe, expect, it } from 'vitest';
import { parseLinks } from './batch';

describe('parseLinks', () => {
  it('takes one link per line, trims, ignores empty lines', () => {
    const result = parseLinks('  https://a.example/1  \n\n\nhttp://b.example/2\n');
    expect(result.links).toEqual(['https://a.example/1', 'http://b.example/2']);
    expect(result.skipped).toEqual([]);
    expect(result.tooMany).toBe(false);
  });

  it('marks lines that are not http(s) links as invalid and keeps the order of the rest', () => {
    const result = parseLinks('https://a.example/1\nnot a link\nftp://x.example/f\nhttps://b.example/2');
    expect(result.links).toEqual(['https://a.example/1', 'https://b.example/2']);
    expect(result.skipped).toEqual([
      { line: 'not a link', reason: 'invalid' },
      { line: 'ftp://x.example/f', reason: 'invalid' },
    ]);
  });

  it('drops a repeated link as duplicate', () => {
    const result = parseLinks('https://a.example/1\nHTTPS://A.example/1\nhttps://b.example/2');
    expect(result.links).toEqual(['https://a.example/1', 'https://b.example/2']);
    expect(result.skipped).toEqual([{ line: 'HTTPS://A.example/1', reason: 'duplicate' }]);
  });

  it('flags more than 30 links and keeps only the first 30', () => {
    const text = Array.from({ length: 32 }, (_, i) => `https://a.example/${i}`).join('\n');
    const result = parseLinks(text);
    expect(result.links).toHaveLength(30);
    expect(result.links[29]).toBe('https://a.example/29');
    expect(result.tooMany).toBe(true);
  });
});
