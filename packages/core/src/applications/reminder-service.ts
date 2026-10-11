import { requireReminderDate } from '../application-service';
import { NotFoundError, ValidationError } from '../errors';
import type { Repository } from '../repository';
import type { Application, Reminder } from '../types';

export interface ReminderServiceDeps {
  reminders: Repository<Reminder>;
  applications: Repository<Application>;
  newId: () => string;
  /** ISO 8601 date-time. */
  now: () => string;
}

const byDue = (a: Reminder, b: Reminder): number => (a.due_at < b.due_at ? -1 : a.due_at > b.due_at ? 1 : 0);

export class ReminderService {
  constructor(private readonly deps: ReminderServiceDeps) {}

  add(input: { applicationId: string; dueAt: string; text: string }): Reminder {
    const { reminders, applications, newId, now } = this.deps;
    const application = applications.get(input.applicationId);
    if (!application) throw new NotFoundError('application_not_found', `Application ${input.applicationId} not found`, { id: input.applicationId });
    const timestamp = now();
    const dueAt = requireReminderDate(input.dueAt, timestamp);
    const text = input.text.trim();
    if (text === '') throw new ValidationError('reminder_text_required', 'The reminder text is empty', {});
    return reminders.insert({
      id: newId(), application_id: application.id, job_id: application.job_id, due_at: dueAt, text, status: 'open',
      source: 'manual', created_at: timestamp, done_at: '', reminded_at: '',
    });
  }

  complete(id: string): Reminder {
    this.require(id);
    return this.deps.reminders.update(id, { status: 'done', done_at: this.deps.now() });
  }

  dismiss(id: string): Reminder {
    this.require(id);
    return this.deps.reminders.update(id, { status: 'dismissed' });
  }

  /** Moves the due date and reopens the reminder, so the daily mail can remind about it again. */
  postpone(id: string, dueAt: string): Reminder {
    this.require(id);
    const date = requireReminderDate(dueAt, this.deps.now());
    return this.deps.reminders.update(id, { status: 'open', due_at: date, done_at: '', reminded_at: '' });
  }

  listFor(applicationId: string): Reminder[] {
    return this.deps.reminders.list().filter((r) => r.application_id === applicationId).sort(byDue);
  }

  listOpen(): Reminder[] {
    return this.deps.reminders.list().filter((r) => r.status === 'open').sort(byDue);
  }

  private require(id: string): Reminder {
    const found = this.deps.reminders.get(id);
    if (!found) throw new NotFoundError('reminder_not_found', `Reminder ${id} not found`, { id });
    return found;
  }
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

/** Dashboard groups for open reminders. `today` is YYYY-MM-DD. */
export function reminderBuckets(reminders: readonly Reminder[], today: string): { overdue: Reminder[]; today: Reminder[]; soon: Reminder[] } {
  const open = reminders.filter((r) => r.status === 'open').sort(byDue);
  const limit = addDays(today, 7);
  return {
    overdue: open.filter((r) => r.due_at < today),
    today: open.filter((r) => r.due_at === today),
    soon: open.filter((r) => r.due_at > today && r.due_at <= limit),
  };
}
