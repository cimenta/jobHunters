import type { ParsedJob } from '@jobhunters/core';
import type { JobOverrides } from '../api';

export interface JobDraft {
  title: string;
  company: string;
  location: string;
  salary_min: string;
  salary_max: string;
  salary_currency: string;
  salary_period: string;
  is_gig: boolean;
  description: string;
  notes: string;
}

export function emptyDraft(): JobDraft {
  return { title: '', company: '', location: '', salary_min: '', salary_max: '', salary_currency: '', salary_period: '', is_gig: false, description: '', notes: '' };
}

export function toDraft(parsed: ParsedJob): JobDraft {
  return {
    title: parsed.title,
    company: parsed.company,
    location: parsed.location,
    salary_min: parsed.salary_min === null ? '' : String(parsed.salary_min),
    salary_max: parsed.salary_max === null ? '' : String(parsed.salary_max),
    salary_currency: parsed.salary_currency,
    salary_period: parsed.salary_period,
    is_gig: parsed.is_gig,
    description: parsed.description,
    notes: '',
  };
}

/** Empty text is `null` (no salary), a non-number is `undefined`. Spaces and a decimal comma are accepted. */
export function parseAmount(text: string): number | null | undefined {
  const compact = text.replace(/[\s ]/g, '').replace(',', '.');
  if (compact === '') return null;
  const value = Number(compact);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function toOverrides(draft: JobDraft): { overrides: JobOverrides; valid: boolean } {
  const min = parseAmount(draft.salary_min);
  const max = parseAmount(draft.salary_max);
  return {
    valid: min !== undefined && max !== undefined,
    overrides: {
      title: draft.title,
      company: draft.company,
      location: draft.location,
      salary_min: min ?? null,
      salary_max: max ?? null,
      salary_currency: draft.salary_currency,
      salary_period: draft.salary_period,
      is_gig: draft.is_gig,
      description: draft.description,
      notes: draft.notes,
    },
  };
}
