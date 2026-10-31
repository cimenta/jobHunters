import { t, type Locale } from './i18n';
import { NotFoundError, ValidationError } from './errors';
import type { AppendLog, Repository } from './repository';
import { sortBoard } from './board';
import { canTransition, isApplicationStatus, isDatedStatus, type ApplicationStatus, type StatusTransitions } from './status';
import { DEFAULT_JOB_STATUS_STYLES, type JobStatusStyles } from './job-status';
import { jobStatusOnRejection } from './job-lifecycle';
import type { Application, Job, Reminder, StatusHistoryEntry } from './types';

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
  /** With these, an application that moves to rejected archives its ad (see job-lifecycle.ts). */
  jobs?: Repository<Job>;
  jobStatusStyles?: () => JobStatusStyles;
}

export interface SetStatusOptions {
  /** Required when moving to `waiting` (the reminder date) or `homework` (the deadline): YYYY-MM-DD, a real date, not before today. */
  remindAt?: string;
  /** When the change happened, as an ISO date-time (the time of the e-mail it comes from); the history shows it instead of the time of saving. */
  at?: string;
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
    // A dated status can be entered again to move its date (a new reminder date, a new homework deadline).
    const reschedule = from === to && isDatedStatus(to);
    if (!reschedule && !canTransition(from, to, this.deps.transitions?.())) {
      throw new ValidationError('transition_not_allowed', `Cannot move application ${applicationId} from ${from} to ${to}`, {
        id: applicationId,
        from,
        to,
      });
    }

    const timestamp = now();
    const remindAt = isDatedStatus(to) ? requireReminderDate(options.remindAt, timestamp) : undefined;

    // All validation is done; from here on we write.
    if (isDatedStatus(from)) this.closeReminders(applicationId, from as 'waiting' | 'homework', timestamp);
    if (remindAt !== undefined) {
      reminders.insert({
        id: newId(),
        application_id: applicationId,
        job_id: application.job_id,
        due_at: remindAt,
        text: t(to === 'homework' ? 'reminder.homework' : 'reminder.waiting', {}, locale()),
        status: 'open',
        source: to as 'waiting' | 'homework',
        created_at: timestamp,
        done_at: '',
        reminded_at: '',
      });
    }

    const patch: Partial<Omit<Application, 'id'>> = { status: to, last_activity_at: timestamp };
    if (!reschedule) patch.board_position = null;
    if (to === 'sent' && !application.applied_at) patch.applied_at = timestamp;
    const updated = applications.update(applicationId, patch);

    const happenedAt = options.at !== undefined && !Number.isNaN(Date.parse(options.at)) ? options.at : timestamp;
    history.append({ application_id: applicationId, from, to, at: happenedAt });
    if (to === 'rejected' || to === 'withdrawn') this.archiveJob(updated.job_id);
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

  private archiveJob(jobId: string): void {
    const { jobs, jobStatusStyles } = this.deps;
    const job = jobs?.get(jobId);
    if (jobs === undefined || job === undefined) return;
    const next = jobStatusOnRejection(jobStatusStyles?.() ?? DEFAULT_JOB_STATUS_STYLES, job.status);
    if (next !== undefined) jobs.update(jobId, { status: next });
  }

  private closeReminders(applicationId: string, source: 'waiting' | 'homework', timestamp: string): void {
    const { reminders } = this.deps;
    for (const reminder of reminders.list()) {
      if (reminder.application_id === applicationId && reminder.source === source && reminder.status === 'open') {
        reminders.update(reminder.id, { status: 'done', done_at: timestamp });
      }
    }
  }
}

export function requireReminderDate(remindAt: string | undefined, nowIso: string): string {
  const match = remindAt === undefined ? null : /^(\d{4})-(\d{2})-(\d{2})$/.exec(remindAt);
  if (remindAt === undefined || !match) {
    throw new ValidationError('reminder_date_required', 'Status "waiting" or "homework" needs a date in YYYY-MM-DD format');
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
