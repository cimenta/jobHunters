import { describe, expect, it } from 'vitest';
import { DEFAULT_EMAIL_MARK_ICONS, EMAIL_MARK_KEYS, parseEmailMarks, resolveEmailMark } from './email-marks';
import { emailMarkKey } from './email-service';
import { parseUiState } from './ui-state';

describe('email marks', () => {
  it('keeps the choices, drops unknown keys and empty choices, lower-cases the color', () => {
    expect(parseEmailMarks({ meeting: { icon: 'flag', color: '#AABBCC' }, nope: { icon: 'flag' }, message: {}, homework: { icon: '', color: '' } })).toEqual({ meeting: { icon: 'flag', color: '#aabbcc' } });
    expect(parseEmailMarks({})).toEqual({});
  });

  it('refuses wrong shapes, an unknown icon and a color that is not #rrggbb', () => {
    expect(parseEmailMarks([])).toBeUndefined();
    expect(parseEmailMarks({ meeting: 'x' })).toBeUndefined();
    expect(parseEmailMarks({ meeting: { icon: 'not-an-icon' } })).toBeUndefined();
    expect(parseEmailMarks({ meeting: { color: 'red' } })).toBeUndefined();
    expect(parseEmailMarks({ meeting: { icon: 5 } })).toBeUndefined();
  });

  it('resolves to the choice, else to the default icon and no color', () => {
    expect(resolveEmailMark({ meeting: { icon: 'video', color: '#112233' } }, 'meeting')).toEqual({ icon: 'video', color: '#112233' });
    expect(resolveEmailMark({ meeting: { icon: '', color: '#112233' } }, 'meeting')).toEqual({ icon: DEFAULT_EMAIL_MARK_ICONS.meeting, color: '#112233' });
    expect(resolveEmailMark(undefined, 'offer')).toEqual({ icon: 'sparkle', color: '' });
    expect(resolveEmailMark({ offer: { icon: 'gone', color: '' } }, 'offer').icon).toBe('sparkle');
  });

  it('is part of the interface settings', () => {
    expect(parseUiState('{}')?.email_marks).toEqual({});
    expect(parseUiState('{"email_marks":{"meeting":{"icon":"video","color":"#112233"}}}')?.email_marks).toEqual({ meeting: { icon: 'video', color: '#112233' } });
    expect(parseUiState('{"email_marks":{"meeting":{"icon":"zzz"}}}')).toBeUndefined();
  });

  it('names the mark of a mail', () => {
    const stored = (kind: string) => JSON.stringify({ rule: 'r', kind });
    expect(emailMarkKey({ state: '', type: '', signals: '' })).toBe('new');
    expect(emailMarkKey({ state: 'suggested', type: 'rejection', signals: stored('message') })).toBe('rejection');
    expect(emailMarkKey({ state: 'confirmed', type: 'rejection', signals: stored('after_meeting') })).toBe('after_meeting');
    expect(emailMarkKey({ state: 'suggested', type: 'confirmation', signals: '' })).toBe('message');
    expect(emailMarkKey({ state: 'ignored', type: 'x', signals: '' })).toBe('ignored');
    for (const key of EMAIL_MARK_KEYS) expect(typeof key).toBe('string');
  });
});
