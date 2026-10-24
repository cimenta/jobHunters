import { describe, expect, it } from 'vitest';
import { calendarColorStyle, inkFor } from './calendar-colors';

describe('inkFor', () => {
  it('chooses dark text on a light background and white text on a dark one', () => {
    expect(inkFor('#fef3c7')).toBe('#18202a');
    expect(inkFor('#ffffff')).toBe('#18202a');
    expect(inkFor('#000000')).toBe('#ffffff');
    expect(inkFor('#1b4f9c')).toBe('#ffffff');
  });
});

describe('calendarColorStyle', () => {
  it('sets the variables of the chosen colors only', () => {
    expect(calendarColorStyle({ interview: '', waiting: '', late: '', homework: '' })).toBe('');
    expect(calendarColorStyle({ interview: '#000000', waiting: '', late: '#ffffff', homework: '' })).toBe(
      '--cal-interview: #000000; --cal-interview-ink: #ffffff; --cal-late: #ffffff; --cal-late-ink: #18202a',
    );
  });
});
