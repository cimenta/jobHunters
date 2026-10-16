import {
  AiTaskService,
  ApplicationFactory,
  ApplicationPreparer,
  ApplicationRemover,
  ApplicationService,
  AvailabilityService,
  CatalogService,
  CommunicationService,
  DocumentService,
  HistoryService,
  InMemoryKeyValueStore,
  JobImportService,
  JobRemover,
  JobService,
  JobStatusMigration, JobStatusService, TestDataService,
  QuestionService,
  ReminderService,
  Scheduler,
  TemplateService,
  SettingsService,
  SheetAppendLog,
  SheetKeyValueStore,
  SheetRepository,
  SHEETS,
  type AiTask,
  type AppWarning,
  type Application,
  type ApplicationDocument,
  type Communication,
  type Company,
  type Email,
  type DriveGateway,
  type FolderRef,
  type HistoryEntry,
  type Job,
  type KeyValueStore,
  type Lock,
  type LogEntry,
  type PageFetcher,
  type Question,
  type Reminder,
  type SheetGrid,
  type SheetName,
  type StatusHistoryEntry,
  type Template,
} from '@jobhunters/core';

import type { SetupResult, SetupStatus } from './setup-report';
export const LOG_MAX_ROWS = 1000;
/** Time one scheduled availability run may take; Apps Script stops a run after 6 minutes. */
export const AVAILABILITY_BUDGET_MS = 5 * 60 * 1000;

export interface ContainerDeps {
  grid: (sheet: SheetName) => SheetGrid;
  lock: Lock;
  newId: () => string;
  /** ISO 8601 date-time. */
  now: () => string;
  appVersion: string;
  fetcher: PageFetcher;
  drive: DriveGateway;
  rootFolder: () => FolderRef;
  /** Time zone of the script; the GUI shows every time in it. */
  timeZone?: () => string;
  /** Milliseconds, for time budgets. */
  clock?: () => number;
  /** Where the scheduler remembers when each task last ran. */
  schedulerState?: KeyValueStore;
  /** Runs setup() and returns its log lines and verdict (the Settings button). Absent where setup cannot run. */
  runSetup?: () => SetupResult;
  /** Read-only check of whether setup() still has something to create. Absent where it cannot be asked. */
  setupStatus?: () => SetupStatus;
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
  const tasks = repository<AiTask>('Tasks');
  const documents = repository<ApplicationDocument>('Documents');
  const questions = repository<Question>('Questions');
  const communications = repository<Communication>('Communications');
  const templates = repository<Template>('Templates');
  const profile = new SheetKeyValueStore('Profile', deps.grid('Profile'), lock, collect);
  const history = new SheetAppendLog<StatusHistoryEntry>('StatusHistory', SHEETS.StatusHistory, deps.grid('StatusHistory'), lock);
  const logSheet = new SheetAppendLog<LogEntry>('Log', SHEETS.Log, deps.grid('Log'), lock, LOG_MAX_ROWS);
  /** A grid that asks for the sheet only when it is used, so a missing optional sheet fails only its own operations. */
  const lazyGrid = (sheet: SheetName): SheetGrid => ({
    readAll: () => deps.grid(sheet).readAll(),
    writeRow: (row, values) => deps.grid(sheet).writeRow(row, values),
    appendRow: (values) => deps.grid(sheet).appendRow(values),
    deleteRows: (start, count) => deps.grid(sheet).deleteRows(start, count),
  });
  const emails = new SheetRepository<Email>('Emails', SHEETS.Emails, lazyGrid('Emails'), lock, collect);
  const historyEntries = new SheetRepository<HistoryEntry>('History', SHEETS.History, lazyGrid('History'), lock, collect);
  const historyService = new HistoryService({
    entries: historyEntries,
    maxVersions: (): number => settings.get().settings.history_max_versions,
    current: (key: string): string => settings.raw(key),
    newId: deps.newId,
    now: deps.now,
  });
  const settings: SettingsService = new SettingsService(new SheetKeyValueStore('Settings', deps.grid('Settings'), lock, collect), lock, historyService);

  const applicationService = new ApplicationService({
    transitions: () => settings.get().settings.status_transitions,
    jobs,
    jobStatusStyles: () => settings.get().settings.job_status_styles,
    applications,
    reminders,
    history,
    newId: deps.newId,
    now: deps.now,
    locale: () => settings.get().settings.ui_language,
  });

  const log = (flow: string, entity: string, message: string): void => {
    logSheet.append({ time: deps.now(), flow, entity, message });
  };
  const jobService = new JobService({
    jobs,
    companies,
    fetcher: deps.fetcher,
    drive: deps.drive,
    rootFolder: deps.rootFolder,
    newId: deps.newId,
    now: deps.now,
    onError: (where, error) => log('jobs', where, error instanceof Error ? error.message : String(error)),
  });
  const applicationFactory = new ApplicationFactory({
    jobs, companies, applications, documents, templates, history,
    drive: deps.drive,
    rootFolder: deps.rootFolder,
    profile: () => profile.getAll(),
    settings: () => settings.get().settings,
    newId: deps.newId,
    now: deps.now,
    onError: (where, error) => log('applications', where, error instanceof Error ? error.message : String(error)),
  });
  const applicationRemover = new ApplicationRemover({
    applications, documents, questions, communications, reminders,
    drive: deps.drive,
    onError: (where, error) => log('applications', where, error instanceof Error ? error.message : String(error)),
  });
  const templateService = new TemplateService(templates, deps.newId);
  const documentService = new DocumentService({ documents, applications, drive: deps.drive, jobs, companies, profileName: () => profile.getAll().name ?? '', now: deps.now });
  const questionService = new QuestionService({ questions, applications, newId: deps.newId, now: deps.now });
  const communicationService = new CommunicationService({ communications, applications, newId: deps.newId, now: deps.now });
  const reminderService = new ReminderService({ reminders, applications, newId: deps.newId, now: deps.now });
  const catalogService = new CatalogService({ jobs, applications, companies, jobStatuses: () => settings.get().settings.job_status_styles });
  const jobStatusService = new JobStatusService({ jobs, settings });
  const jobStatusMigration = new JobStatusMigration({ jobs, applications, settings });
  const testDataService = new TestDataService({ jobs, companies, factory: applicationFactory, newId: deps.newId, now: deps.now });
  const aiTaskService = new AiTaskService({
    tasks, jobs, companies, documents, questions, applications, newId: deps.newId, now: deps.now,
    experience: () => settings.get().settings.candidate_experience,
    language: () => settings.get().settings.ui_language,
    prompt: (type) => settings.get().settings[`ai_prompt_${type}`],
  });
  const applicationPreparer = new ApplicationPreparer({
    jobs, applications, factory: applicationFactory, aiTasks: aiTaskService,
    experience: () => settings.get().settings.candidate_experience,
    defaultLanguage: () => settings.get().settings.default_document_language,
  });
  const jobImportService = new JobImportService({ jobService, aiTasks: aiTaskService });
  const jobRemover = new JobRemover({
    jobs, tasks, applications,
    drive: deps.drive,
    onError: (where, error) => log('jobs', where, error instanceof Error ? error.message : String(error)),
  });
  const availabilityService = new AvailabilityService({
    jobs, applications, fetcher: deps.fetcher, now: deps.now, clock: deps.clock ?? Date.now, log,
    settings: () => {
      const s = settings.get().settings;
      return { offlineTexts: s.offline_texts, immediateRules: s.availability_immediate_rules, statusStyles: s.status_styles, jobStatusStyles: s.job_status_styles };
    },
  });
  const scheduler = new Scheduler({
    lastRun: deps.schedulerState ?? new InMemoryKeyValueStore(),
    log,
    tasks: [
      {
        id: 'availability',
        enabled: () => settings.get().settings.availability_check_enabled,
        hours: () => settings.get().settings.availability_check_hours,
        run: () => void availabilityService.checkDue(AVAILABILITY_BUDGET_MS),
      },
    ],
  });

  return {
    appVersion: deps.appVersion,
    runSetup: deps.runSetup,
    setupStatus: deps.setupStatus,
    timeZone: deps.timeZone ?? (() => 'UTC'),
    now: deps.now,
    history,
    lock,
    companies,
    jobs,
    applications,
    reminders,
    documents,
    questions,
    communications,
    emails,
    templates,
    profile,
    settings,
    historyService,
    applicationService,
    jobService,
    applicationFactory,
    applicationRemover,
    templateService,
    documentService,
    questionService,
    communicationService,
    reminderService,
    catalogService,
    jobStatusService,
    jobStatusMigration,
    testDataService,
    aiTaskService,
    applicationPreparer,
    jobImportService,
    jobRemover,
    tasks,
    availabilityService,
    scheduler,
    log,
    logEntries: (): LogEntry[] => logSheet.list(),
    /** Reads every entity sheet and returns what is wrong with rows edited outside the app. */
    collectWarnings: (): AppWarning[] => {
      found.length = 0;
      companies.list();
      jobs.list();
      applications.list();
      reminders.list();
      tasks.list();
      documents.list();
      questions.list();
      communications.list();
      templates.list();
      profile.getAll();
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
