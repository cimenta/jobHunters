import type { Job } from '@jobhunters/core';
import { formatAiSalary, formatEmploymentType, formatSalary } from './format';
import { tr } from './i18n.svelte';

export interface JobFact {
  key: string;
  label: string;
  value: string;
}

/** The labelled facts of an ad (salary, location, type, AI salary); only the filled ones. `work-mode` is always listed: the screens draw its checkboxes there. */
export function jobFacts(job: Job): JobFact[] {
  return [
    { key: 'salary', label: tr('ui.job.info.salary'), value: formatSalary(job) },
    { key: 'location', label: tr('ui.job.info.location'), value: job.location },
    { key: 'work-mode', label: tr('ui.job.info.workMode'), value: '-' },
    { key: 'type', label: tr('ui.job.info.type'), value: formatEmploymentType(job.employment_type) },
    { key: 'ai-salary', label: tr('ui.job.info.aiSalary'), value: formatAiSalary(job.ai_salary, job.salary_currency) },
  ].filter((fact) => fact.value !== '');
}

/** Colour of the match badge by the verdict of the AI: 70 and more suitable, 40 to 69 partly, below 40 not suitable. */
export function matchColor(percent: number): string {
  return percent >= 70 ? 'var(--success-soft)' : percent >= 40 ? 'var(--warning-soft)' : 'var(--danger-soft)';
}
