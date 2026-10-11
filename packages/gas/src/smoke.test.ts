import { describe, expect, it } from 'vitest';
import { createApi } from './api';
import { createHandlers } from './handlers';
import { runSmokeTest } from './smoke';
import { makeTestContainer } from './test-container';

function setup() {
  const { container, drive } = makeTestContainer();
  const api = createApi({ handlers: createHandlers(container), log: container.log });
  const lines: string[] = [];
  const run = () =>
    runSmokeTest({
      call: (method, args) => api(method, args),
      createTemplateDoc: (_name, text) => `https://docs.google.com/document/d/${drive.addTemplate(text)}/edit`,
      today: () => '2026-10-10',
      log: (line) => lines.push(line),
    });
  return { run, lines, container };
}

describe('runSmokeTest', () => {
  it('passes every step and leaves a draft application with documents behind', () => {
    const { run, lines, container } = setup();
    const result = run();
    expect(result.failed).toEqual([]);
    expect(result.ok).toBe(true);
    expect(lines.some((line) => line.startsWith('OK'))).toBe(true);
    expect(lines.filter((line) => line.startsWith('FAIL'))).toEqual([]);
    expect(container.applications.list()).toHaveLength(1);
    expect(container.documents.list()).toHaveLength(2);
    expect(container.questions.list()).toHaveLength(1);
  });

  it('can run twice without duplicating the templates or the job', () => {
    const { run, container } = setup();
    run();
    const second = run();
    expect(second.ok).toBe(true);
    expect(container.templates.list()).toHaveLength(2);
    expect(container.jobs.list()).toHaveLength(1);
    expect(container.applications.list()).toHaveLength(2);
  });

  it('reports a failing step instead of throwing', () => {
    const { container, drive } = makeTestContainer();
    const api = createApi({ handlers: createHandlers(container), log: container.log });
    const result = runSmokeTest({
      call: (method, args) => (method === 'exportDocumentPdf' ? { ok: false, error: { code: 'export_failed', params: {}, message: 'x' } } : api(method, args)),
      createTemplateDoc: (_name, text) => `https://docs.google.com/document/d/${drive.addTemplate(text)}/edit`,
      today: () => '2026-10-10',
      log: () => {},
    });
    expect(result.ok).toBe(false);
    expect(result.failed).toEqual(['export PDF', 'application detail and timeline']);
  });
});
