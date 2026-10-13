import { COMMUNICATION_KINDS, DIRECTIONS_BY_KIND, communicationKind, type CommunicationKind } from '../communication-kinds';
import { NotFoundError, ValidationError } from '../errors';
import type { Repository } from '../repository';
import { ALLOWED_VALUES } from '../schema';
import type { Application, Communication } from '../types';

export interface CommunicationInput {
  applicationId: string;
  direction: string;
  channel: string;
  kind?: string;
  summary: string;
  details?: string;
  /** ISO 8601 date-time; defaults to now. */
  datetime?: string;
  contactId?: string;
  attachmentUrl?: string;
}

export interface CommunicationServiceDeps {
  communications: Repository<Communication>;
  applications: Repository<Application>;
  newId: () => string;
  /** ISO 8601 date-time. */
  now: () => string;
}

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

function invalid(field: string, value: string): never {
  throw new ValidationError('communication_invalid', `Invalid ${field}`, { field, value: value.slice(0, 100) });
}

function checkChannel(value: string): string {
  if (!ALLOWED_VALUES['Communications.channel']!.includes(value)) invalid('channel', value);
  return value;
}

function checkKind(value: string): CommunicationKind {
  if (!(COMMUNICATION_KINDS as readonly string[]).includes(value)) invalid('kind', value);
  return value as CommunicationKind;
}

function checkDirection(kind: CommunicationKind, value: string): string {
  if (!DIRECTIONS_BY_KIND[kind].includes(value)) invalid('direction', value);
  return value;
}

export class CommunicationService {
  constructor(private readonly deps: CommunicationServiceDeps) {}

  add(input: CommunicationInput): Communication {
    const { communications, applications, newId, now } = this.deps;
    const application = applications.get(input.applicationId);
    if (!application) {
      throw new NotFoundError('application_not_found', `Application ${input.applicationId} not found`, { id: input.applicationId });
    }
    const timestamp = now();
    const kind = checkKind(input.kind ?? 'message');
    const created = communications.insert({
      id: newId(),
      application_id: input.applicationId,
      datetime: this.checkDatetime(input.datetime ?? timestamp),
      direction: checkDirection(kind, input.direction),
      channel: checkChannel(input.channel),
      contact_id: input.contactId ?? '',
      summary: this.checkSummary(input.summary),
      details: input.details ?? '',
      attachment_url: input.attachmentUrl ?? '',
      kind,
    });
    const change: Partial<Omit<Application, 'id'>> = { last_activity_at: timestamp };
    if (kind === 'confirmation' && !application.applied_at) change.applied_at = created.datetime;
    applications.update(input.applicationId, change);
    return created;
  }

  update(id: string, patch: Partial<Omit<CommunicationInput, 'applicationId'>>): Communication {
    const existing = this.deps.communications.get(id);
    if (!existing) throw new NotFoundError('communication_not_found', `Communication ${id} not found`, { id });
    const change: Partial<Omit<Communication, 'id'>> = {};
    if (patch.kind !== undefined || patch.direction !== undefined) {
      const kind = patch.kind !== undefined ? checkKind(patch.kind) : communicationKind(existing.kind);
      change.direction = checkDirection(kind, patch.direction ?? existing.direction);
      if (patch.kind !== undefined) change.kind = kind;
    }
    if (patch.channel !== undefined) change.channel = checkChannel(patch.channel);
    if (patch.summary !== undefined) change.summary = this.checkSummary(patch.summary);
    if (patch.datetime !== undefined) change.datetime = this.checkDatetime(patch.datetime);
    if (patch.details !== undefined) change.details = patch.details;
    if (patch.contactId !== undefined) change.contact_id = patch.contactId;
    if (patch.attachmentUrl !== undefined) change.attachment_url = patch.attachmentUrl;
    const updated = this.deps.communications.update(id, change);
    if (change.kind === 'confirmation') this.fillAppliedAt(updated);
    return updated;
  }

  remove(id: string): void {
    if (!this.deps.communications.get(id)) throw new NotFoundError('communication_not_found', `Communication ${id} not found`, { id });
    this.deps.communications.remove(id);
  }

  listFor(applicationId: string): Communication[] {
    return this.deps.communications
      .list()
      .filter((c) => c.application_id === applicationId)
      .map((c) => ({ ...c, kind: communicationKind(c.kind) }))
      .sort((a, b) => (a.datetime < b.datetime ? 1 : a.datetime > b.datetime ? -1 : 0));
  }

  /** A confirmation proves the application was sent: fill an empty applied_at with its time. */
  private fillAppliedAt(entry: Communication): void {
    const { applications } = this.deps;
    const application = applications.get(entry.application_id);
    if (application && !application.applied_at) applications.update(entry.application_id, { applied_at: entry.datetime });
  }

  private checkSummary(summary: string): string {
    const trimmed = summary.trim();
    if (trimmed === '') invalid('summary', summary);
    return trimmed;
  }

  private checkDatetime(value: string): string {
    if (!ISO_DATETIME.test(value)) invalid('datetime', value);
    return value;
  }
}
