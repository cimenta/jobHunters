import { ensureFolderPath, fileIdFromUrl, type DriveGateway, type FolderRef } from '../drive';
import { NotFoundError, ValidationError } from '../errors';
import { isLocale, t, type Locale } from '../i18n';
import { buildLabel } from '../label';
import type { AppendLog, Repository } from '../repository';
import type { AppWarning } from '../row-codec';
import type { Settings } from '../settings';
import { jobStatusOnApplication } from '../job-lifecycle';
import { INACTIVE_APPLICATION_STATUSES } from '../status';
import type { Application, ApplicationDocument, Company, Job, StatusHistoryEntry, Template } from '../types';
import { buildPlaceholders } from './placeholders';
import { findTemplate } from './templates';

const UNKNOWN_COMPANY = 'Unknown company';

export interface ApplicationFactoryDeps {
  jobs: Repository<Job>;
  companies: Repository<Company>;
  applications: Repository<Application>;
  documents: Repository<ApplicationDocument>;
  templates: Repository<Template>;
  history: AppendLog<StatusHistoryEntry>;
  drive: DriveGateway;
  rootFolder: () => FolderRef;
  /** Profile sheet as key -> value. */
  profile: () => Readonly<Record<string, string>>;
  settings: () => Settings;
  newId: () => string;
  /** ISO 8601 date-time. */
  now: () => string;
  /** Reports a swallowed failure to the Log. */
  onError?: (where: string, error: unknown) => void;
}

export interface CreateApplicationInput {
  jobId: string;
  /** en or cs; defaults to Settings.default_document_language. */
  language?: string;
  /** "Apply again": copy the documents of this earlier application instead of using templates. */
  fromApplicationId?: string;
  /** The salary the user asks for, free text; kept up to MAX_ASKED_SALARY characters. */
  salary?: string;
}

export interface CreateApplicationResult {
  application: Application;
  documents: ApplicationDocument[];
  warnings: AppWarning[];
}

/** Longest salary text kept; a cell holds far more, this only stops a pasted page. */
export const MAX_ASKED_SALARY = 200;

export function documentName(type: string, label: string, language: Locale): string {
  return `${t(`document.type.${type}`, {}, language)} – ${label}`;
}

const asLocale = (value: string): Locale => (isLocale(value) ? value : 'en');

export class ApplicationFactory {
  constructor(private readonly deps: ApplicationFactoryDeps) {}

  create(input: CreateApplicationInput): CreateApplicationResult {
    const { jobs, companies, applications, documents, templates, history, drive, rootFolder, newId, now } = this.deps;
    const job = jobs.get(input.jobId);
    if (!job) throw new NotFoundError('job_not_found', `Job ${input.jobId} not found`, { id: input.jobId });

    if (job.status === 'awaiting') throw new ValidationError('job_awaiting', `Job ${job.id} is waiting for the AI`, { id: job.id });

    const settings = this.deps.settings();
    const language = input.language ?? settings.default_document_language;
    if (!isLocale(language)) throw new ValidationError('language_invalid', `Unsupported language ${language}`, { language });

    let previous: Application | undefined;
    if (input.fromApplicationId !== undefined) {
      previous = applications.get(input.fromApplicationId);
      if (!previous) throw new NotFoundError('application_not_found', `Application ${input.fromApplicationId} not found`, { id: input.fromApplicationId });
      if (previous.job_id !== job.id) {
        throw new ValidationError('application_job_mismatch', `Application ${previous.id} belongs to another job`, { id: previous.id });
      }
    }

    const company = companies.get(job.company_id);
    const companyName = company?.name || UNKNOWN_COMPANY;
    const siblings = applications.list().filter((application) => application.job_id === job.id);
    const attempt = siblings.reduce((max, application) => Math.max(max, application.attempt), 0) + 1;
    const timestamp = now();
    const label = buildLabel({ company: companyName, title: job.title, attempt, date: timestamp });

    const warnings: AppWarning[] = [];
    const active = siblings.find((application) => !INACTIVE_APPLICATION_STATUSES.includes(application.status));
    if (active) warnings.push({ code: 'active_application_exists', params: { id: active.id } });

    // Folder first: if Drive fails here nothing has been written yet.
    const folder = ensureFolderPath(drive, rootFolder(), ['Companies', companyName, job.title, label]);
    const application = applications.insert({
      id: newId(),
      job_id: job.id,
      attempt,
      label,
      language,
      status: 'draft',
      applied_at: '',
      last_activity_at: timestamp,
      snapshot_used: '',
      folder_url: folder.url,
      notes: '',
      salary: (input.salary ?? '').trim().slice(0, MAX_ASKED_SALARY),
      board_position: null,
    });
    history.append({ application_id: application.id, from: '', to: 'draft', at: timestamp });
    // A new ad (or an archived one the user applies for again) becomes applied.
    const jobStatus = jobStatusOnApplication(settings.job_status_styles, job.status);
    if (jobStatus !== undefined) jobs.update(job.id, { status: jobStatus });

    const created: ApplicationDocument[] = [];
    const tryCreate = (type: string, build: () => ApplicationDocument): void => {
      try {
        created.push(build());
      } catch (error) {
        this.report('document', error);
        warnings.push({ code: 'document_create_failed', params: { type } });
      }
    };

    if (previous) {
      const source = previous;
      for (const old of documents.list().filter((doc) => doc.application_id === source.id)) {
        tryCreate(old.type, () => {
          const copy = drive.copyDocument(fileIdFromUrl(old.doc_url), documentName(old.type, label, language), folder.id);
          return documents.insert({
            id: newId(), application_id: application.id, type: old.type, doc_url: copy.url, pdf_url: '',
            template_id: old.template_id, created_at: timestamp, pdf_exported_at: '',
          });
        });
      }
    } else {
      const all = templates.list();
      for (const type of settings.default_document_set) {
        const template = findTemplate(all, type, language);
        if (!template) {
          // No template: the document is still created, just empty, so the application always has its documents.
          warnings.push({ code: 'template_missing', params: { type, language } });
          tryCreate(type, () => this.createBlank(type, application, folder, timestamp));
          continue;
        }
        tryCreate(type, () => this.instantiate(template, application, job, company, folder, timestamp));
      }
    }

    return { application, documents: created, warnings };
  }

  /** The "+ Dokument" button: one more document from a template, errors are reported to the caller. */
  addDocument(applicationId: string, templateId: string): ApplicationDocument {
    const { applications, jobs, companies, templates, now } = this.deps;
    const application = applications.get(applicationId);
    if (!application) throw new NotFoundError('application_not_found', `Application ${applicationId} not found`, { id: applicationId });
    const template = templates.get(templateId);
    if (!template) throw new NotFoundError('template_not_found', `Template ${templateId} not found`, { id: templateId });
    const job = jobs.get(application.job_id);
    if (!job) throw new NotFoundError('job_not_found', `Job ${application.job_id} not found`, { id: application.job_id });
    const folderId = fileIdFromUrl(application.folder_url);
    if (folderId === '') {
      throw new ValidationError('application_folder_missing', `Application ${applicationId} has no folder`, { id: applicationId });
    }
    const timestamp = now();
    const document = this.instantiate(
      template, application, job, companies.get(job.company_id), { id: folderId, url: application.folder_url }, timestamp,
    );
    applications.update(applicationId, { last_activity_at: timestamp });
    return document;
  }

  private createBlank(type: string, application: Application, folder: FolderRef, timestamp: string): ApplicationDocument {
    const { drive, documents, newId } = this.deps;
    const name = documentName(type, application.label, asLocale(application.language));
    const created = drive.createDocument(name, folder.id);
    return documents.insert({
      id: newId(), application_id: application.id, type, doc_url: created.url, pdf_url: '',
      template_id: '', created_at: timestamp, pdf_exported_at: '',
    });
  }

  private instantiate(
    template: Template,
    application: Application,
    job: Job,
    company: Company | undefined,
    folder: FolderRef,
    timestamp: string,
  ): ApplicationDocument {
    const { drive, documents, newId } = this.deps;
    const name = documentName(template.type, application.label, asLocale(application.language));
    const copy = drive.copyDocument(fileIdFromUrl(template.doc_url), name, folder.id);
    drive.replaceInDocument(copy.id, buildPlaceholders({ profile: this.deps.profile(), company, job, today: timestamp.slice(0, 10) }));
    return documents.insert({
      id: newId(), application_id: application.id, type: template.type, doc_url: copy.url, pdf_url: '',
      template_id: template.id, created_at: timestamp, pdf_exported_at: '',
    });
  }

  private report(where: string, error: unknown): void {
    try {
      this.deps.onError?.(where, error);
    } catch {
      // Reporting must never break the flow.
    }
  }
}
