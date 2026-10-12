import { t, type Locale } from './i18n';
import { NotFoundError, ValidationError } from './errors';
import type { AppendLog, Repository } from './repository';
import { sortBoard } from './board';
import { canTransition, isApplicationStatus, type ApplicationStatus, type StatusTransitions } from './status';
import type { Application, Reminder, StatusHistoryEntry } from './types';

export interface ApplicationServiceDeps {
  applications: Repository<Application>;
  reminders: Repository<Reminder>;
  history: AppendLog<StatusHistoryEntry>;
  newId: () => string;
  /** Current time as an ISO 8601 date-time, e.g. 2026-10-10T08:00:00.000Z. */
  now: () => string;
  /** Language of texts the app writes into sheets (the user's UI language). */
  locale: () => Locale;
  /** The allowed moves between statuses; the built-in rules when not given. */
  transitions?: () => StatusTransitions;
}

export interface SetStatusOptions {
  /** Required when moving to `waiting`: YYYY-MM-DD, a real date, not before today. */
  remindAt?: string;
}

export class ApplicationService {
  constructor(private readonly deps: ApplicationServiceDeps) {}

  setStatus(applicationId: string, to: ApplicationStatus, options: SetStatusOptions = {}): Application {
    const { applications, reminders, history, newId, now, locale } = this.deps;

    const application = applications.get(applicationId);
    if (!application) throw new NotFoundError('application_not_found', `Application ${applicationId} not found`, { id: applicationId });
    if (!isApplicationStatus(to)) throw new ValidationError('status_unknown', `Unknown target status "${to}"`, { status: String(to) });
    if (!isApplicationStatus(application.status)) {
      throw new ValidationError(
        'application_status_unknown',
        `Application ${applicationId} has unknown status "${application.status}"`,
        { id: applicationId, status: application.status },
      );
    }

    const from = application.status;
    const reschedule = from === 'waiting' && to === 'waiting';
    if (!reschedule && !canTransition(from, to, this.deps.transitions?.())) {
      throw new ValidationError('transition_not_allowed', `Cannot move application ${applicationId} from ${from} to ${to}`, {
        id: applicationId,
        from,
        to,
      });
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
        text: t('reminder.waiting', {}, locale()),
        status: 'open',
        source: 'waiting',
        created_at: timestamp,
        done_at: '',
        reminded_at: '',
      });
    }

    const patch: Partial<Omit<Application, 'id'>> = { status: to, last_activity_at: timestamp };
    if (!reschedule) patch.board_position = null;
    if (to === 'sent' && !application.applied_at) patch.applied_at = timestamp;
    const updated = applications.update(applicationId, patch);

    history.append({ application_id: applicationId, from, to, at: timestamp });
    return updated;
  }

  /**
   * Moves a card of the Kanban board: changes the status when the column differs (with the same checks and effects as
   * setStatus) and stores its place in the column. index is the place among the other cards of the column.
   */
  move(applicationId: string, to: ApplicationStatus, index: number, options: SetStatusOptions = {}): Application {
    const { applications } = this.deps;
    const application = applications.get(applicationId);
    if (!application) throw new NotFoundError('application_not_found', `Application ${applicationId} not found`, { id: applicationId });
    const moved = application.status === to ? application : this.setStatus(applicationId, to, options);
    const others = sortBoard(applications.list().filter((a) => a.status === to && a.id !== applicationId));
    const place = Math.max(0, Math.min(Number.isInteger(index) ? index : others.length, others.length));
    const column = [...others.slice(0, place), moved, ...others.slice(place)];
    column.forEach((card, position) => {
      if (card.board_position !== position + 1) applications.update(card.id, { board_position: position + 1 });
    });
    return applications.get(applicationId)!;
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

export function requireReminderDate(remindAt: string | undefined, nowIso: string): string {
  const match = remindAt === undefined ? null : /^(\d{4})-(\d{2})-(\d{2})$/.exec(remindAt);
  if (remindAt === undefined || !match) {
    throw new ValidationError('reminder_date_required', 'Status "waiting" needs a reminder date in YYYY-MM-DD format');
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
  if (!isRealDate) throw new ValidationError('reminder_date_invalid', `"${remindAt}" is not a real calendar date`, { date: remindAt });
  if (remindAt < nowIso.slice(0, 10)) {
    throw new ValidationError('reminder_date_in_past', `Reminder date ${remindAt} is in the past`, { date: remindAt });
  }
  return remindAt;
}
