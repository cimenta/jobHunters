import { describe, expect, it } from 'vitest';
import { InMemoryRepository } from '../repository';
import { errorOf } from '../testing/errors';
import { makeTemplate, sequentialIds } from '../testing/fixtures';
import type { Template } from '../types';
import { findTemplate, TemplateService } from './templates';

describe('findTemplate', () => {
  const templates = [
    makeTemplate({ id: 'neutral', type: 'resume', language: '' }),
    makeTemplate({ id: 'cs', type: 'resume', language: 'cs' }),
    makeTemplate({ id: 'letter', type: 'cover_letter', language: 'en' }),
  ];
  it('prefers the exact language, then a language-neutral template', () => {
    expect(findTemplate(templates, 'resume', 'cs')?.id).toBe('cs');
    expect(findTemplate(templates, 'resume', 'en')?.id).toBe('neutral');
  });
  it('returns undefined when nothing fits', () => {
    expect(findTemplate(templates, 'cover_letter', 'cs')).toBeUndefined();
    expect(findTemplate(templates, 'other', 'en')).toBeUndefined();
  });
});

describe('TemplateService.add', () => {
  const service = () => new TemplateService(new InMemoryRepository<Template>(), sequentialIds('t'));
  const valid = { type: 'resume', language: 'en', name: 'Resume EN', docUrl: 'https://docs.google.com/document/d/1AbC/edit' };

  it('stores a valid template', () => {
    const s = service();
    expect(s.add(valid)).toEqual({ id: 't1', type: 'resume', language: 'en', name: 'Resume EN', doc_url: valid.docUrl });
    expect(s.list()).toHaveLength(1);
  });
  it('accepts an empty language (all languages)', () => {
    expect(service().add({ ...valid, language: '' }).language).toBe('');
  });
  it.each([
    { type: 'poem' },
    { language: 'de' },
    { name: '  ' },
    { docUrl: 'https://example.com/nothing' },
  ])('rejects %o', (patch) => {
    expect(errorOf(() => service().add({ ...valid, ...patch }))).toMatchObject({ code: 'template_invalid' });
  });
});
