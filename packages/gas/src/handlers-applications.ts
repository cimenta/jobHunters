import {
  NotFoundError,
  PROFILE_KEYS,
  applicationRows,
  buildDashboard,
  buildTimeline,
  companyRows,
  jobRows,
  reminderBuckets,
  type CommunicationInput,
} from '@jobhunters/core';
import type { Handler } from './api';
import { asRecord, invalidArguments, optionalBoolean, optionalNumber, optionalString, requireString, stringRecord } from './args';
import type { Container } from './container';

const COMMUNICATION_FIELDS = ['direction', 'channel', 'summary', 'details', 'datetime', 'contactId', 'attachmentUrl'] as const;

function communicationPatch(input: Record<string, unknown>, method: string): Partial<Omit<CommunicationInput, 'applicationId'>> {
  const patch: Partial<Omit<CommunicationInput, 'applicationId'>> = {};
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
      return c.lock.run(() => c.applicationFactory.create({ jobId, language, fromApplicationId }));
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

    listApplications: () => applicationRows(c.applications.list(), c.jobs.list(), c.companies.list()),

    listJobs: () => jobRows(c.jobs.list(), c.companies.list(), c.applications.list()),

    getJob: (args) => {
      const id = requireString(asRecord(args, 'getJob'), 'id', 'getJob');
      const job = c.jobs.get(id);
      if (!job) throw new NotFoundError('job_not_found', `Job ${id} not found`, { id });
      const applications = applicationRows(c.applications.list().filter((a) => a.job_id === id), [job], c.companies.list());
      return { job, company: c.companies.get(job.company_id), applications, match: c.aiTaskService.matchFor(id) };
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
      return c.lock.run(() => c.catalogService.updateJob(id, { notes, is_gig: isGig }));
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
        today: c.now().slice(0, 10),
      }),

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
      const maxLength = optionalNumber(input, 'maxLength', 'addQuestion');
      return c.lock.run(() => c.questionService.add(applicationId, { question, maxLength }));
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
      const maxLength = optionalNumber(input, 'maxLength', 'updateQuestion');
      return c.lock.run(() => c.questionService.update(id, { question, maxLength }));
    },

    removeQuestion: (args) => {
      const id = requireString(asRecord(args, 'removeQuestion'), 'id', 'removeQuestion');
      return c.lock.run(() => c.questionService.remove(id));
    },

    addCommunication: (args) => {
      const input = asRecord(args, 'addCommunication');
      const applicationId = requireString(input, 'applicationId', 'addCommunication');
      const direction = requireString(input, 'direction', 'addCommunication');
      const channel = requireString(input, 'channel', 'addCommunication');
      const summary = requireString(input, 'summary', 'addCommunication');
      const rest = communicationPatch(input, 'addCommunication');
      return c.lock.run(() => c.communicationService.add({ ...rest, applicationId, direction, channel, summary }));
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
