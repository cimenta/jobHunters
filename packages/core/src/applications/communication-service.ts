import { NotFoundError, ValidationError } from '../errors';
import type { Repository } from '../repository';
import { ALLOWED_VALUES } from '../schema';
import type { Application, Communication } from '../types';

export interface CommunicationInput {
  applicationId: string;
  direction: string;
  channel: string;
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

function checkField(field: 'direction' | 'channel', value: string): string {
  if (!ALLOWED_VALUES[`Communications.${field}`]!.includes(value)) invalid(field, value);
  return value;
}

export class CommunicationService {
  constructor(private readonly deps: CommunicationServiceDeps) {}

  add(input: CommunicationInput): Communication {
    const { communications, applications, newId, now } = this.deps;
    if (!applications.get(input.applicationId)) {
      throw new NotFoundError('application_not_found', `Application ${input.applicationId} not found`, { id: input.applicationId });
    }
    const timestamp = now();
    const created = communications.insert({
      id: newId(),
      application_id: input.applicationId,
      datetime: this.checkDatetime(input.datetime ?? timestamp),
      direction: checkField('direction', input.direction),
      channel: checkField('channel', input.channel),
      contact_id: input.contactId ?? '',
      summary: this.checkSummary(input.summary),
      details: input.details ?? '',
      attachment_url: input.attachmentUrl ?? '',
    });
    applications.update(input.applicationId, { last_activity_at: timestamp });
    return created;
  }

  update(id: string, patch: Partial<Omit<CommunicationInput, 'applicationId'>>): Communication {
    if (!this.deps.communications.get(id)) throw new NotFoundError('communication_not_found', `Communication ${id} not found`, { id });
    const change: Partial<Omit<Communication, 'id'>> = {};
    if (patch.direction !== undefined) change.direction = checkField('direction', patch.direction);
    if (patch.channel !== undefined) change.channel = checkField('channel', patch.channel);
    if (patch.summary !== undefined) change.summary = this.checkSummary(patch.summary);
    if (patch.datetime !== undefined) change.datetime = this.checkDatetime(patch.datetime);
    if (patch.details !== undefined) change.details = patch.details;
    if (patch.contactId !== undefined) change.contact_id = patch.contactId;
    if (patch.attachmentUrl !== undefined) change.attachment_url = patch.attachmentUrl;
    return this.deps.communications.update(id, change);
  }

  remove(id: string): void {
    if (!this.deps.communications.get(id)) throw new NotFoundError('communication_not_found', `Communication ${id} not found`, { id });
    this.deps.communications.remove(id);
  }

  listFor(applicationId: string): Communication[] {
    return this.deps.communications.list().filter((c) => c.application_id === applicationId).sort((a, b) => (a.datetime < b.datetime ? 1 : a.datetime > b.datetime ? -1 : 0));
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
