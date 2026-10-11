import { fileIdFromUrl } from '../drive';
import { ValidationError } from '../errors';
import { isLocale } from '../i18n';
import type { Repository } from '../repository';
import type { Template } from '../types';

export const DOCUMENT_TYPES = ['resume', 'cover_letter', 'other'] as const;

/** Exact language first, then a template valid for every language (language is empty). */
export function findTemplate(templates: readonly Template[], type: string, language: string): Template | undefined {
  return templates.find((t) => t.type === type && t.language === language) ?? templates.find((t) => t.type === type && t.language === '');
}

export interface TemplateInput {
  type: string;
  language: string;
  name: string;
  docUrl: string;
}

export class TemplateService {
  constructor(
    private readonly templates: Repository<Template>,
    private readonly newId: () => string,
  ) {}

  list(): Template[] {
    return this.templates.list();
  }

  add(input: TemplateInput): Template {
    const valid =
      (DOCUMENT_TYPES as readonly string[]).includes(input.type) &&
      (input.language === '' || isLocale(input.language)) &&
      input.name.trim() !== '' &&
      fileIdFromUrl(input.docUrl) !== '';
    if (!valid) throw new ValidationError('template_invalid', 'Invalid template', {});
    return this.templates.insert({
      id: this.newId(),
      type: input.type,
      language: input.language,
      name: input.name.trim(),
      doc_url: input.docUrl.trim(),
    });
  }
}
