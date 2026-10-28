/**
 * The mark in the upper left of a mail in the list: one per kind of mail, each with an icon and a color the user can change
 * in Settings. The choice is remembered with the other interface settings (ui_state.email_marks).
 */
export const EMAIL_MARK_KEYS = ['new', 'confirmation', 'meeting', 'after_meeting', 'message', 'homework', 'rejection', 'offer', 'ignored'] as const;
export type EmailMarkKey = (typeof EMAIL_MARK_KEYS)[number];

/** The icons the user may choose from (names of the icons of the interface). */
export const EMAIL_MARK_ICONS = [
  'bell', 'check', 'calendar', 'chat', 'mail', 'task', 'reject', 'sparkle', 'eye-off', 'flag', 'clock', 'video', 'phone', 'file',
  'alert', 'archive', 'ban', 'ghost', 'briefcase', 'building', 'folder', 'wand',
] as const;
export type EmailMarkIcon = (typeof EMAIL_MARK_ICONS)[number];

export const DEFAULT_EMAIL_MARK_ICONS: Readonly<Record<EmailMarkKey, EmailMarkIcon>> = {
  new: 'bell',
  confirmation: 'check',
  meeting: 'calendar',
  after_meeting: 'chat',
  message: 'mail',
  homework: 'task',
  rejection: 'reject',
  offer: 'sparkle',
  ignored: 'eye-off',
};

/** An empty icon or color means "the default". */
export interface EmailMarkChoice {
  icon: string;
  color: string;
}

export type EmailMarks = Partial<Record<EmailMarkKey, EmailMarkChoice>>;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isEmailMarkKey(key: string): key is EmailMarkKey {
  return (EMAIL_MARK_KEYS as readonly string[]).includes(key);
}

/** Wrongly shaped values make the whole choice invalid; unknown keys are dropped; a choice with nothing set is dropped. */
export function parseEmailMarks(value: unknown): EmailMarks | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const out: EmailMarks = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!isEmailMarkKey(key)) continue;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
    const { icon = '', color = '' } = raw as Record<string, unknown>;
    if (typeof icon !== 'string' || typeof color !== 'string') return undefined;
    if (icon !== '' && !(EMAIL_MARK_ICONS as readonly string[]).includes(icon)) return undefined;
    if (color !== '' && !HEX_COLOR.test(color)) return undefined;
    if (icon !== '' || color !== '') out[key] = { icon, color: color.toLowerCase() };
  }
  return out;
}

/** The icon and the color of a mark: the user's choice, else the default icon and no color (the theme's). */
export function resolveEmailMark(marks: EmailMarks | undefined, key: EmailMarkKey): { icon: EmailMarkIcon; color: string } {
  const choice = marks?.[key];
  const icon = (EMAIL_MARK_ICONS as readonly string[]).includes(choice?.icon ?? '') ? (choice!.icon as EmailMarkIcon) : DEFAULT_EMAIL_MARK_ICONS[key];
  return { icon, color: choice?.color ?? '' };
}
