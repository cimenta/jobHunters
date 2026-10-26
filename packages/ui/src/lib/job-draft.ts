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
  contact_person: string;
  gig_shift: string;
  gig_priority: boolean;
  is_gig: boolean;
  is_remote: boolean;
  is_hybrid: boolean;
  is_contract: boolean;
  description: string;
  notes: string;
}

export function emptyDraft(): JobDraft {
  return { title: '', company: '', location: '', salary_min: '', salary_max: '', salary_currency: '', salary_period: '', contact_person: '', gig_shift: '', gig_priority: false, is_gig: false, is_remote: false, is_hybrid: false, is_contract: false, description: '', notes: '' };
}

export function toDraft(parsed: ParsedJob): JobDraft {
  return {
    title: parsed.title,
    company: parsed.company,
    location: parsed.location,
    salary_min: parsed.salary_min == null ? '' : String(parsed.salary_min),
    salary_max: parsed.salary_max == null ? '' : String(parsed.salary_max),
    salary_currency: parsed.salary_currency,
    salary_period: parsed.salary_period,
    contact_person: parsed.contact_person ?? '',
    gig_shift: '',
    gig_priority: false,
    is_gig: parsed.is_gig,
    is_remote: parsed.is_remote,
    is_hybrid: parsed.is_hybrid,
    is_contract: false,
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
      contact_person: draft.contact_person,
      gig_shift: draft.is_gig ? draft.gig_shift : '',
      gig_priority: draft.is_gig && draft.gig_priority,
      is_gig: draft.is_gig,
      is_remote: draft.is_remote,
      is_hybrid: draft.is_hybrid,
      is_contract: draft.is_contract,
      description: draft.description,
      notes: draft.notes,
    },
  };
}
