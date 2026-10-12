import { fileIdFromUrl, sanitizeFolderName, type DriveGateway } from '../drive';
import { NotFoundError, ValidationError } from '../errors';
import { isLocale, t, type Locale } from '../i18n';
import type { Repository } from '../repository';
import type { Application, ApplicationDocument, Company, Job } from '../types';

export type DocumentView = ApplicationDocument & { pdf_stale: boolean };

export interface DocumentServiceDeps {
  documents: Repository<ApplicationDocument>;
  applications: Repository<Application>;
  drive: DriveGateway;
  jobs: Repository<Job>;
  companies: Repository<Company>;
  /** Full name from Settings → Profile; '' when not filled in. */
  profileName: () => string;
  /** ISO 8601 date-time. */
  now: () => string;
}

/**
 * The preview is shown in a sandboxed frame by the UI; this is the second line of defence. Formatting and
 * <style> survive, anything that can run code or navigate away does not.
 */
export function sanitizeDocHtml(html: string): string {
  return html
    .replace(/<(script|iframe|object|embed|noscript|form)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?(script|iframe|object|embed|noscript|form|input|button|link|meta|base)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|action|formaction|xlink:href)\s*=\s*("|')?\s*(javascript|vbscript|data:text\/html)[^"'>\s]*("|')?/gi, '$1="#"');
}

/** Name of the downloaded PDF: `<Full name> – <Type> – <Company> – <Job title>`; empty parts are left out. */
export function pdfFileName(input: { type: string; fullName: string; company: string; title: string; language: Locale }): string {
  const parts = [input.fullName, t(`document.type.${input.type}`, {}, input.language), input.company, input.title]
    .map((part) => part.trim())
    .filter((part) => part !== '');
  return sanitizeFolderName(parts.join(' – '));
}

export class DocumentService {
  constructor(private readonly deps: DocumentServiceDeps) {}

  list(applicationId: string): DocumentView[] {
    return this.deps.documents.list().filter((doc) => doc.application_id === applicationId).map((doc) => this.view(doc));
  }

  exportPdf(documentId: string): DocumentView {
    const { documents, applications, drive, jobs, companies, profileName, now } = this.deps;
    const doc = this.require(documentId);
    const application = applications.get(doc.application_id);
    if (!application) throw new NotFoundError('application_not_found', `Application ${doc.application_id} not found`, { id: doc.application_id });
    const folderId = fileIdFromUrl(application.folder_url);
    if (folderId === '') {
      throw new ValidationError('application_folder_missing', `Application ${application.id} has no folder`, { id: application.id });
    }
    const job = jobs.get(application.job_id);
    const company = job ? companies.get(job.company_id) : undefined;
    const name = pdfFileName({
      type: doc.type, fullName: profileName(), company: company?.name ?? '', title: job?.title ?? '',
      language: isLocale(application.language) ? application.language : 'en',
    });
    const pdf = drive.exportPdf(fileIdFromUrl(doc.doc_url), folderId, name);
    return this.view(documents.update(doc.id, { pdf_url: pdf.url, pdf_exported_at: now() }));
  }

  previewHtml(documentId: string): string {
    const doc = this.require(documentId);
    return sanitizeDocHtml(this.deps.drive.exportHtml(fileIdFromUrl(doc.doc_url)));
  }

  private require(documentId: string): ApplicationDocument {
    const doc = this.deps.documents.get(documentId);
    if (!doc) throw new NotFoundError('document_not_found', `Document ${documentId} not found`, { id: documentId });
    return doc;
  }

  private view(doc: ApplicationDocument): DocumentView {
    return { ...doc, pdf_stale: this.isStale(doc) };
  }

  /** A deleted or unreadable Doc must not break the list, so a failed lookup counts as "not stale". */
  private isStale(doc: ApplicationDocument): boolean {
    if (doc.pdf_url === '' || doc.pdf_exported_at === '') return false;
    try {
      return this.deps.drive.lastModified(fileIdFromUrl(doc.doc_url)) > doc.pdf_exported_at;
    } catch {
      return false;
    }
  }
}
