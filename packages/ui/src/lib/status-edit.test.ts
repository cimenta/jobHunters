import { DEFAULT_STATUS_COLORS } from '@jobhunters/core';
import { describe, expect, it } from 'vitest';
import { buildStatusStyles, initialEdits } from './status-edit';

describe('initialEdits', () => {
  it('starts from the defaults when nothing is customised', () => {
    const edits = initialEdits({}, 'en');
    expect(edits.sent).toEqual({ text: '', color: DEFAULT_STATUS_COLORS.sent, check: true });
    expect(edits.offer.check).toBe(false);
    expect(Object.keys(edits)).toHaveLength(9);
  });
  it('shows the customisation of the current language only', () => {
    const styles = { sent: { text: { en: 'Applied', cs: 'Podáno' }, color: '#fde68a' } };
    expect(initialEdits(styles, 'cs').sent).toEqual({ text: 'Podáno', color: '#fde68a', check: true });
    expect(initialEdits(styles, 'en').sent.text).toBe('Applied');
  });
});

describe('buildStatusStyles', () => {
  it('stores only what differs from the defaults', () => {
    const edits = initialEdits({}, 'en');
    expect(buildStatusStyles({}, edits, 'en')).toEqual({});
    edits.sent = { text: ' Applied ', color: '#FDE68A', check: true };
    edits.offer = { text: '', color: '#00aa00', check: false };
    expect(buildStatusStyles({}, edits, 'en')).toEqual({
      sent: { text: { en: 'Applied' }, color: '#fde68a' },
      offer: { color: '#00aa00' },
    });
  });
  it('keeps the texts of the other language', () => {
    const existing = { sent: { text: { cs: 'Podáno' }, color: '#fde68a' } };
    const edits = initialEdits(existing, 'en');
    edits.sent = { text: 'Applied', color: '#fde68a', check: true };
    expect(buildStatusStyles(existing, edits, 'en')).toEqual({ sent: { text: { cs: 'Podáno', en: 'Applied' }, color: '#fde68a' } });
  });
  it('removes the text of this language when the field is emptied, and the whole entry when nothing is left', () => {
    const existing = { sent: { text: { en: 'Applied' } } };
    const edits = initialEdits(existing, 'en');
    edits.sent = { text: '', color: DEFAULT_STATUS_COLORS.sent, check: true };
    expect(buildStatusStyles(existing, edits, 'en')).toEqual({});
  });
  it('never invents entries for untouched statuses', () => {
    const edits = initialEdits({}, 'en');
    expect(buildStatusStyles({}, edits, 'cs')).toEqual({});
  });
  it('stores the availability flag only when it differs from the default of the status', () => {
    const edits = initialEdits({}, 'en');
    edits.sent.check = false;
    edits.offer.check = true;
    expect(buildStatusStyles({}, edits, 'en')).toEqual({ sent: { check: false }, offer: { check: true } });
    expect(initialEdits({ sent: { check: false } }, 'en').sent.check).toBe(false);
  });
});
