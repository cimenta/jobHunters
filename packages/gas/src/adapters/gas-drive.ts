import { AppError, type DriveGateway, type FileRef, type FolderRef } from '@jobhunters/core';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class GasDrive implements DriveGateway {
  ensureFolder(parentId: string | null, name: string): FolderRef {
    const parent = parentId === null ? DriveApp.getRootFolder() : DriveApp.getFolderById(parentId);
    const existing = parent.getFoldersByName(name);
    const folder = existing.hasNext() ? existing.next() : parent.createFolder(name);
    return { id: folder.getId(), url: folder.getUrl() };
  }

  copyDocument(templateDocId: string, name: string, folderId: string): FileRef {
    const copy = DriveApp.getFileById(templateDocId).makeCopy(name, DriveApp.getFolderById(folderId));
    return { id: copy.getId(), url: copy.getUrl() };
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

  exportPdf(docId: string, folderId: string, name: string): FileRef {
    const blob = DriveApp.getFileById(docId).getAs('application/pdf').setName(`${name}.pdf`);
    const file = DriveApp.getFolderById(folderId).createFile(blob);
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
