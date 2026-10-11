import { hasOwn } from './util';

export interface FolderRef {
  id: string;
  url: string;
}
export interface FileRef {
  id: string;
  url: string;
}

/** Drive and Docs as the app needs them. The Apps Script implementation lives in packages/gas. */
export interface DriveGateway {
  /** Finds or creates the child folder `name`; `null` parent means the root of My Drive. */
  ensureFolder(parentId: string | null, name: string): FolderRef;
  copyDocument(templateDocId: string, name: string, folderId: string): FileRef;
  /** Replaces every {{key}} with the value, literally. */
  replaceInDocument(docId: string, values: Record<string, string>): void;
  exportPdf(docId: string, folderId: string, name: string): FileRef;
  exportHtml(docId: string): string;
  /** Creates a text file in the folder and returns it. */
  saveTextFile(folderId: string, name: string, content: string, mimeType: string): FileRef;
  /** ISO date-time of the last edit of the document. */
  lastModified(docId: string): string;
}

export function sanitizeFolderName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
    .trim();
  return cleaned === '' ? 'Untitled' : cleaned;
}

export function ensureFolderPath(drive: DriveGateway, root: FolderRef, segments: readonly string[]): FolderRef {
  let current = root;
  for (const segment of segments) current = drive.ensureFolder(current.id, sanitizeFolderName(segment));
  return current;
}

export function fillPlaceholders(text: string, values: Readonly<Record<string, string>>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (hasOwn(values, key) ? values[key]! : match));
}
