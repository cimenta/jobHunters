import { foldDiacritics } from './jobs/html';
import type { Email } from './types';

/** The fields of a mail that a forwarded copy hides: who wrote it, to whom, when, and what. */
export type ForwardedFields = Pick<Email, 'from_email' | 'from_name' | 'to' | 'cc' | 'received_at' | 'subject' | 'body' | 'direction'>;

type ForwardInput = Pick<Email, 'from_email' | 'to' | 'cc' | 'received_at' | 'subject' | 'body' | 'direction'>;

/** A forwarded mail starts "Fwd:", "FW:" or the like; a mail that merely quotes another one does not. */
const FORWARD_SUBJECT = /^\s*(?:fwd?|pd|tr|wg|vs|doorst)\s*:/i;

/** The line that opens the copied header: "---------- Původní e‑mail ----------", "---------- Forwarded message ---------", "Begin forwarded message:", "-----Original Message-----" or a line of underscores. */
const FORWARD_MARKER = /^[ \t]*(?:[-‐-―_=]{2,}[ \t]*(?:puvodni (?:e.?mail|zprava)|preposlana zprava|forwarded message|original message|forwarded mail)[ \t]*[-‐-―_=]{2,}|begin forwarded message:?|_{8,})[ \t]*$/im;

/** How far into the body the marker may sit; a note of the person who forwards comes before it. */
const MARKER_WITHIN = 400;

const HEADER_KEYS: Record<string, 'from' | 'to' | 'cc' | 'date' | 'subject'> = {
  from: 'from', od: 'from',
  to: 'to', komu: 'to',
  cc: 'cc', kopie: 'cc',
  date: 'date', datum: 'date', sent: 'date', odeslano: 'date', odeslane: 'date',
  subject: 'subject', predmet: 'subject', vec: 'subject',
};

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, ledna: 1, leden: 1, feb: 2, february: 2, unora: 2, unor: 2, mar: 3, march: 3, brezna: 3, brezen: 3,
  apr: 4, april: 4, dubna: 4, duben: 4, may: 5, kvetna: 5, kveten: 5, jun: 6, june: 6, cervna: 6, cerven: 6,
  jul: 7, july: 7, cervence: 7, cervenec: 7, aug: 8, august: 8, srpna: 8, srpen: 8, sep: 9, sept: 9, september: 9, zari: 9,
  oct: 10, october: 10, rijna: 10, rijen: 10, nov: 11, november: 11, listopadu: 11, listopad: 11, dec: 12, december: 12, prosince: 12, prosinec: 12,
};

/** Minutes east of UTC that the zone of the script has at an instant (milliseconds since the epoch). */
export type OffsetAt = (instant: number) => number;

interface LocalTime { year: number; month: number; day: number; hour: number; minute: number; second: number; offsetMinutes: number | undefined }

/** Reads the date of a copied header: "3. 11. 2026 2:56:39", "po 2. 11. 2026 v 15:00", "Mon, Nov 2, 2026 at 3:00 PM", "Mon, 2 Nov 2026 15:00:00 +0100", "2026-11-02 15:00". */
function readDate(value: string): LocalTime | undefined {
  const text = foldDiacritics(value).toLowerCase();
  const time = /(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(am|pm))?/.exec(text);
  let day: number;
  let month: number;
  let year: number;
  const numeric = /(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})/.exec(text);
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(text);
  const dayFirst = /(\d{1,2})\.?\s+([a-z]{3,})\.?,?\s+(\d{4})/.exec(text);
  const monthFirst = /([a-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(text);
  if (numeric) [day, month, year] = [Number(numeric[1]), Number(numeric[2]), Number(numeric[3])] as [number, number, number];
  else if (iso) [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])] as [number, number, number];
  else if (dayFirst && MONTHS[dayFirst[2]!] !== undefined) [day, month, year] = [Number(dayFirst[1]), MONTHS[dayFirst[2]!]!, Number(dayFirst[3])] as [number, number, number];
  else if (monthFirst && MONTHS[monthFirst[1]!] !== undefined) [day, month, year] = [Number(monthFirst[2]), MONTHS[monthFirst[1]!]!, Number(monthFirst[3])] as [number, number, number];
  else return undefined;
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return undefined;

  let hour = 0;
  let minute = 0;
  let second = 0;
  let offsetMinutes: number | undefined;
  if (time) {
    hour = Number(time[1]);
    minute = Number(time[2]);
    second = Number(time[3] ?? 0);
    if (time[4] === 'pm' && hour < 12) hour += 12;
    if (time[4] === 'am' && hour === 12) hour = 0;
    if (hour > 23 || minute > 59 || second > 59) return undefined;
    const after = text.slice(time.index + time[0].length);
    const zone = /^\s*(?:gmt|utc)?\s*([+-])(\d{2}):?(\d{2})\b/.exec(after);
    if (zone) offsetMinutes = (zone[1] === '-' ? -1 : 1) * (Number(zone[2]) * 60 + Number(zone[3]));
    else if (/^\s*(?:z|gmt|utc)\b/.test(after)) offsetMinutes = 0;
  }
  return { year, month, day, hour, minute, second, offsetMinutes };
}

/** ISO 8601 UTC of a wall-clock time. A copied header seldom names a zone, so the offset of the script's zone is the best guess. */
function toIso(local: LocalTime, offsetAt: OffsetAt): string {
  const wall = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  let offset = local.offsetMinutes;
  if (offset === undefined) {
    offset = offsetAt(wall);
    // The offset at the guessed instant may differ from the one at the real instant around a clock change.
    offset = offsetAt(wall - offset * 60000);
  }
  const date = new Date(wall - offset * 60000);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

/** "Name <a@b.example>", "\"Name\" [a@b.example]", "<mailto:a@b.example>", "a@b.example". */
function readAddress(value: string): { name: string; email: string } | undefined {
  const bracket = /^(.*?)[<[]\s*(?:mailto:)?([^\s<>[\]]+@[^\s<>[\]]+)\s*[>\]]/.exec(value);
  const bare = bracket ?? /^(.*?)\b([^\s<>[\]",;]+@[^\s<>[\]",;]+)/.exec(value);
  if (!bare) return undefined;
  const name = (bracket ? bare[1]! : '').replace(/^[\s"']+|[\s"']+$/g, '').trim();
  return { name: name.includes('@') ? '' : name, email: bare[2]!.replace(/^mailto:/i, '').trim().toLowerCase() };
}

/**
 * When the mail is a forwarded copy (it was sent on by the user from another of their addresses), the fields of the
 * original: who wrote it, to whom, when and with which subject, and the text of the original without the copied header.
 * Undefined when the mail is not a forwarded copy or the header cannot be read, so the mail stays as it is.
 */
export function unwrapForwarded(email: ForwardInput, offsetAt: OffsetAt = () => 0): ForwardedFields | undefined {
  if (!FORWARD_SUBJECT.test(email.subject ?? '')) return undefined;
  const body = (email.body ?? '').replace(/\r\n?/g, '\n');
  const all = body.split('\n');
  // Folding changes lengths, so the marker is looked for line by line and the offset is counted on the original lines.
  let offset = 0;
  let markerLine = -1;
  for (let index = 0; index < all.length && offset <= MARKER_WITHIN; index++) {
    if (FORWARD_MARKER.test(foldDiacritics(all[index]!))) {
      markerLine = index;
      break;
    }
    offset += all[index]!.length + 1;
  }
  if (markerLine === -1) return undefined;

  const lines = all.slice(markerLine + 1);
  const header: Partial<Record<'from' | 'to' | 'cc' | 'date' | 'subject', string>> = {};
  let used = 0;
  let blank = 0;
  for (const line of lines) {
    if (line.trim() === '') {
      if (Object.keys(header).length > 0 || ++blank > 2) break;
      used++;
      continue;
    }
    const field = /^\s*([A-Za-zÁ-ž]+)\s*:\s*(.*)$/.exec(line);
    const key = field ? HEADER_KEYS[foldDiacritics(field[1]!).toLowerCase()] : undefined;
    if (!field || key === undefined) break;
    header[key] = field[2]!.trim();
    used++;
  }
  const sender = header.from === undefined ? undefined : readAddress(header.from);
  if (!sender) return undefined;

  let text = lines.slice(used).join('\n').trim();
  // Some clients quote the whole original in double quotes.
  if (text.length > 1 && text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1).trim();
  const date = header.date === undefined ? undefined : readDate(header.date);
  const original = header.to === undefined ? undefined : header.to;
  return {
    from_email: sender.email,
    from_name: sender.name,
    to: original ?? email.to,
    cc: header.cc ?? '',
    received_at: (date && toIso(date, offsetAt)) || email.received_at,
    subject: header.subject !== undefined && header.subject !== '' ? header.subject : (email.subject ?? '').replace(FORWARD_SUBJECT, '').trim(),
    body: text,
    // A copy of the user's own mail stays outgoing; anything else was written by someone else.
    direction: sender.email === (email.from_email ?? '').trim().toLowerCase() ? email.direction : 'incoming',
  };
}

/** Whether the cell `signals` says the mail was a forwarded copy; true also for the bare `{"fwd":true}` that Restore leaves. */
export function wasForwarded(raw: string): boolean {
  try {
    return (JSON.parse(raw) as { fwd?: unknown } | null)?.fwd === true;
  } catch {
    return false;
  }
}
