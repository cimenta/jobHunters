import { detectLanguage, truncateForCell } from './html';

export interface ParsedJob {
  title: string;
  company: string;
  location: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  salary_period: string;
  employment_type: string;
  is_gig: boolean;
  remote: '' | 'yes' | 'no' | 'hybrid';
  posted_at: string;
  valid_until: string;
  description: string;
  language: string;
  /** Fields among title, company, location and description that no parser could find. */
  missing: string[];
}

export interface JobParser {
  id: string;
  matches(url: string): boolean;
  parse(html: string, url: string): ParsedJob;
}

export function emptyParsedJob(): ParsedJob {
  return {
    title: '', company: '', location: '', salary_min: null, salary_max: null, salary_currency: '', salary_period: '',
    employment_type: '', is_gig: false, remote: '', posted_at: '', valid_until: '', description: '', language: '', missing: [],
  };
}

const REPORTED_FIELDS = ['title', 'company', 'location', 'description'] as const;

export function finishParsedJob(job: ParsedJob): ParsedJob {
  const description = truncateForCell(job.description.trim());
  return {
    ...job,
    title: job.title.trim(),
    company: job.company.trim(),
    location: job.location.trim(),
    description,
    language: job.language || detectLanguage(description),
    missing: REPORTED_FIELDS.filter((field) => (field === 'description' ? description : job[field].trim()) === ''),
  };
}

/** Non-empty values of `over` win. Used to overlay a portal parser on the generic result. */
export function mergeParsed(base: ParsedJob, over: ParsedJob): ParsedJob {
  const text = (a: string, b: string): string => (b !== '' ? b : a);
  return {
    title: text(base.title, over.title),
    company: text(base.company, over.company),
    location: text(base.location, over.location),
    salary_min: over.salary_min ?? base.salary_min,
    salary_max: over.salary_max ?? base.salary_max,
    salary_currency: text(base.salary_currency, over.salary_currency),
    salary_period: text(base.salary_period, over.salary_period),
    employment_type: text(base.employment_type, over.employment_type),
    is_gig: base.is_gig || over.is_gig,
    remote: over.remote !== '' ? over.remote : base.remote,
    posted_at: text(base.posted_at, over.posted_at),
    valid_until: text(base.valid_until, over.valid_until),
    description: text(base.description, over.description),
    language: text(base.language, over.language),
    missing: [],
  };
}
