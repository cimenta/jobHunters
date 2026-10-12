import {
  APPLICATION_STATUSES, DEFAULT_STATUS_CHECK, DEFAULT_STATUS_COLORS, type ApplicationStatus, type Locale, type StatusStyle, type StatusStyles,
} from '@jobhunters/core';

export interface StatusEdit {
  /** Custom text for the current language, or '' for the default. */
  text: string;
  /** #rrggbb */
  color: string;
  /** Whether jobs with an application in this status get their availability checked. */
  check: boolean;
}

export function initialEdits(styles: StatusStyles, locale: Locale): Record<ApplicationStatus, StatusEdit> {
  const edits = {} as Record<ApplicationStatus, StatusEdit>;
  for (const status of APPLICATION_STATUSES) {
    edits[status] = { text: styles[status]?.text?.[locale] ?? '', color: styles[status]?.color ?? DEFAULT_STATUS_COLORS[status], check: styles[status]?.check ?? DEFAULT_STATUS_CHECK[status] };
  }
  return edits;
}

/** The value to store: only differences from the defaults; the other language's texts are kept. */
export function buildStatusStyles(existing: StatusStyles, edits: Record<ApplicationStatus, StatusEdit>, locale: Locale): StatusStyles {
  const result: StatusStyles = {};
  for (const status of APPLICATION_STATUSES) {
    const edit = edits[status];
    const texts = { ...(existing[status]?.text ?? {}) };
    delete texts[locale];
    const text = edit.text.trim();
    if (text !== '') texts[locale] = text;
    const style: StatusStyle = {};
    if (Object.keys(texts).length > 0) style.text = texts;
    const color = edit.color.toLowerCase();
    if (color !== DEFAULT_STATUS_COLORS[status]) style.color = color;
    if (edit.check !== DEFAULT_STATUS_CHECK[status]) style.check = edit.check;
    if (style.text !== undefined || style.color !== undefined || style.check !== undefined) result[status] = style;
  }
  return result;
}
