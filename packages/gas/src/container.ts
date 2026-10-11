import {
  AiTaskService,
  ApplicationFactory,
  ApplicationRemover,
  ApplicationService,
  CatalogService,
  CommunicationService,
  DocumentService,
  JobService,
  QuestionService,
  ReminderService,
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
  type DriveGateway,
  type FolderRef,
  type Job,
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

export const LOG_MAX_ROWS = 1000;

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
  const settings = new SettingsService(new SheetKeyValueStore('Settings', deps.grid('Settings'), lock, collect), lock);

  const applicationService = new ApplicationService({
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
  const documentService = new DocumentService({ documents, applications, drive: deps.drive, now: deps.now });
  const questionService = new QuestionService({ questions, applications, newId: deps.newId, now: deps.now });
  const communicationService = new CommunicationService({ communications, applications, newId: deps.newId, now: deps.now });
  const reminderService = new ReminderService({ reminders, applications, newId: deps.newId, now: deps.now });
  const catalogService = new CatalogService({ jobs, companies });
  const aiTaskService = new AiTaskService({
    tasks, jobs, companies, documents, questions, applications, newId: deps.newId, now: deps.now,
    experience: () => settings.get().settings.candidate_experience,
    language: () => settings.get().settings.ui_language,
  });

  return {
    appVersion: deps.appVersion,
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
    templates,
    profile,
    settings,
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
    aiTaskService,
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
