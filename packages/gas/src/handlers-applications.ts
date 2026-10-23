import {
  AppError,
  MIN_SEARCH_LENGTH,
  NotFoundError,
  SEARCH_TYPES,
  searchAll,
  type AiTaskRow,
  type Email,
  type SearchType,
  PROFILE_KEYS,
  applicationRows,
  buildDashboard,
  buildMenuCounts,
  buildJobTimeline,
  buildTimeline,
  companyRows,
  emailRows,
  jobRows,
  reminderBuckets,
  type CommunicationInput,
} from '@jobhunters/core';
import type { Handler } from './api';
import { asRecord, invalidArguments, optionalBoolean, optionalNumber, optionalString, requireString, stringRecord } from './args';
import type { Container } from './container';

const COMMUNICATION_FIELDS = ['kind', 'direction', 'channel', 'summary', 'details', 'datetime', 'contactId', 'attachmentUrl'] as const;

function communicationPatch(input: Record<string, unknown>, method: string): Partial<Omit<CommunicationInput, 'applicationId' | 'jobId'>> {
  const patch: Partial<Omit<CommunicationInput, 'applicationId' | 'jobId'>> = {};
  for (const field of COMMUNICATION_FIELDS) {
    const value = optionalString(input, field, method);
    if (value !== undefined) patch[field] = value;
  }
  return patch;
}

export function createApplicationHandlers(c: Container): Record<string, Handler> {
  const today = (): string => c.now().slice(0, 10);
  const profile = (): Record<string, string> => {
    const stored = c.profile.getAll();
    return Object.fromEntries(PROFILE_KEYS.map((key) => [key, Object.prototype.hasOwnProperty.call(stored, key) ? stored[key]! : '']));
  };

  return {
    getProfile: () => profile(),

    updateProfile: (args) => {
      const patch = stringRecord(args, 'updateProfile');
      for (const key of Object.keys(patch)) {
        if (!(PROFILE_KEYS as readonly string[]).includes(key)) invalidArguments('updateProfile');
      }
      return c.lock.run(() => {
        for (const [key, value] of Object.entries(patch)) c.profile.set(key, value);
        return profile();
      });
    },

    createTestJob: () => c.lock.run(() => c.testDataService.createJob()),
    createTestJobWithApplication: () => c.lock.run(() => c.testDataService.createJobWithApplication()),

    listTemplates: () => c.templateService.list(),

    addTemplate: (args) => {
      const input = asRecord(args, 'addTemplate');
      const template = {
        type: requireString(input, 'type', 'addTemplate'),
        language: optionalString(input, 'language', 'addTemplate') ?? '',
        name: requireString(input, 'name', 'addTemplate'),
        docUrl: requireString(input, 'docUrl', 'addTemplate'),
      };
      return c.lock.run(() => c.templateService.add(template));
    },

    createApplication: (args) => {
      const input = asRecord(args, 'createApplication');
      const jobId = requireString(input, 'jobId', 'createApplication');
      const language = optionalString(input, 'language', 'createApplication');
      const fromApplicationId = optionalString(input, 'fromApplicationId', 'createApplication');
      const salary = optionalString(input, 'salary', 'createApplication');
      return c.lock.run(() => c.applicationFactory.create({ jobId, language, fromApplicationId, salary }));
    },

    updateApplication: (args) => {
      const input = asRecord(args, 'updateApplication');
      const id = requireString(input, 'id', 'updateApplication');
      const salary = optionalString(input, 'salary', 'updateApplication');
      const interviewPrep = optionalString(input, 'interview_prep', 'updateApplication');
      return c.lock.run(() => c.catalogService.updateApplication(id, { salary, interview_prep: interviewPrep }));
    },

    prepareApplication: (args) => {
      const jobId = requireString(asRecord(args, 'prepareApplication'), 'jobId', 'prepareApplication');
      return c.lock.run(() => c.applicationPreparer.prepare(jobId));
    },

    deleteApplication: (args) => {
      const input = asRecord(args, 'deleteApplication');
      const id = requireString(input, 'id', 'deleteApplication');
      const trashFolder = optionalBoolean(input, 'trashFolder', 'deleteApplication') ?? false;
      return c.lock.run(() => c.applicationRemover.remove(id, { trashFolder }));
    },

    addApplicationDocument: (args) => {
      const input = asRecord(args, 'addApplicationDocument');
      const applicationId = requireString(input, 'applicationId', 'addApplicationDocument');
      const templateId = requireString(input, 'templateId', 'addApplicationDocument');
      return c.lock.run(() => c.applicationFactory.addDocument(applicationId, templateId));
    },

    listApplications: () => applicationRows(c.applications.list(), c.jobs.list(), c.companies.list(), c.history.list()),

    listJobs: () => jobRows(c.jobs.list(), c.companies.list(), c.applications.list(), c.tasks.list()),

    getJob: (args) => {
      const id = requireString(asRecord(args, 'getJob'), 'id', 'getJob');
      const job = c.jobs.get(id);
      if (!job) throw new NotFoundError('job_not_found', `Job ${id} not found`, { id });
      const own = c.applications.list().filter((a) => a.job_id === id);
      const applications = applicationRows(own, [job], c.companies.list());
      // The entries kept on the job itself and the ones of its applications, with the timeline of all of them.
      const communications = c.communicationService.listForJob(id, own.map((a) => a.id));
      const timeline = buildJobTimeline({
        jobId: id,
        applications: own,
        history: c.history.list(),
        communications,
        documents: own.flatMap((a) => c.documentService.list(a.id)),
        reminders: own.flatMap((a) => c.reminderService.listFor(a.id)),
      });
      return { job, company: c.companies.get(job.company_id), applications, match: c.aiTaskService.matchFor(id), communications, timeline };
    },

    checkJobAvailability: (args) => {
      const id = requireString(asRecord(args, 'checkJobAvailability'), 'id', 'checkJobAvailability');
      return c.availabilityService.check(id);
    },

    refreshJob: (args) => {
      const id = requireString(asRecord(args, 'refreshJob'), 'id', 'refreshJob');
      return c.lock.run(() => c.jobService.refresh(id));
    },

    requestJobMatch: (args) => {
      const id = requireString(asRecord(args, 'requestJobMatch'), 'id', 'requestJobMatch');
      return c.lock.run(() => c.aiTaskService.requestMatch(id));
    },

    requestDocumentAi: (args) => {
      const input = asRecord(args, 'requestDocumentAi');
      const documentId = requireString(input, 'documentId', 'requestDocumentAi');
      const notes = optionalString(input, 'notes', 'requestDocumentAi') ?? '';
      return c.lock.run(() => c.aiTaskService.requestDocument(documentId, notes));
    },

    requestQuestionAi: (args) => {
      const input = asRecord(args, 'requestQuestionAi');
      const questionId = requireString(input, 'questionId', 'requestQuestionAi');
      const notes = optionalString(input, 'notes', 'requestQuestionAi') ?? '';
      return c.lock.run(() => c.aiTaskService.requestQuestion(questionId, notes));
    },

    requestQuestionsAi: (args) => {
      const applicationId = requireString(asRecord(args, 'requestQuestionsAi'), 'applicationId', 'requestQuestionsAi');
      return c.lock.run(() => c.aiTaskService.requestOpenQuestions(applicationId));
    },

    importJob: (args) => {
      const url = requireString(asRecord(args, 'importJob'), 'url', 'importJob');
      return c.lock.run(() => c.jobImportService.importOne(url));
    },

    importAiJob: (args) => {
      const input = asRecord(args, 'importAiJob');
      const url = requireString(input, 'url', 'importAiJob');
      const notes = optionalString(input, 'notes', 'importAiJob');
      return c.lock.run(() => c.jobImportService.importWithAi(url, notes ?? ''));
    },

    deleteJob: (args) => {
      const input = asRecord(args, 'deleteJob');
      const id = requireString(input, 'id', 'deleteJob');
      const trashFolder = optionalBoolean(input, 'trashFolder', 'deleteJob') ?? false;
      return c.lock.run(() => c.jobRemover.remove(id, { trashFolder }));
    },

    listAiTasks: () => c.aiTaskService.list(),

    removeAiTask: (args) => {
      const id = requireString(asRecord(args, 'removeAiTask'), 'id', 'removeAiTask');
      return c.lock.run(() => {
        c.aiTaskService.remove(id);
        return null;
      });
    },

    cancelAiTask: (args) => {
      const id = requireString(asRecord(args, 'cancelAiTask'), 'id', 'cancelAiTask');
      return c.lock.run(() => {
        c.aiTaskService.cancel(id);
        return null;
      });
    },

    updateJob: (args) => {
      const input = asRecord(args, 'updateJob');
      const id = requireString(input, 'id', 'updateJob');
      const notes = optionalString(input, 'notes', 'updateJob');
      const isGig = optionalBoolean(input, 'is_gig', 'updateJob');
      const isRemote = optionalBoolean(input, 'is_remote', 'updateJob');
      const isHybrid = optionalBoolean(input, 'is_hybrid', 'updateJob');
      const contactPerson = optionalString(input, 'contact_person', 'updateJob');
      const noReason = optionalString(input, 'no_reason', 'updateJob');
      const gigShift = optionalString(input, 'gig_shift', 'updateJob');
      const location = optionalString(input, 'location', 'updateJob');
      const url = optionalString(input, 'url', 'updateJob');
      const status = optionalString(input, 'status', 'updateJob');
      return c.lock.run(() => c.catalogService.updateJob(id, { notes, is_gig: isGig, is_remote: isRemote, is_hybrid: isHybrid, contact_person: contactPerson, no_reason: noReason, gig_shift: gigShift, location, url, status }));
    },

    saveJobStatuses: (args) => {
      const input = asRecord(args, 'saveJobStatuses');
      return c.lock.run(() => c.jobStatusService.save(input.styles));
    },

    /**
     * One search over companies, jobs, applications, e-mails and AI tasks (see searchAll). The sheets are read only for
     * the types asked for, and a missing sheet Emails just leaves that group empty.
     */
    search: (args) => {
      const input = asRecord(args, 'search');
      const query = optionalString(input, 'query', 'search') ?? '';
      const limit = optionalNumber(input, 'limit', 'search');
      let types: SearchType[] | undefined;
      if (input.types !== undefined) {
        if (!Array.isArray(input.types) || !input.types.every((type) => (SEARCH_TYPES as readonly unknown[]).includes(type))) invalidArguments('search');
        types = input.types as SearchType[];
      }
      const wants = (type: SearchType): boolean => types === undefined || types.includes(type);
      const empty = { companies: [], jobs: [], applications: [], emails: undefined, tasks: [] };
      if (query.trim().length < MIN_SEARCH_LENGTH) return searchAll(empty, query);
      const base = wants('companies') || wants('jobs') || wants('applications') || wants('tasks');
      const companies = base ? c.companies.list() : [];
      const jobs = base ? c.jobs.list() : [];
      const names = new Map(companies.map((company) => [company.id, company.name]));
      const jobOf = new Map(jobs.map((job) => [job.id, job]));
      const tasks: AiTaskRow[] = wants('tasks')
        ? c.tasks.list().map((task) => ({ ...task, job_title: jobOf.get(task.job_id)?.title ?? '', company_name: names.get(jobOf.get(task.job_id)?.company_id ?? '') ?? '' }))
        : [];
      let emails: Email[] | undefined;
      if (wants('emails')) {
        try {
          emails = c.emails.list();
        } catch (error) {
          if (!(error instanceof AppError && error.code === 'sheet_missing')) throw error;
        }
      }
      return searchAll(
        { companies, jobs, applications: wants('companies') || wants('applications') ? c.applications.list() : [], emails, tasks },
        query,
        { limit: limit ?? undefined, types },
      );
    },

    // The sheet Emails is filled by a separate script; without it the two methods fail with sheet_missing and nothing else does.
    listEmails: () => emailRows(c.emails.list()),

    getEmail: (args) => {
      const id = requireString(asRecord(args, 'getEmail'), 'id', 'getEmail');
      const email = c.emails.get(id);
      if (!email) throw new NotFoundError('email_not_found', `E-mail ${id} not found`, { id });
      return email;
    },

    listCompanies: () => companyRows(c.companies.list(), c.jobs.list(), c.applications.list()),

    getCompany: (args) => {
      const id = requireString(asRecord(args, 'getCompany'), 'id', 'getCompany');
      const company = c.companies.get(id);
      if (!company) throw new NotFoundError('company_not_found', `Company ${id} not found`, { id });
      const jobs = c.jobs.list().filter((j) => j.company_id === id);
      const applications = c.applications.list().filter((a) => jobs.some((j) => j.id === a.job_id));
      return { company, jobs: jobRows(jobs, [company], applications), applications: applicationRows(applications, jobs, [company]) };
    },

    updateCompany: (args) => {
      const input = asRecord(args, 'updateCompany');
      const id = requireString(input, 'id', 'updateCompany');
      const name = optionalString(input, 'name', 'updateCompany');
      const website = optionalString(input, 'website', 'updateCompany');
      const notes = optionalString(input, 'notes', 'updateCompany');
      return c.lock.run(() => c.catalogService.updateCompany(id, { name, website, notes }));
    },

    getDashboard: () =>
      buildDashboard({
        reminders: c.reminders.list(),
        applications: c.applications.list(),
        jobs: c.jobs.list(),
        companies: c.companies.list(),
        tasks: c.tasks.list(),
        today: c.now().slice(0, 10),
      }),

    getMenuCounts: () =>
      buildMenuCounts({ jobs: c.jobs.list(), tasks: c.tasks.list(), applications: c.applications.list(), styles: c.settings.get().settings.job_status_styles }),

    getApplication: (args) => {
      const id = requireString(asRecord(args, 'getApplication'), 'id', 'getApplication');
      const application = c.applications.get(id);
      if (!application) throw new NotFoundError('application_not_found', `Application ${id} not found`, { id });
      const job = c.jobs.get(application.job_id);
      const documents = c.documentService.list(id);
      const communications = c.communicationService.listFor(id);
      const reminders = c.reminderService.listFor(id);
      return {
        application,
        job,
        company: job ? c.companies.get(job.company_id) : undefined,
        documents,
        questions: c.questionService.listFor(id),
        communications,
        reminders,
        tasks: c.aiTaskService.listForApplication(id),
        match: job ? c.aiTaskService.matchFor(job.id) : undefined,
        timeline: buildTimeline({ applicationId: id, history: c.history.list(), communications, documents, reminders }),
      };
    },

    exportDocumentPdf: (args) => {
      const id = requireString(asRecord(args, 'exportDocumentPdf'), 'id', 'exportDocumentPdf');
      return c.lock.run(() => c.documentService.exportPdf(id));
    },

    previewDocument: (args) => {
      const id = requireString(asRecord(args, 'previewDocument'), 'id', 'previewDocument');
      return { html: c.documentService.previewHtml(id) };
    },

    addQuestion: (args) => {
      const input = asRecord(args, 'addQuestion');
      const applicationId = requireString(input, 'applicationId', 'addQuestion');
      const question = requireString(input, 'question', 'addQuestion');
      const maxSentences = optionalNumber(input, 'maxSentences', 'addQuestion');
      return c.lock.run(() => c.questionService.add(applicationId, { question, maxSentences }));
    },

    answerQuestion: (args) => {
      const input = asRecord(args, 'answerQuestion');
      const id = requireString(input, 'id', 'answerQuestion');
      const answer = optionalString(input, 'answer', 'answerQuestion');
      if (answer === undefined) return invalidArguments('answerQuestion');
      return c.lock.run(() => c.questionService.answer(id, answer));
    },

    updateQuestion: (args) => {
      const input = asRecord(args, 'updateQuestion');
      const id = requireString(input, 'id', 'updateQuestion');
      const question = optionalString(input, 'question', 'updateQuestion');
      const maxSentences = optionalNumber(input, 'maxSentences', 'updateQuestion');
      return c.lock.run(() => c.questionService.update(id, { question, maxSentences }));
    },

    removeQuestion: (args) => {
      const id = requireString(asRecord(args, 'removeQuestion'), 'id', 'removeQuestion');
      return c.lock.run(() => c.questionService.remove(id));
    },

    addCommunication: (args) => {
      const input = asRecord(args, 'addCommunication');
      const direction = requireString(input, 'direction', 'addCommunication');
      const rest = communicationPatch(input, 'addCommunication');
      // An entry belongs to an application, or to a job that has none (a gig).
      const jobId = optionalString(input, 'jobId', 'addCommunication');
      if (jobId !== undefined && jobId !== '') return c.lock.run(() => c.communicationService.add({ ...rest, jobId, direction }));
      const applicationId = requireString(input, 'applicationId', 'addCommunication');
      return c.lock.run(() => c.communicationService.add({ ...rest, applicationId, direction }));
    },

    updateCommunication: (args) => {
      const input = asRecord(args, 'updateCommunication');
      const id = requireString(input, 'id', 'updateCommunication');
      const patch = communicationPatch(input, 'updateCommunication');
      return c.lock.run(() => c.communicationService.update(id, patch));
    },

    removeCommunication: (args) => {
      const id = requireString(asRecord(args, 'removeCommunication'), 'id', 'removeCommunication');
      return c.lock.run(() => c.communicationService.remove(id));
    },

    addReminder: (args) => {
      const input = asRecord(args, 'addReminder');
      const applicationId = requireString(input, 'applicationId', 'addReminder');
      const dueAt = requireString(input, 'dueAt', 'addReminder');
      const text = requireString(input, 'text', 'addReminder');
      return c.lock.run(() => c.reminderService.add({ applicationId, dueAt, text }));
    },

    completeReminder: (args) => {
      const id = requireString(asRecord(args, 'completeReminder'), 'id', 'completeReminder');
      return c.lock.run(() => c.reminderService.complete(id));
    },

    dismissReminder: (args) => {
      const id = requireString(asRecord(args, 'dismissReminder'), 'id', 'dismissReminder');
      return c.lock.run(() => c.reminderService.dismiss(id));
    },

    postponeReminder: (args) => {
      const input = asRecord(args, 'postponeReminder');
      const id = requireString(input, 'id', 'postponeReminder');
      const dueAt = requireString(input, 'dueAt', 'postponeReminder');
      return c.lock.run(() => c.reminderService.postpone(id, dueAt));
    },

    listReminders: () => {
      const reminders = c.reminderService.listOpen();
      return { reminders, buckets: reminderBuckets(reminders, today()) };
    },
  };
}
