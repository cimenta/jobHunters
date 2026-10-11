import {
  ApplicationService,
  SettingsService,
  SheetAppendLog,
  SheetKeyValueStore,
  SheetRepository,
  SHEETS,
  type AppWarning,
  type Application,
  type Company,
  type Job,
  type Lock,
  type LogEntry,
  type Reminder,
  type SheetGrid,
  type SheetName,
  type StatusHistoryEntry,
} from '@jobhunters/core';

export const LOG_MAX_ROWS = 1000;

export interface ContainerDeps {
  grid: (sheet: SheetName) => SheetGrid;
  lock: Lock;
  newId: () => string;
  /** ISO 8601 date-time. */
  now: () => string;
  appVersion: string;
}

export type Container = ReturnType<typeof buildContainer>;

export function buildContainer(deps: ContainerDeps) {
  const { lock } = deps;
  const found: AppWarning[] = [];
  const collect = (warnings: AppWarning[]): void => {
    found.push(...warnings);
  };
  const repository = <T extends { id: string }>(sheet: SheetName) =>
    new SheetRepository<T>(sheet, SHEETS[sheet], deps.grid(sheet), lock, collect);

  const companies = repository<Company>('Companies');
  const jobs = repository<Job>('Jobs');
  const applications = repository<Application>('Applications');
  const reminders = repository<Reminder>('Reminders');
  const history = new SheetAppendLog<StatusHistoryEntry>('StatusHistory', SHEETS.StatusHistory, deps.grid('StatusHistory'), lock);
  const logSheet = new SheetAppendLog<LogEntry>('Log', SHEETS.Log, deps.grid('Log'), lock, LOG_MAX_ROWS);
  const settings = new SettingsService(new SheetKeyValueStore('Settings', deps.grid('Settings'), lock, collect), lock);

  const applicationService = new ApplicationService({
    applications,
    reminders,
    history,
    newId: deps.newId,
    now: deps.now,
    locale: () => settings.get().settings.ui_language,
  });

  return {
    appVersion: deps.appVersion,
    lock,
    companies,
    jobs,
    applications,
    reminders,
    settings,
    applicationService,
    log: (flow: string, entity: string, message: string): void => {
      logSheet.append({ time: deps.now(), flow, entity, message });
    },
    logEntries: (): LogEntry[] => logSheet.list(),
    /** Reads every entity sheet and returns what is wrong with rows edited outside the app. */
    collectWarnings: (): AppWarning[] => {
      found.length = 0;
      companies.list();
      jobs.list();
      applications.list();
      reminders.list();
      settings.get();
      const seen = new Set<string>();
      return found.splice(0).filter((w) => {
        const key = JSON.stringify(w);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
  };
}
