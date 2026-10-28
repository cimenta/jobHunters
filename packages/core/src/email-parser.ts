import { defaultCompiledEmailRules, type CompiledEmailRules } from './email-rules';
import { foldDiacritics } from './jobs/html';
import type { CommunicationKind } from './communication-kinds';
import type { Email } from './types';

/** What the parser may say about an e-mail; the values are the ones the column Emails.type allows. */
export type EmailType = 'rejection' | 'offer' | 'interview_invite' | 'homework' | 'confirmation' | 'outreach' | 'info_request' | 'noise' | 'other';

/** The status an entry made from the e-mail may also set (the user confirms it in the popup). */
export type EmailStatusHint = 'rejected' | 'offer' | 'interview' | 'homework';

export interface EmailParse {
  type: EmailType;
  /** The entry type to suggest; undefined for noise (nothing to save). */
  kind: CommunicationKind | undefined;
  /** Direction for the entry: incoming or outgoing for a message, meeting and homework; note for After meeting. */
  direction: string;
  /** `high` only for a clear, specific signature; the automatic saving trusts nothing else. */
  confidence: 'high' | 'low';
  /** Ids of the rules that decided, for the column Emails.signals. */
  signals: string[];
  statusHint: EmailStatusHint | undefined;
  /** Where and when a meeting is, as `YYYY-MM-DDTHH:MM` without a time zone (the time of the script's zone); empty when unknown. */
  meetingAt: string;
  /** Names of the job the text speaks about, to find the application or the job. */
  titleHints: string[];
  /** Names of the company the text speaks about (the sender may be only a relay such as a job portal). */
  companyHints: string[];
  /** A short text for the summary of the entry. */
  summary: string;
}

type EmailInput = Pick<Email, 'subject' | 'body' | 'direction' | 'from_email' | 'from_name' | 'is_bulk'>;

interface Context {
  email: EmailInput;
  subject: string;
  /** Subject and body, folded (no diacritics, lower case), the body cut to what matters. */
  text: string;
  /** The body as written, cut. */
  raw: string;
  outgoing: boolean;
  sender: string;
  rules: CompiledEmailRules;
}

const MAX_BODY = 4000;

const fold = (value: string): string => foldDiacritics(value).toLowerCase();
const any = (text: string, patterns: readonly RegExp[]): boolean => patterns.some((pattern) => pattern.test(text));

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, ledna: 1, leden: 1,
  feb: 2, february: 2, unora: 2, unor: 2,
  mar: 3, march: 3, brezna: 3, brezen: 3,
  apr: 4, april: 4, dubna: 4, duben: 4,
  may: 5, kvetna: 5, kveten: 5,
  jun: 6, june: 6, cervna: 6, cerven: 6,
  jul: 7, july: 7, cervence: 7, cervenec: 7,
  aug: 8, august: 8, srpna: 8, srpen: 8,
  sep: 9, sept: 9, september: 9, zari: 9,
  oct: 10, october: 10, rijna: 10, rijen: 10,
  nov: 11, november: 11, listopadu: 11, listopad: 11,
  dec: 12, december: 12, prosince: 12, prosinec: 12,
};

const pad = (n: number): string => String(n).padStart(2, '0');

function stamp(year: number, month: number, day: number, hour: number, minute: number): string {
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31 && hour < 24 && minute < 60)) return '';
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

/** The start of a meeting named in the text, `YYYY-MM-DDTHH:MM` or ''. Understands the forms the calendar and the e-mail clients write. */
export function extractMeetingTime(subject: string, body: string): string {
  const folded = fold(`${subject}\n${body.slice(0, MAX_BODY)}`);
  const monthWord = '(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december|ledna|unora|brezna|dubna|kvetna|cervna|cervence|srpna|zari|rijna|listopadu|prosince)';
  // "20 Oct 2026 16:00", "23. rijna 2026 10:00" (a weekday word and a separator such as "⋅" may sit between).
  const named = new RegExp(`(\\d{1,2})\\.?\\s+${monthWord}\\.?\\s+(\\d{4})[^\\d]{0,12}(\\d{1,2})[:.](\\d{2})`).exec(folded);
  if (named) return stamp(Number(named[3]), MONTHS[named[2]!]!, Number(named[1]), Number(named[4]), Number(named[5]));
  // "13.10.26 ... 13:00", "13. 10. 2026 v 13:00"
  const numeric = /(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{2}|\d{4})\b[^\d]{0,30}(\d{1,2}):(\d{2})/.exec(folded);
  if (numeric) {
    const year = Number(numeric[3]);
    return stamp(year < 100 ? 2000 + year : year, Number(numeric[2]), Number(numeric[1]), Number(numeric[4]), Number(numeric[5]));
  }
  return '';
}

function senderLabel(email: EmailInput): string {
  return fold(`${email.from_name} ${email.from_email}`);
}

// ---------------------------------------------------------------------------------------------------------------------
// What the text says about the job and the company.
// ---------------------------------------------------------------------------------------------------------------------

const cleanHint = (value: string): string =>
  value
    .replace(/[*_`#]|\\\|/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'„“«(\-–:]+|[\s"'”“»).,;:!?\-–]+$/g, '')
    .trim();

/** A trailing dot belongs to company forms such as "s.r.o." and "a.s."; any other trailing punctuation is dropped. */
const COMPANY_FORM_END = /(\bs\.r\.o|\ba\.\s?s|\bs\.p|\bk\.s|\bv\.o\.s|\bz\.s|\binc|\bltd)$/i;

function pushHint(list: string[], value: string | undefined, max = 120): void {
  let cleaned = cleanHint(value ?? '');
  // A closing bracket the clean-up took belongs back when the hint holds the opening one: "Product Manager (Full-time)".
  if ((cleaned.match(/\(/g) ?? []).length > (cleaned.match(/\)/g) ?? []).length && /\)\s*$/.test((value ?? '').replace(/[.*_\s]+$/, ''))) cleaned += ')';
  const hint =/\.\s*$/.test((value ?? '').trim()) && COMPANY_FORM_END.test(cleaned) ? `${cleaned}.` : cleaned;
  if (hint.length >= 2 && hint.length <= max && !list.some((item) => item.toLowerCase() === hint.toLowerCase())) list.push(hint);
}

const COMPANY_CONNECTORS = /^(s\.r\.o|a\.s|k\.s|spol|inc|ltd|gmbh|and|&|of|de|von|van|the)\.?,?$/i;

/** A company name ends where the lowercase words of a sentence begin: "UNIQA nás velmi potěšil" is "UNIQA". */
function pushCompany(list: string[], value: string | undefined): void {
  if (value === undefined) return;
  const words = value.trim().split(/\s+/);
  let end = 1;
  while (end < words.length && (!/^[a-zá-ž]/.test(words[end]!) || COMPANY_CONNECTORS.test(words[end]!))) end++;
  pushHint(list, end < words.length ? words.slice(0, end).join(' ') : value);
}

/** A title ends where the sentence goes on: "Vibecoder / AI Developer a za zaslané podklady" is "Vibecoder / AI Developer". */
function pushTitle(list: string[], value: string | undefined): void {
  pushHint(list, value?.split(/\s+(?:a za|a ve|a v|ve společnosti|v společnosti|ve firmě|v naší)\s/)[0]);
}

/** Job titles and company names the e-mail itself states; the matcher compares them with what the app knows. */
export function extractHints(subject: string, body: string): { titleHints: string[]; companyHints: string[] } {
  const titleHints: string[] = [];
  const companyHints: string[] = [];
  const text = `${subject}\n${body.slice(0, MAX_BODY)}`;

  // StartupJobs: "... poslat váš zájem o nabídku **TITLE** do **COMPANY**." and "Firma **COMPANY** zamítla váš zájem o nabídku **TITLE**."
  const sent = /zájem o nabídku\s+\*\*(.+?)\*\*\s+do\s+\*\*(.+?)\*\*/.exec(text);
  if (sent) {
    pushTitle(titleHints, sent[1]);
    pushCompany(companyHints, sent[2]);
  }
  const rejected = /Firma\s+\*\*(.+?)\*\*\s+zamítla\s+váš zájem o nabídku\s+\*\*(.+?)\*\*/.exec(text);
  if (rejected) {
    pushCompany(companyHints, rejected[1]);
    pushTitle(titleHints, rejected[2]);
  }
  const inFirm = /\*\*(.+?)\*\*\s+ve firmě\s+\*\*(.+?)\*\*/.exec(text);
  if (inFirm) {
    pushTitle(titleHints, inFirm[1]);
    pushCompany(companyHints, inFirm[2]);
  }
  const messageFrom = /z firmy\s+\*\*(.+?)\*\*\s+vám poslal/.exec(text);
  if (messageFrom) pushCompany(companyHints, messageFrom[1]);

  // Jobs.cz: "Vaši odpověď na nabídku *TITLE* jsme úspěšně doručili společnosti COMPANY."
  const delivered = /odpověď na nabídku\s+\*(.+?)\*\s+jsme úspěšně\s+doručili\s+společnosti\s+([^\n]+?)\.\s/s.exec(text);
  if (delivered) {
    pushTitle(titleHints, delivered[1]);
    pushCompany(companyHints, delivered[2]);
  }

  // Subjects of the portals: "[StartupJobs] COMPANY - děkujeme za váš zájem", "A je to tam! COMPANY už o vás ví!"
  const portalCompany = /^\[StartupJobs\]\s+(?:A je to tam!\s+)?(.+?)(?:\s+(?:už o vás ví!?|-\s+děkujeme za váš zájem))$/.exec(subject.trim());
  if (portalCompany) pushCompany(companyHints, portalCompany[1]);
  const newMessage = /^\[StartupJobs\]\s+Nová zpráva od\s+(.+)$/.exec(subject.trim());
  if (newMessage) pushCompany(companyHints, newMessage[1]);

  // A signature: "The HERE Talent Acquisition Team", "Bloomreach Recruitment Team", "Accenture Careers".
  const signature = /(?:^|[\n.!?]\s*|\b)(?:The\s+)?([A-Z][A-Za-z0-9&.-]*(?:[ \t]+[A-Z][A-Za-z0-9&.-]*){0,2}?)[ \t]+(?:Talent Acquisition|Talent|Recruitment|Recruiting|Hiring|HR|People)[ \t]+(?:Team|Department)\b/.exec(body.slice(0, MAX_BODY));
  if (signature) pushCompany(companyHints, signature[1]);

  // Free text: "na pozici TITLE v COMPANY", "position TITLE at COMPANY", "role TITLE at COMPANY".
  // A company name may hold dots ("s.r.o."), so it ends where a sentence goes on with a capital, or at a comma or a line end.
  const czech = /(?:na|o)\s+pozici\s+(.+?)(?:(?=[.,\n]|$)|\s+(?:ve společnosti|v společnosti|ve firmě|v naší společnosti|ve|v)\s+([A-ZÁ-Ž][^\n,]{1,60}?\.?)(?=\s+[A-ZÁ-Ž]|\s*[,\n]|\s*$))/.exec(text);
  if (czech) {
    pushTitle(titleHints, czech[1]);
    pushCompany(companyHints, czech[2]);
  }
  const english = /(?:position|role|vacancy|opening)\s+(?:of\s+)?(?:as\s+)?(?:the\s+)?([A-Z0-9][^\n.,]{2,100}?)(?:(?=[.,\n]|$)|\s+(?:position|role)?\s*(?:at|with|in)\s+([A-Z][^\n,]{1,60}?\.?)(?=\s+[A-Z]|\s*[,\n]|\s*$))/.exec(text);
  if (english) {
    pushTitle(titleHints, english[1]);
    pushCompany(companyHints, english[2]);
  }
  const titled = /(?:in|for|to) the ([A-Z][^\n.,]{2,80}?)\s+(?:position|role|vacancy)(?:\s+(?:at|with|in)\s+([A-Z][^\n,]{1,60}?\.?)(?=\s+[A-Z]|\s*[,\n]|\s*$))?/.exec(text);
  if (titled) {
    pushTitle(titleHints, titled[1]);
    pushCompany(companyHints, titled[2]);
  }
  const subjectTitle = /(?:pozici|position|role)\s+(.+)$/i.exec(subject.trim());
  if (subjectTitle) pushTitle(titleHints, subjectTitle[1]);
  const dashTail = /^(.{3,80}?)\s+-\s+([A-Z][^\n]{1,50})$/.exec(subject.trim());
  if (dashTail && !/^(re|fw|fwd)\b/i.test(subject.trim()) && !portalCompany) {
    pushTitle(titleHints, dashTail[1]);
    pushCompany(companyHints, dashTail[2]);
  }
  return { titleHints, companyHints };
}

// ---------------------------------------------------------------------------------------------------------------------
// The rules, in order. The first that matches decides; `signals` says which one.
// ---------------------------------------------------------------------------------------------------------------------

interface Verdict {
  type: EmailType;
  kind: CommunicationKind | undefined;
  confidence: 'high' | 'low';
  signal: string;
  statusHint?: EmailStatusHint;
}

/** The text of a message a portal relays ("Nová zpráva"): the part between the announcement and the reply button. */
function relayedMessage(raw: string): string | undefined {
  const start = /vám poslal\(a\) novou zprávu\./.exec(raw);
  if (!start) return undefined;
  const rest = raw.slice(start.index + start[0].length);
  const end = rest.search(/\[\s*Odpovědět na zprávu/);
  return (end === -1 ? rest : rest.slice(0, end)).trim();
}

function classify(context: Context): Verdict {
  const { email, subject, text, raw, outgoing } = context;
  const patterns = context.rules.patterns;
  const foldedSubject = fold(subject);
  const sender = context.sender;

  // The portals' own mails have fixed signatures; deciding on them first keeps the cover letter a portal quotes
  // ("Proč já ...") from being mistaken for the text of the e-mail.
  if (any(text.slice(0, 600), patterns.portal_confirmation)) {
    return { type: 'confirmation', kind: 'confirmation', confidence: 'high', signal: 'portal-confirmation' };
  }
  if (any(text.slice(0, 1500), patterns.portal_rejection)) {
    return { type: 'rejection', kind: 'message', confidence: 'high', signal: 'portal-rejection', statusHint: 'rejected' };
  }
  const relayed = relayedMessage(raw);
  if (relayed !== undefined) {
    const inner = classify({ ...context, email: { ...email, is_bulk: false }, subject: '', text: fold(relayed), raw: relayed });
    return { ...inner, kind: inner.kind ?? 'message', confidence: inner.type === 'other' ? 'low' : inner.confidence, signal: `relay:${inner.signal}` };
  }

  // A meeting note made by a notetaker is the user's own record of how a meeting went.
  if (any(foldedSubject + ' ' + sender, patterns.after_meeting) || (any(text.slice(0, 800), patterns.after_meeting) && !outgoing)) {
    return { type: 'other', kind: 'after_meeting', confidence: any(sender, patterns.after_meeting) ? 'high' : 'low', signal: 'meeting-notes' };
  }

  // Rejection first: its text often thanks for the interview or the application, which the later rules would read as other things.
  if (!outgoing && any(text, patterns.rejection)) {
    return { type: 'rejection', kind: 'message', confidence: 'high', signal: 'rejection', statusHint: 'rejected' };
  }
  if (!outgoing && any(text, patterns.offer)) {
    return { type: 'offer', kind: 'message', confidence: 'low', signal: 'offer', statusHint: 'offer' };
  }
  if (any(text, patterns.homework)) {
    return { type: 'homework', kind: 'homework', confidence: 'low', signal: 'homework', statusHint: 'homework' };
  }

  const calendar = any(foldedSubject, patterns.calendar) || any(text, patterns.calendar);
  const wordy = any(text.slice(0, 1500), patterns.meeting_words) || any(foldedSubject, patterns.meeting_words);
  const timed = extractMeetingTime(email.subject, context.raw) !== '';
  if (calendar) {
    return { type: 'interview_invite', kind: 'meeting', confidence: 'high', signal: 'calendar', statusHint: 'interview' };
  }
  // Your own replies mention invitations without being one; they count only with a date and time.
  if (wordy && (!outgoing || timed)) {
    return { type: 'interview_invite', kind: 'meeting', confidence: timed ? 'high' : 'low', signal: timed ? 'meeting-words-time' : 'meeting-words', statusHint: 'interview' };
  }

  if (!outgoing && any(text, patterns.confirmation)) {
    return { type: 'confirmation', kind: 'confirmation', confidence: /thank you for your interest|dekujeme za vas zajem/.test(text) ? 'low' : 'high', signal: 'confirmation' };
  }
  if (!outgoing && any(text, patterns.info_request)) {
    return { type: 'info_request', kind: 'message', confidence: 'low', signal: 'info-request' };
  }
  if (!outgoing && (email.is_bulk || any(text.slice(0, 1200), patterns.noise) || any(foldedSubject, patterns.noise_subject))) {
    return { type: 'noise', kind: undefined, confidence: email.is_bulk ? 'high' : 'low', signal: 'noise' };
  }
  return { type: 'other', kind: 'message', confidence: 'low', signal: outgoing ? 'outgoing' : 'default' };
}

function summaryOf(email: EmailInput, verdict: Verdict): string {
  const subject = email.subject.replace(/^(\s*(re|fw|fwd|odp)\s*:\s*)+/i, '').trim();
  return subject.slice(0, 120);
}

/** Classifies one e-mail: the type, the entry to suggest, how sure that is and what the text says about the job and the company. */
export function parseEmail(email: EmailInput, rules: CompiledEmailRules = defaultCompiledEmailRules()): EmailParse {
  const body = email.body ?? '';
  const raw = body.slice(0, MAX_BODY);
  const context: Context = {
    email,
    subject: email.subject ?? '',
    raw,
    text: fold(`${email.subject ?? ''}\n${raw}`),
    outgoing: email.direction === 'outgoing',
    sender: senderLabel(email),
    rules,
  };
  const verdict = classify(context);
  const hints = extractHints(email.subject ?? '', body);
  const meetingAt = verdict.kind === 'meeting' ? extractMeetingTime(email.subject ?? '', raw) : '';
  const direction = verdict.kind === 'after_meeting' ? 'note' : email.direction === 'outgoing' ? 'outgoing' : 'incoming';
  return {
    type: verdict.type,
    kind: verdict.kind,
    direction: verdict.kind === 'confirmation' ? 'incoming' : direction,
    confidence: verdict.confidence,
    signals: [verdict.signal],
    statusHint: verdict.statusHint,
    meetingAt,
    titleHints: hints.titleHints,
    companyHints: hints.companyHints,
    summary: summaryOf(email, verdict),
  };
}
