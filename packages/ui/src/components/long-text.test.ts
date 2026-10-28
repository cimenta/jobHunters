import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { eventHoverText, HOVER_DETAILS_MAX } from '../lib/timeline';
import LongText from './LongText.svelte';

const ui = (name: string) => document.querySelector(`[data-ui="${name}"]`) as HTMLElement | null;

describe('LongText', () => {
  it('shows a short text as it is, with its line breaks and no button', () => {
    render(LongText, { text: 'one\ntwo', ui: 'lt' });
    expect(ui('lt.text')).toHaveTextContent('one two');
    expect(ui('lt.text')!.textContent).toBe('one\ntwo');
    expect(ui('lt.toggle')).toBeNull();
    expect(ui('lt.text')!.classList.contains('folded')).toBe(false);
  });

  it('folds a text that is long or has many lines, and unfolds it with the button', async () => {
    render(LongText, { text: 'x'.repeat(700), ui: 'lt' });
    expect(ui('lt.text')!.classList.contains('folded')).toBe(true);
    expect(ui('lt.toggle')).toHaveTextContent('Show more');
    await fireEvent.click(ui('lt.toggle')!);
    expect(ui('lt.text')!.classList.contains('folded')).toBe(false);
    expect(ui('lt.toggle')).toHaveTextContent('Show less');
    expect(ui('lt.toggle')).toHaveAttribute('aria-expanded', 'true');
  });

  it('folds a text of many short lines', () => {
    render(LongText, { text: Array.from({ length: 12 }, (_, i) => `line ${i}`).join('\n'), ui: 'lt' });
    expect(ui('lt.toggle')).not.toBeNull();
  });
});

describe('hover text of an entry with the text of a mail', () => {
  it('cuts long details with an ellipsis and keeps short ones whole', () => {
    const long = eventHoverText({ at: 'x', type: 'message', ref: 'm', data: { summary: 'S', details: 'y'.repeat(HOVER_DETAILS_MAX + 50) } })!;
    expect(long.details.length).toBe(HOVER_DETAILS_MAX + 1);
    expect(long.details.endsWith('…')).toBe(true);
    expect(eventHoverText({ at: 'x', type: 'message', ref: 'm', data: { summary: 'S', details: 'short' } })!.details).toBe('short');
  });
});
