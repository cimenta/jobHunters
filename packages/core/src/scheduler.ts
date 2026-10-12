import type { KeyValueStore } from './key-value';

/** One thing the hourly trigger may start, e.g. the availability check or, later, the daily e-mail. */
export interface ScheduledTask {
  id: string;
  enabled(): boolean;
  /** Hours of the day (0-23) at which the task runs. */
  hours(): readonly number[];
  run(): void;
}

/** The current hour in the time zone of the script. */
export interface HourSlot {
  /** YYYY-MM-DD. */
  day: string;
  hour: number;
}

export interface SchedulerDeps {
  tasks: readonly ScheduledTask[];
  /** Remembers when each task last started, so it runs once in its hour although the trigger fires every hour. */
  lastRun: KeyValueStore;
  log: (flow: string, entity: string, message: string) => void;
}

const lastRunKey = (id: string): string => `SCHEDULE_LAST_${id}`;
const slotText = (slot: HourSlot): string => `${slot.day}T${String(slot.hour).padStart(2, '0')}`;

export class Scheduler {
  constructor(private readonly deps: SchedulerDeps) {}

  /** Starts the tasks whose hour it is and that have not run in this hour yet. Returns the ids it started. */
  tick(slot: HourSlot): string[] {
    const { tasks, lastRun, log } = this.deps;
    const started: string[] = [];
    for (const task of tasks) {
      try {
        if (!task.enabled() || !task.hours().includes(slot.hour)) continue;
        if (lastRun.getAll()[lastRunKey(task.id)] === slotText(slot)) continue;
        lastRun.set(lastRunKey(task.id), slotText(slot));
        started.push(task.id);
        task.run();
      } catch (error) {
        log('schedule', task.id, error instanceof Error ? error.message : String(error));
      }
    }
    return started;
  }
}
