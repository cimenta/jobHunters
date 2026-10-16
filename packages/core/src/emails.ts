import { foldDiacritics } from './jobs/html';
import type { Email } from './types';

/** What the list of e-mails shows: no body (it can be long and the list is read often), but a short excerpt to search in. */
export type EmailRow = Omit<Email, 'body'> & {
  /** Who the e-mail is with: the sender of an incoming one, the first recipient of an outgoing one. */
  counterpart: string;
  /** The names of the attachments. */
  attachment_list: string[];
  /** The first characters of the body on one line. */
  excerpt: string;
};

export const EMAIL_EXCERPT_LENGTH = 300;

/** The name of the first address in a header such as `Jana <jana@example.com>, bob@example.com`, else the bare address, else the text itself. */
export function firstAddressLabel(header: string): string {
  const first = header.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)[0]?.trim() ?? '';
  const named = /^"?([^"<]*?)"?\s*<([^>]*)>$/.exec(first);
  if (named) return (named[1] ?? '').trim() || (named[2] ?? '').trim();
  return first;
}

export function emailRow(email: Email): EmailRow {
  const { body, ...rest } = email;
  const incoming = email.direction !== 'outgoing';
  return {
    ...rest,
    counterpart: incoming ? email.from_name.trim() || email.from_email.trim() : firstAddressLabel(email.to),
    attachment_list: email.attachments.split('|').map((name) => name.trim()).filter((name) => name !== ''),
    excerpt: body.replace(/\s+/g, ' ').trim().slice(0, EMAIL_EXCERPT_LENGTH),
  };
}

function time(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Newest first; a row without a readable date comes last. */
export function emailRows(emails: readonly Email[]): EmailRow[] {
  return emails.map(emailRow).sort((a, b) => time(b.received_at) - time(a.received_at));
}

/** The text a search box looks in, folded so case and diacritics do not matter. */
export function emailSearchText(row: EmailRow): string {
  return foldDiacritics([row.counterpart, row.from_email, row.to, row.subject, row.attachments, row.excerpt].join(' ')).toLowerCase();
}
