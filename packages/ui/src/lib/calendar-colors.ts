import { CALENDAR_COLOR_KEYS, type CalendarColors } from '@jobhunters/core';

/** What the pickers in Settings start from when no color was chosen: the light-theme colors of the Calendar. */
export const DEFAULT_CALENDAR_COLORS: Readonly<CalendarColors> = { interview: '#d9f1ee', waiting: '#fef3c7', late: '#fee2e2', homework: '#ede4fb' };

/** Black or white, whichever reads better on the given #rrggbb background. */
export function inkFor(background: string): string {
  const value = parseInt(background.slice(1), 16);
  const brightness = (0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255));
  return brightness > 150 ? '#18202a' : '#ffffff';
}

/** CSS variables for the chosen colors only; an unset color leaves the theme's own color in place. */
export function calendarColorStyle(colors: CalendarColors): string {
  return CALENDAR_COLOR_KEYS.filter((key) => colors[key] !== '')
    .map((key) => `--cal-${key}: ${colors[key]}; --cal-${key}-ink: ${inkFor(colors[key])}`)
    .join('; ');
}
