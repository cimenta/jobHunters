import type { ApiResult } from './api';

export interface SmokeDeps {
  call: (method: string, args?: unknown) => ApiResult;
  /** Creates a Google Doc with the text in the Templates folder and returns its address. */
  createTemplateDoc: (name: string, text: string) => string;
  /** YYYY-MM-DD. */
  today: () => string;
  log: (line: string) => void;
}

export interface SmokeResult {
  ok: boolean;
  failed: string[];
}

const TEMPLATE_TEXT = 'Dear {{company}}, I am {{name}}, applying for {{position}} on {{date}}. {{body}}';
const SMOKE_URL = 'https://example.com/jobhunters-smoke-test';
const SMOKE_COMPANY = 'Smoke Test Ltd';

function plusDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

/**
 * Walks through the whole application flow against the real sheets and Drive, so a manual check is one click.
 * It writes test data (company "Smoke Test Ltd", two templates named "Smoke test ...", one job and one application per run);
 * delete those rows and folders by hand when you are done. Running it again reuses the templates and the job.
 */
export function runSmokeTest(deps: SmokeDeps): SmokeResult {
  const failed: string[] = [];

  const step = <T>(name: string, run: () => T): T | undefined => {
    try {
      const value = run();
      deps.log(`OK   ${name}`);
      return value;
    } catch (error) {
      failed.push(name);
      deps.log(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  };

  /** Calls the API and throws when it answers with an error, so `step` can report it. */
  const data = <T>(method: string, args?: unknown): T => {
    const result = deps.call(method, args);
    if (!result.ok) throw new Error(`${result.error.code} ${JSON.stringify(result.error.params)}`);
    return result.data as T;
  };

  const expectError = (method: string, args: unknown, code: string): void => {
    const result = deps.call(method, args);
    if (result.ok || result.error.code !== code) throw new Error(`expected ${code}, got ${JSON.stringify(result)}`);
  };

  step('app info', () => data('getAppInfo'));

  step('templates', () => {
    const existing = data<{ name: string }[]>('listTemplates').map((template) => template.name);
    for (const [type, name] of [['resume', 'Smoke test resume'], ['cover_letter', 'Smoke test cover letter']] as const) {
      if (existing.includes(name)) continue;
      const docUrl = deps.createTemplateDoc(name, TEMPLATE_TEXT);
      data('addTemplate', { type, language: '', name, docUrl });
    }
  });

  const job = step('save job from pasted text', () =>
    data<{ job: { id: string } }>('saveJob', {
      url: SMOKE_URL,
      text: 'Smoke Test Engineer\n\nThis is a test ad created by the JobHunters smoke test. You can delete it.',
      overrides: { company: SMOKE_COMPANY },
    }).job,
  );

  const created = job && step('create application', () => {
    const result = data<{ application: { id: string }; documents: { id: string }[]; warnings: { code: string }[] }>('createApplication', { jobId: job.id });
    if (result.documents.length < 1) throw new Error(`no documents were created, warnings: ${JSON.stringify(result.warnings)}`);
    return result;
  });

  const documentId = created?.documents[0]?.id;
  if (documentId !== undefined) {
    step('export PDF', () => {
      const view = data<{ pdf_url: string }>('exportDocumentPdf', { id: documentId });
      if (!view.pdf_url) throw new Error('no PDF address');
    });
    step('HTML preview has no scripts', () => {
      const { html } = data<{ html: string }>('previewDocument', { id: documentId });
      if (html.length === 0 || /<script/i.test(html)) throw new Error('empty or unsafe preview');
    });
  }

  if (created) {
    const applicationId = created.application.id;
    step('question limit', () => {
      const question = data<{ id: string }>('addQuestion', { applicationId, question: 'Why us?', maxSentences: 2 });
      expectError('answerQuestion', { id: question.id, answer: 'One. Two. Three.' }, 'answer_too_long');
      data('answerQuestion', { id: question.id, answer: 'fine' });
    });
    step('communication', () => data('addCommunication', { applicationId, direction: 'note', channel: 'other', summary: 'Smoke test note' }));
    step('reminder', () => data('addReminder', { applicationId, dueAt: plusDays(deps.today(), 7), text: 'Smoke test reminder' }));
    step('application detail and timeline', () => {
      const detail = data<{ documents: unknown[]; questions: unknown[]; timeline: { type: string }[] }>('getApplication', { id: applicationId });
      const types = new Set(detail.timeline.map((event) => event.type));
      for (const wanted of ['status', 'document', 'pdf', 'communication', 'reminder']) {
        if (!types.has(wanted)) throw new Error(`timeline has no ${wanted} event`);
      }
    });
  }

  deps.log(failed.length === 0 ? 'ALL STEPS PASSED' : `FAILED: ${failed.join(', ')}`);
  return { ok: failed.length === 0, failed };
}
