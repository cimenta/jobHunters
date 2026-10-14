import { AppError, type DriveGateway, type FileRef, type FolderRef } from '@jobhunters/core';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class GasDrive implements DriveGateway {
  ensureFolder(parentId: string | null, name: string): FolderRef {
    const parent = parentId === null ? DriveApp.getRootFolder() : DriveApp.getFolderById(parentId);
    // DriveApp also lists folders that are in the trash; reusing one would put new data into the trash.
    const existing = parent.getFoldersByName(name);
    let folder: GoogleAppsScript.Drive.Folder | undefined;
    while (folder === undefined && existing.hasNext()) {
      const candidate = existing.next();
      if (!candidate.isTrashed()) folder = candidate;
    }
    folder ??= parent.createFolder(name);
    return { id: folder.getId(), url: folder.getUrl() };
  }

  copyDocument(templateDocId: string, name: string, folderId: string): FileRef {
    const copy = DriveApp.getFileById(templateDocId).makeCopy(name, DriveApp.getFolderById(folderId));
    return { id: copy.getId(), url: copy.getUrl() };
  }

  trashFolder(folderId: string): void {
    DriveApp.getFolderById(folderId).setTrashed(true);
  }

  listChildren(folderId: string): { folders: string[]; files: number } {
    const folder = DriveApp.getFolderById(folderId);
    const folders: string[] = [];
    const subfolders = folder.getFolders();
    while (subfolders.hasNext()) {
      const child = subfolders.next();
      if (!child.isTrashed()) folders.push(child.getName());
    }
    let files = 0;
    const children = folder.getFiles();
    while (children.hasNext()) {
      if (!children.next().isTrashed()) files += 1;
    }
    return { folders, files };
  }

  createDocument(name: string, folderId: string): FileRef {
    const document = DocumentApp.create(name);
    const id = document.getId();
    document.saveAndClose();
    DriveApp.getFileById(id).moveTo(DriveApp.getFolderById(folderId));
    return { id, url: DriveApp.getFileById(id).getUrl() };
  }

  replaceInDocument(docId: string, values: Record<string, string>): void {
    const document = DocumentApp.openById(docId);
    const body = document.getBody();
    for (const [key, value] of Object.entries(values)) {
      const pattern = escapeRegExp(`{{${key}}}`);
      // Collect all hits first, then replace from the end: replacing while searching could loop forever
      // when a value contains its own placeholder. deleteText/insertText keep the value literal.
      const hits: GoogleAppsScript.Document.RangeElement[] = [];
      let hit = body.findText(pattern);
      while (hit !== null) {
        hits.push(hit);
        hit = body.findText(pattern, hit);
      }
      for (const found of hits.reverse()) {
        const text = found.getElement().asText();
        const start = found.getStartOffset();
        text.deleteText(start, found.getEndOffsetInclusive());
        if (value !== '') text.insertText(start, value);
      }
    }
    document.saveAndClose();
  }

  exportPdf(docId: string, folderId: string, name: string, existingPdfId = ''): FileRef {
    const blob = DriveApp.getFileById(docId).getAs('application/pdf').setName(`${name}.pdf`);
    const existing = existingPdfId === '' ? undefined : this.liveFile(existingPdfId);
    if (existing !== undefined) {
      // DriveApp cannot replace binary content, so the Drive REST API does it; the file keeps its id and address.
      const response = UrlFetchApp.fetch(`https://www.googleapis.com/upload/drive/v3/files/${existing.getId()}?uploadType=media`, {
        method: 'patch',
        contentType: 'application/pdf',
        payload: blob.getBytes(),
        headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
        muteHttpExceptions: true,
      });
      const status = response.getResponseCode();
      if (status !== 200) throw new AppError('export_failed', `Replacing the PDF failed with HTTP ${status}`, { status });
      existing.setName(`${name}.pdf`);
      return { id: existing.getId(), url: existing.getUrl() };
    }
    const file = DriveApp.getFolderById(folderId).createFile(blob);
    return { id: file.getId(), url: file.getUrl() };
  }

  /** The file with this id, or undefined when it is gone, in the trash or not readable (then a new one is made). */
  private liveFile(id: string): GoogleAppsScript.Drive.File | undefined {
    try {
      const file = DriveApp.getFileById(id);
      return file.isTrashed() ? undefined : file;
    } catch {
      return undefined;
    }
  }

  saveTextFile(folderId: string, name: string, content: string, mimeType: string): FileRef {
    const file = DriveApp.getFolderById(folderId).createFile(name, content, mimeType);
    return { id: file.getId(), url: file.getUrl() };
  }

  exportHtml(docId: string): string {
    const response = UrlFetchApp.fetch(`https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=text%2Fhtml`, {
      headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
      muteHttpExceptions: true,
    });
    const status = response.getResponseCode();
    if (status !== 200) throw new AppError('export_failed', `Export failed with HTTP ${status}`, { status });
    return response.getContentText();
  }

  lastModified(docId: string): string {
    return DriveApp.getFileById(docId).getLastUpdated().toISOString();
  }
}
