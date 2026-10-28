import type { ApplicationService } from './application-service';
import type { CommunicationService } from './applications/communication-service';
import { applicationRows } from './catalog';
import { COMMUNICATION_KINDS, type CommunicationKind } from './communication-kinds';
import type { EmailMarkKey } from './email-marks';
import { parseEmail, type EmailParse, type EmailStatusHint } from './email-parser';
import { matchEmail, type MatchCandidate, type MatchResult } from './email-matcher';
import type { CompiledEmailRules } from './email-rules';
import { NotFoundError, ValidationError } from './errors';
import { truncateForCell } from './jobs/html';
import type { Repository } from './repository';
import { canTransition, isApplicationStatus, isDatedStatus, type ApplicationStatus, type StatusTransitions } from './status';
import type { Application, Communication, Company, Email, Job } from './types';

/** What parsing leaves in the cell `signals`, so the popup can be shown again without parsing. */
export interface StoredSuggestion {
  rule: string;
  /** The entry type chosen at the end (the suggested one until the mail is saved). */
  kind: CommunicationKind | '';
  dir: string;
  /** `YYYY-MM-DDTHH:MM`, the time a meeting names; empty when none. */
  at: string;
  hint: EmailStatusHint | '';
  titles: string[];
  companies: string[];
  summary: string;
}

export interface EmailSuggestion extends StoredSuggestion {
  type: string;
  confidence: string;
  candidates: MatchCandidate[];
  unique: boolean;
}

export interface EmailDetail {
  email: Email;
  /** Missing while the mail is new (not parsed). */
  suggestion: EmailSuggestion | undefined;
}

export interface ParseSummary {
  parsed: number;
  suggested: number;
  withoutMatch: number;
  saved: number;
  ignored: number;
}

export interface ConfirmInput {
  applicationId?: string;
  jobId?: string;
  kind: string;
  direction: string;
  channel?: string;
  summary?: string;
  /** ISO 8601, with or without a time zone; the date of the mail when empty. */
  at?: string;
  notes?: string;
  includeText?: boolean;
  /** A status to set on the application; it must be allowed by the status rules. */
  status?: string;
  /** The deadline or reminder date (YYYY-MM-DD) the dated statuses need. */
  statusDate?: string;
}

export interface EmailServiceDeps {
  emails: Repository<Email>;
  applications: Repository<Application>;
  jobs: Repository<Job>;
  companies: Repository<Company>;
  communicationService: Pick<CommunicationService, 'add'>;
  applicationService: Pick<ApplicationService, 'setStatus'>;
  rules: () => CompiledEmailRules;
  autoSave: () => boolean;
  transitions: () => StatusTransitions;
}

function invalidState(id: string, state: string): never {
  throw new ValidationError('email_state_invalid', `E-mail ${id} is already ${state === '' ? 'new' : state}`, { id, state });
}

/**
 * The status an entry may also set, by its type; undefined when none applies or the rules of the status forbid the move.
 * Used by the popup (the ticked box) and by the service (automatic saving and the check before saving).
 */
export function suggestStatus(
  kind: CommunicationKind | string,
  hint: EmailStatusHint | '' | undefined,
  current: string,
  transitions: StatusTransitions,
): ApplicationStatus | undefined {
  if (!isApplicationStatus(current)) return undefined;
  let target: ApplicationStatus | undefined;
  if (kind === 'confirmation') target = current === 'draft' ? 'sent' : undefined;
  else if (kind === 'meeting') target = 'interview';
  else if (kind === 'homework') target = 'homework';
  else if (kind === 'message') target = hint === 'rejected' ? 'rejected' : hint === 'offer' ? 'offer' : undefined;
  if (target === undefined || target === current) return undefined;
  return canTransition(current, target, transitions) ? target : undefined;
}

/** The details of an entry made from a mail: the notes, then the header and the text of the mail. */
export function composeDetails(email: Email, notes: string, includeText: boolean): string {
  const parts: string[] = [];
  if (notes.trim() !== '') parts.push(notes.trim());
  if (includeText) {
    const sender = email.from_name.trim() === '' ? email.from_email : `${email.from_name.trim()} <${email.from_email}>`;
    const header = ['--- E-mail ---', `From: ${sender}`, `To: ${email.to}`, ...(email.cc !== '' ? [`Cc: ${email.cc}`] : []), `Date: ${email.received_at}`, `Subject: ${email.subject}`];
    parts.push(`${header.join('\n')}\n\n${email.body}`.trimEnd());
  }
  return truncateForCell(parts.join('\n\n'));
}

export function readStoredSuggestion(raw: string): StoredSuggestion | undefined {
  if (raw.trim() === '') return undefined;
  try {
    const value = JSON.parse(raw) as Partial<StoredSuggestion>;
    if (typeof value !== 'object' || value === null || typeof value.rule !== 'string') return undefined;
    return {
      rule: value.rule,
      kind: (COMMUNICATION_KINDS as readonly string[]).includes(value.kind ?? '') ? (value.kind as CommunicationKind) : '',
      dir: typeof value.dir === 'string' ? value.dir : '',
      at: typeof value.at === 'string' ? value.at : '',
      hint: (['rejected', 'offer', 'interview', 'homework'] as const).find((hint) => hint === value.hint) ?? '',
      titles: Array.isArray(value.titles) ? value.titles.filter((item): item is string => typeof item === 'string') : [],
      companies: Array.isArray(value.companies) ? value.companies.filter((item): item is string => typeof item === 'string') : [],
      summary: typeof value.summary === 'string' ? value.summary : '',
    };
  } catch {
    return undefined;
  }
}

/** Which mark a mail wears in the list: new, ignored, the kind it is or was saved as, or a rejection or an offer that is a plain message. */
export function emailMarkKey(row: { state: string; type: string; signals: string }): EmailMarkKey {
  if (row.state === 'ignored') return 'ignored';
  if (row.state !== 'suggested' && row.state !== 'confirmed') return 'new';
  const stored = readStoredSuggestion(row.signals);
  if (row.state === 'suggested' && (row.type === 'noise' || stored?.kind === '')) return 'ignored';
  const kind = stored?.kind || 'message';
  if (kind === 'message' && (row.type === 'rejection' || row.type === 'offer')) return row.type;
  return kind;
}

function toStored(parse: EmailParse): StoredSuggestion {
  return {
    rule: parse.signals.join(','),
    kind: parse.kind ?? '',
    dir: parse.direction,
    at: parse.meetingAt,
    hint: parse.statusHint ?? '',
    titles: parse.titleHints.slice(0, 4),
    companies: parse.companyHints.slice(0, 4),
    summary: parse.summary,
  };
}

/** Kinds that need no look from the user when the rule was a clear one. */
const AUTO_SAVE_KINDS: readonly string[] = ['confirmation', 'meeting', 'after_meeting'];

export class EmailService {
  constructor(private readonly deps: EmailServiceDeps) {}

  /** Parses every mail that is new; with automatic saving on, the ones that qualify are saved too. */
  parseAll(): ParseSummary {
    const summary: ParseSummary = { parsed: 0, suggested: 0, withoutMatch: 0, saved: 0, ignored: 0 };
    for (const email of this.deps.emails.list()) {
      if (email.state !== '') continue;
      const result = this.parseRow(email);
      summary.parsed++;
      if (result === 'saved') summary.saved++;
      else if (result === 'ignored') summary.ignored++;
      else summary.suggested++;
      if (result === 'unmatched') summary.withoutMatch++;
    }
    return summary;
  }

  /** The mail with its suggestion; a new mail is parsed first. */
  parseOne(id: string): EmailDetail {
    const email = this.require(id);
    if (email.state === '') this.parseRow(email);
    return this.detail(id);
  }

  detail(id: string): EmailDetail {
    const email = this.require(id);
    if (email.state === '') return { email, suggestion: undefined };
    const stored = this.withFreshHints(email, readStoredSuggestion(email.signals) ?? toStored(this.parse(email)));
    const match = this.match(email, stored);
    return {
      email,
      suggestion: { ...stored, type: email.type, confidence: email.type_confidence, candidates: match.candidates, unique: match.unique },
    };
  }

  confirm(id: string, input: ConfirmInput): Communication {
    const { communicationService, applicationService, emails, applications, transitions } = this.deps;
    const email = this.require(id);
    if (email.state === 'confirmed' || email.state === 'ignored') invalidState(id, email.state);
    const applicationId = input.applicationId ?? '';
    let jobId = input.jobId ?? '';
    if (applicationId === '' && jobId === '') throw new ValidationError('email_target_missing', 'Choose an application or a job', { id });
    const application = applicationId === '' ? undefined : applications.get(applicationId);
    if (applicationId !== '' && !application) throw new NotFoundError('application_not_found', `Application ${applicationId} not found`, { id: applicationId });
    if (application) jobId = application.job_id;

    // The status is checked before anything is written, so a refused one leaves no half-saved entry.
    let status: ApplicationStatus | undefined;
    if (input.status !== undefined && input.status !== '' && application) {
      if (!isApplicationStatus(input.status) || !canTransition(application.status as ApplicationStatus, input.status, transitions())) {
        throw new ValidationError('transition_not_allowed', `Cannot move application ${application.id} to ${input.status}`, { id: application.id, to: input.status });
      }
      if (isDatedStatus(input.status) && (input.statusDate ?? '') === '') throw new ValidationError('reminder_date_required', 'The status needs a date', { status: input.status });
      status = input.status;
    }

    const entry = communicationService.add({
      applicationId: application ? application.id : undefined,
      jobId: application ? undefined : jobId,
      direction: input.direction,
      kind: input.kind,
      channel: input.channel ?? 'email',
      summary: input.summary ?? '',
      details: composeDetails(email, input.notes ?? '', input.includeText !== false),
      datetime: input.at !== undefined && input.at !== '' ? input.at : email.received_at,
    });
    if (status !== undefined && application) applicationService.setStatus(application.id, status, input.statusDate === undefined ? {} : { remindAt: input.statusDate });

    const stored = readStoredSuggestion(email.signals);
    const suggestedTarget = email.application_id !== '' || email.job_id !== '' ? { application: email.application_id, job: email.job_id } : undefined;
    const changed = suggestedTarget === undefined || suggestedTarget.application !== (application?.id ?? '') || suggestedTarget.job !== jobId;
    emails.update(id, {
      state: 'confirmed',
      communication_id: entry.id,
      application_id: application?.id ?? '',
      job_id: jobId,
      match_method: changed ? 'manual' : email.match_method,
      signals: JSON.stringify({ ...(stored ?? toStored(this.parse(email))), kind: input.kind }),
    });
    return entry;
  }

  ignore(id: string): Email {
    const email = this.require(id);
    if (email.state === 'confirmed') invalidState(id, email.state);
    return this.deps.emails.update(id, { state: 'ignored' });
  }

  /** Puts an ignored or suggested mail back to new; a saved one stays saved. */
  restore(id: string): Email {
    const email = this.require(id);
    if (email.state === 'confirmed') invalidState(id, email.state);
    return this.deps.emails.update(id, { state: '', type: '', type_confidence: '', signals: '', application_id: '', job_id: '', match_method: '' });
  }

  // ---------------------------------------------------------------------------------------------------------------

  private require(id: string): Email {
    const email = this.deps.emails.get(id);
    if (!email) throw new NotFoundError('email_not_found', `E-mail ${id} not found`, { id });
    return email;
  }

  private parse(email: Email): EmailParse {
    return parseEmail(email, this.deps.rules());
  }

  /**
   * A mail that is not saved yet also gets the names the current rules find, so a better reader helps a mail that was parsed
   * earlier without "Parse again". What was stored stays first; a saved or ignored mail is left as it is.
   */
  private withFreshHints(email: Email, stored: StoredSuggestion): StoredSuggestion {
    if (email.state !== 'suggested') return stored;
    const fresh = toStored(this.parse(email));
    const join = (old: string[], added: string[]): string[] => [...old, ...added.filter((item) => !old.some((known) => known.toLowerCase() === item.toLowerCase()))].slice(0, 4);
    return { ...stored, titles: join(stored.titles, fresh.titles), companies: join(stored.companies, fresh.companies) };
  }

  private match(email: Email, stored: StoredSuggestion): MatchResult {
    const { emails, applications, jobs, companies, rules } = { ...this.deps, rules: this.deps.rules() };
    const jobList = jobs.list();
    const companyList = companies.list();
    return matchEmail({
      email,
      titleHints: stored.titles,
      companyHints: stored.companies,
      applications: applicationRows(applications.list(), jobList, companyList),
      jobs: jobList,
      companies: companyList,
      others: emails.list().filter((other) => other.state === 'confirmed' || other.state === 'suggested'),
      relayDomains: rules.relayDomains,
    });
  }

  /** Parses one new mail and stores the result; returns what became of it. */
  private parseRow(email: Email): 'saved' | 'ignored' | 'suggested' | 'unmatched' {
    const parse = this.parse(email);
    const stored = toStored(parse);
    const match = this.match(email, stored);
    const best = match.best;
    this.deps.emails.update(email.id, {
      type: parse.type,
      type_confidence: parse.confidence,
      signals: JSON.stringify(stored),
      application_id: best?.applicationId ?? '',
      job_id: best?.jobId ?? '',
      match_method: best?.method ?? '',
      state: 'suggested',
    });
    if (this.deps.autoSave() && parse.type === 'noise' && parse.confidence === 'high') {
      this.deps.emails.update(email.id, { state: 'ignored' });
      return 'ignored';
    }
    if (this.deps.autoSave() && this.qualifies(parse, match)) {
      const target = match.best!;
      const application = target.applicationId === '' ? undefined : this.deps.applications.get(target.applicationId);
      const status = application ? suggestStatus(parse.kind!, parse.statusHint, application.status, this.deps.transitions()) : undefined;
      try {
        this.confirm(email.id, {
          applicationId: target.applicationId,
          jobId: target.jobId,
          kind: parse.kind!,
          direction: parse.direction,
          channel: parse.kind === 'after_meeting' ? '' : 'email',
          summary: parse.summary,
          at: parse.meetingAt !== '' ? parse.meetingAt : email.received_at,
          includeText: true,
          ...(status === undefined ? {} : { status }),
        });
        return 'saved';
      } catch {
        return best ? 'suggested' : 'unmatched';
      }
    }
    return best ? 'suggested' : 'unmatched';
  }

  /** A clear rule, one clear target, and an entry that needs nothing more from the user (a deadline, a decision). */
  private qualifies(parse: EmailParse, match: MatchResult): boolean {
    if (parse.confidence !== 'high' || !match.unique || match.best === undefined || parse.kind === undefined) return false;
    if (AUTO_SAVE_KINDS.includes(parse.kind)) return true;
    return parse.kind === 'message' && parse.type === 'rejection';
  }
}

