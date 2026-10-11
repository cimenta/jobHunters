import { NotFoundError, ValidationError } from './errors';
import type { AppendLog, Repository } from './repository';
import { canTransition, isApplicationStatus, type ApplicationStatus } from './status';
import type { Application, Reminder, StatusHistoryEntry } from './types';

export interface ApplicationServiceDeps {
  applications: Repository<Application>;
  reminders: Repository<Reminder>;
  history: AppendLog<StatusHistoryEntry>;
  newId: () => string;
  /** Current time as an ISO 8601 date-time, e.g. 2026-10-10T08:00:00.000Z. */
  now: () => string;
}

export interface SetStatusOptions {
  /** Required when moving to `waiting`: YYYY-MM-DD, a real date, not before today. */
  remindAt?: string;
}

const WAITING_REMINDER_TEXT = 'Čekání na odpověď';

export class ApplicationService {
  constructor(private readonly deps: ApplicationServiceDeps) {}

  setStatus(applicationId: string, to: ApplicationStatus, options: SetStatusOptions = {}): Application {
    const { applications, reminders, history, newId, now } = this.deps;

    const application = applications.get(applicationId);
    if (!application) throw new NotFoundError(`Application ${applicationId} not found`);
    if (!isApplicationStatus(to)) throw new ValidationError(`Unknown target status "${to}"`);
    if (!isApplicationStatus(application.status)) {
      throw new ValidationError(`Application ${applicationId} has unknown status "${application.status}"`);
    }

    const from = application.status;
    const reschedule = from === 'waiting' && to === 'waiting';
    if (!reschedule && !canTransition(from, to)) {
      throw new ValidationError(`Cannot move application ${applicationId} from ${from} to ${to}`);
    }

    const timestamp = now();
    const remindAt = to === 'waiting' ? requireReminderDate(options.remindAt, timestamp) : undefined;

    // All validation is done; from here on we write.
    if (from === 'waiting') this.closeWaitingReminders(applicationId, timestamp);
    if (remindAt !== undefined) {
      reminders.insert({
        id: newId(),
        application_id: applicationId,
        job_id: application.job_id,
        due_at: remindAt,
        text: WAITING_REMINDER_TEXT,
        status: 'open',
        source: 'waiting',
        created_at: timestamp,
        done_at: '',
        reminded_at: '',
      });
    }

    const patch: Partial<Omit<Application, 'id'>> = { status: to, last_activity_at: timestamp };
    if (to === 'sent' && !application.applied_at) patch.applied_at = timestamp;
    const updated = applications.update(applicationId, patch);

    history.append({ application_id: applicationId, from, to, at: timestamp });
    return updated;
  }

  private closeWaitingReminders(applicationId: string, timestamp: string): void {
    const { reminders } = this.deps;
    for (const reminder of reminders.list()) {
      if (reminder.application_id === applicationId && reminder.source === 'waiting' && reminder.status === 'open') {
        reminders.update(reminder.id, { status: 'done', done_at: timestamp });
      }
    }
  }
}

function requireReminderDate(remindAt: string | undefined, nowIso: string): string {
  const match = remindAt === undefined ? null : /^(\d{4})-(\d{2})-(\d{2})$/.exec(remindAt);
  if (remindAt === undefined || !match) {
    throw new ValidationError('Status "waiting" needs a reminder date in YYYY-MM-DD format');
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
  if (!isRealDate) throw new ValidationError(`"${remindAt}" is not a real calendar date`);
  if (remindAt < nowIso.slice(0, 10)) {
    throw new ValidationError(`Reminder date ${remindAt} is in the past`);
  }
  return remindAt;
}
