import type { AiTask, AiTaskRow, RemoveResult, Settings } from '@jobhunters/core';
import { call } from './client';
import type {
  AppInfo, ApplicationDetail, ApplicationRow, ApplicationDocument, AppWarning, Communication, Company, CompanyDetail, CompanyRow,
  CreateApplicationResult, Dashboard, DocumentView, Job, JobDetail, JobPreview, JobRow, Profile, Question, Reminder, SaveResult, Template,
} from './types';

export type JobOverrides = Partial<{
  title: string; company: string; location: string; salary_min: number | null; salary_max: number | null; salary_currency: string;
  salary_period: string; employment_type: string; is_gig: boolean; remote: string; description: string; language: string; notes: string;
}>;

export interface CommunicationInput {
  direction: string;
  channel: string;
  summary: string;
  details?: string;
  datetime?: string;
}

/** One function per API method of the backend, so screens never spell method names. */
export const api = {
  getAppInfo: () => call<AppInfo>('getAppInfo'),
  getSettings: () => call<{ settings: Settings; warnings: AppWarning[] }>('getSettings'),
  updateSettings: (patch: Record<string, string>) => call<Settings>('updateSettings', patch),
  getProfile: () => call<Profile>('getProfile'),
  updateProfile: (patch: Partial<Profile>) => call<Profile>('updateProfile', patch),
  listTemplates: () => call<Template[]>('listTemplates'),
  addTemplate: (input: { type: string; language: string; name: string; docUrl: string }) => call<Template>('addTemplate', input),

  getDashboard: () => call<Dashboard>('getDashboard'),

  listJobs: () => call<JobRow[]>('listJobs'),
  getJob: (id: string) => call<JobDetail>('getJob', { id }),
  updateJob: (id: string, patch: { notes?: string; is_gig?: boolean }) => call<Job>('updateJob', { id, ...patch }),
  requestJobMatch: (id: string) => call<AiTask>('requestJobMatch', { id }),
  requestDocumentAi: (documentId: string, notes: string) => call<AiTask>('requestDocumentAi', { documentId, notes }),
  requestQuestionAi: (questionId: string, notes: string) => call<AiTask>('requestQuestionAi', { questionId, notes }),
  requestQuestionsAi: (applicationId: string) => call<AiTask[]>('requestQuestionsAi', { applicationId }),
  listAiTasks: () => call<AiTaskRow[]>('listAiTasks'),
  removeAiTask: (id: string) => call<null>('removeAiTask', { id }),
  cancelAiTask: (id: string) => call<null>('cancelAiTask', { id }),
  previewJob: (input: { url: string; text?: string }) => call<JobPreview>('previewJob', input),
  saveJob: (input: { url: string; text?: string; overrides?: JobOverrides }) => call<SaveResult>('saveJob', input),

  listCompanies: () => call<CompanyRow[]>('listCompanies'),
  getCompany: (id: string) => call<CompanyDetail>('getCompany', { id }),
  updateCompany: (id: string, patch: { name?: string; website?: string; notes?: string }) => call<Company>('updateCompany', { id, ...patch }),

  listApplications: () => call<ApplicationRow[]>('listApplications'),
  getApplication: (id: string) => call<ApplicationDetail>('getApplication', { id }),
  createApplication: (input: { jobId: string; language?: string; fromApplicationId?: string }) => call<CreateApplicationResult>('createApplication', input),
  setApplicationStatus: (id: string, to: string, remindAt?: string) => call<unknown>('setApplicationStatus', remindAt === undefined ? { id, to } : { id, to, remindAt }),

  deleteApplication: (id: string, trashFolder: boolean) => call<RemoveResult>('deleteApplication', { id, trashFolder }),
  addApplicationDocument: (applicationId: string, templateId: string) => call<ApplicationDocument>('addApplicationDocument', { applicationId, templateId }),
  exportDocumentPdf: (id: string) => call<DocumentView>('exportDocumentPdf', { id }),
  previewDocument: (id: string) => call<{ html: string }>('previewDocument', { id }),

  addQuestion: (applicationId: string, question: string, maxSentences?: number | null) => call<Question>('addQuestion', { applicationId, question, maxSentences }),
  answerQuestion: (id: string, answer: string) => call<Question>('answerQuestion', { id, answer }),
  updateQuestion: (id: string, patch: { question?: string; maxSentences?: number | null }) => call<Question>('updateQuestion', { id, ...patch }),
  removeQuestion: (id: string) => call<null>('removeQuestion', { id }),

  addCommunication: (applicationId: string, input: CommunicationInput) => call<Communication>('addCommunication', { applicationId, ...input }),
  updateCommunication: (id: string, patch: Partial<CommunicationInput>) => call<Communication>('updateCommunication', { id, ...patch }),
  removeCommunication: (id: string) => call<null>('removeCommunication', { id }),

  addReminder: (applicationId: string, dueAt: string, text: string) => call<Reminder>('addReminder', { applicationId, dueAt, text }),
  completeReminder: (id: string) => call<Reminder>('completeReminder', { id }),
  dismissReminder: (id: string) => call<Reminder>('dismissReminder', { id }),
  postponeReminder: (id: string, dueAt: string) => call<Reminder>('postponeReminder', { id, dueAt }),
};
