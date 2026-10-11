import { fillPlaceholders, type DriveGateway, type FileRef, type FolderRef } from '../drive';

interface FakeFolder {
  id: string;
  parentId: string | null;
  name: string;
}
interface FakeDocument {
  id: string;
  name: string;
  folderId: string | null;
  content: string;
  modifiedAt: string;
}

export class FakeDrive implements DriveGateway {
  readonly folders = new Map<string, FakeFolder>();
  readonly documents = new Map<string, FakeDocument>();
  private counter = 0;
  private clock = 0;

  private nextId(prefix: string): string {
    return `${prefix}${++this.counter}`;
  }

  private tick(): string {
    return new Date(Date.UTC(2026, 9, 10, 8, 0, this.clock++)).toISOString();
  }

  private doc(id: string): FakeDocument {
    const found = this.documents.get(id);
    if (!found) throw new Error(`No document ${id}`);
    return found;
  }

  addTemplate(content: string): string {
    const id = this.nextId('tpl');
    this.documents.set(id, { id, name: 'template', folderId: null, content, modifiedAt: this.tick() });
    return id;
  }

  ensureFolder(parentId: string | null, name: string): FolderRef {
    for (const folder of this.folders.values()) {
      if (folder.parentId === parentId && folder.name === name) return { id: folder.id, url: `https://drive.example.invalid/${folder.id}` };
    }
    const id = this.nextId('f');
    this.folders.set(id, { id, parentId, name });
    return { id, url: `https://drive.example.invalid/${id}` };
  }

  copyDocument(templateDocId: string, name: string, folderId: string): FileRef {
    const template = this.doc(templateDocId);
    const id = this.nextId('d');
    this.documents.set(id, { id, name, folderId, content: template.content, modifiedAt: this.tick() });
    return { id, url: `https://docs.example.invalid/${id}` };
  }

  replaceInDocument(docId: string, values: Record<string, string>): void {
    const doc = this.doc(docId);
    doc.content = fillPlaceholders(doc.content, values);
    doc.modifiedAt = this.tick();
  }

  exportPdf(docId: string, folderId: string, name: string): FileRef {
    const doc = this.doc(docId);
    const id = this.nextId('pdf');
    this.documents.set(id, { id, name: `${name}.pdf`, folderId, content: doc.content, modifiedAt: this.tick() });
    return { id, url: `https://drive.example.invalid/${id}` };
  }

  saveTextFile(folderId: string, name: string, content: string, _mimeType: string): FileRef {
    const id = this.nextId('file');
    this.documents.set(id, { id, name, folderId, content, modifiedAt: this.tick() });
    return { id, url: `https://drive.example.invalid/${id}` };
  }

  exportHtml(docId: string): string {
    return `<html><body>${this.doc(docId).content}</body></html>`;
  }

  lastModified(docId: string): string {
    return this.doc(docId).modifiedAt;
  }
}
