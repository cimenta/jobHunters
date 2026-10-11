import { describe, expect, it } from 'vitest';
import { renderPrompt } from './prompt';

describe('renderPrompt', () => {
  it('replaces known placeholders, keeps unknown ones and drops lines that came out empty', () => {
    expect(renderPrompt('A {{ x }} {{y}}\n{{empty}}\n\nB {{missing}}', { x: '1', y: '2', empty: '' })).toBe('A 1 2\n\nB {{missing}}');
  });
});
