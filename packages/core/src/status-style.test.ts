import { describe, expect, it } from 'vitest';
import { APPLICATION_STATUSES } from './status';
import {
  DEFAULT_STATUS_COLORS, parseStatusStyles, readableTextColor, resolveStatusStyle, serializeStatusStyles, STATUS_TEXT_MAX,
  UNKNOWN_STATUS_COLOR,
} from './status-style';

describe('parseStatusStyles', () => {
  it('accepts an empty value and valid styles', () => {
    expect(parseStatusStyles('')).toEqual({});
    expect(parseStatusStyles('{}')).toEqual({});
    expect(parseStatusStyles('{"sent":{"text":{"cs":" Podáno ","en":"Applied"},"color":"#2563EB"},"offer":{"color":"#00aa00"}}')).toEqual({
      sent: { text: { cs: 'Podáno', en: 'Applied' }, color: '#2563eb' },
      offer: { color: '#00aa00' },
    });
  });

  it.each([
    'not json',
    '[]',
    '"sent"',
    '{"flying":{"color":"#000000"}}',
    '{"sent":"blue"}',
    '{"sent":{"color":"blue"}}',
    '{"sent":{"color":"#abc"}}',
    '{"sent":{"color":5}}',
    '{"sent":{"text":"Applied"}}',
    '{"sent":{"text":{"de":"Gesendet"}}}',
    '{"sent":{"text":{"en":""}}}',
    '{"sent":{"text":{"en":"   "}}}',
    `{"sent":{"text":{"en":"${'x'.repeat(STATUS_TEXT_MAX + 1)}"}}}`,
    '{"__proto__":{"color":"#000000"}}',
  ])('rejects %s', (raw) => {
    expect(parseStatusStyles(raw)).toBeUndefined();
  });

  it('round-trips through serializeStatusStyles', () => {
    const styles = { waiting: { text: { en: 'On hold' }, color: '#b45309' } };
    expect(parseStatusStyles(serializeStatusStyles(styles))).toEqual(styles);
  });
});

describe('readableTextColor', () => {
  it('picks white on dark and dark on light backgrounds', () => {
    expect(readableTextColor('#000000')).toBe('#ffffff');
    expect(readableTextColor('#ffffff')).toBe('#111111');
    expect(readableTextColor('#2563eb')).toBe('#ffffff');
    expect(readableTextColor('#fde68a')).toBe('#111111');
    expect(readableTextColor('#808080')).toBe('#111111');
  });
  it('falls back to white for a value that is not a colour', () => {
    expect(readableTextColor('blue')).toBe('#ffffff');
  });
  it('reaches at least 4.5:1 for every default status colour', () => {
    const luminance = (hex: string): number => {
      const channel = (i: number): number => {
        const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
    };
    for (const color of Object.values(DEFAULT_STATUS_COLORS)) {
      const text = readableTextColor(color);
      const a = luminance(color);
      const b = luminance(text);
      expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), color).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('resolveStatusStyle', () => {
  it('uses the catalog text and default colour when nothing is customised', () => {
    expect(resolveStatusStyle({}, 'sent', 'en')).toEqual({ text: 'Sent', color: DEFAULT_STATUS_COLORS.sent, textColor: readableTextColor(DEFAULT_STATUS_COLORS.sent) });
    expect(resolveStatusStyle({}, 'sent', 'cs').text).toBe('Odesláno');
  });
  it('prefers the custom text of the current language and the custom colour', () => {
    const styles = { sent: { text: { cs: 'Podáno' }, color: '#fde68a' } };
    expect(resolveStatusStyle(styles, 'sent', 'cs')).toEqual({ text: 'Podáno', color: '#fde68a', textColor: '#111111' });
    expect(resolveStatusStyle(styles, 'sent', 'en').text).toBe('Sent');
  });
  it('still renders a status that is not in the list', () => {
    expect(resolveStatusStyle({}, 'weird', 'en')).toMatchObject({ text: 'weird', color: UNKNOWN_STATUS_COLOR });
    expect(resolveStatusStyle({}, '', 'en').text).toBe('?');
    expect(resolveStatusStyle({}, 'x'.repeat(100), 'en').text).toHaveLength(STATUS_TEXT_MAX);
  });
  it('has a default colour for every status', () => {
    expect(Object.keys(DEFAULT_STATUS_COLORS).sort()).toEqual([...APPLICATION_STATUSES].sort());
  });
});
