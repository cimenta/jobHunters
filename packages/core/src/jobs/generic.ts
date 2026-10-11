import { decodeEntities, htmlToText, jsonLdObjects, metaContent, titleTag } from './html';
import { emptyParsedJob, finishParsedJob, type JobParser, type ParsedJob } from './parsed-job';

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const asList = (value: unknown): unknown[] => (value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]);
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '');
const dateOnly = (value: unknown): string => (/^\d{4}-\d{2}-\d{2}/.test(text(value)) ? text(value).slice(0, 10) : '');

const EMPLOYMENT: Record<string, string> = {
  FULL_TIME: 'full_time', PART_TIME: 'part_time', CONTRACTOR: 'contractor', TEMPORARY: 'temporary',
  INTERN: 'intern', VOLUNTEER: 'volunteer', PER_DIEM: 'per_diem', OTHER: 'other',
};
const GIG_TYPES = new Set(['TEMPORARY', 'PER_DIEM']);
export const GIG_TEXT = /brig[aá]d|dohod[ay] o (proveden[ií] pr[aá]ce|pracovn[ií] [cč]innosti)|\bdpp\b|\bdp[cč]\b|\bgig\b/i;
const PERIODS: Record<string, string> = { HOUR: 'hour', DAY: 'day', WEEK: 'week', MONTH: 'month', YEAR: 'year' };

function isJobPosting(object: Json): boolean {
  const type = object['@type'];
  return type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'));
}

function locationText(raw: unknown): string {
  const parts: string[] = [];
  for (const place of asList(raw)) {
    if (typeof place === 'string') {
      parts.push(text(place));
    } else if (isRecord(place)) {
      const address = place.address;
      if (typeof address === 'string') {
        parts.push(text(address));
      } else if (isRecord(address)) {
        const country = isRecord(address.addressCountry) ? address.addressCountry.name : address.addressCountry;
        parts.push(text(address.addressLocality), text(country));
      }
    }
  }
  return parts.filter((part, index) => part !== '' && parts.indexOf(part) === index).join(', ');
}

function applyJsonLd(job: ParsedJob, posting: Json): void {
  job.title = text(posting.title) || text(posting.name);
  const org = posting.hiringOrganization;
  job.company = typeof org === 'string' ? text(org) : isRecord(org) ? text(org.name) : '';
  job.location = locationText(posting.jobLocation);

  const salary = posting.baseSalary;
  if (isRecord(salary)) {
    job.salary_currency = text(salary.currency);
    const value = salary.value;
    if (isRecord(value)) {
      const single = typeof value.value === 'number' ? value.value : null;
      job.salary_min = typeof value.minValue === 'number' ? value.minValue : single;
      job.salary_max = typeof value.maxValue === 'number' ? value.maxValue : single;
      job.salary_period = PERIODS[text(value.unitText).toUpperCase()] ?? '';
    } else if (typeof value === 'number') {
      job.salary_min = value;
      job.salary_max = value;
    }
  }

  const types = asList(posting.employmentType).map((t) => text(t)).filter((t) => t !== '');
  const first = types[0];
  if (first !== undefined) job.employment_type = EMPLOYMENT[first.toUpperCase()] ?? first.toLowerCase();
  job.is_gig = types.some((t) => GIG_TYPES.has(t.toUpperCase()) || GIG_TEXT.test(t));
  if (text(posting.jobLocationType).toUpperCase() === 'TELECOMMUTE') job.remote = 'yes';

  job.posted_at = dateOnly(posting.datePosted);
  job.valid_until = dateOnly(posting.validThrough);

  const rawDescription = text(posting.description);
  // Some sites entity-escape the whole HTML string.
  job.description = htmlToText(!rawDescription.includes('<') && rawDescription.includes('&lt;') ? decodeEntities(rawDescription) : rawDescription);
  job.language = text(posting.inLanguage).slice(0, 2).toLowerCase();
  if (job.language !== 'en' && job.language !== 'cs') job.language = '';
}

export function parseGeneric(html: string, _url: string): ParsedJob {
  const job = emptyParsedJob();
  const posting = jsonLdObjects(html).find(isJobPosting);
  if (posting !== undefined) applyJsonLd(job, posting);
  if (job.title === '') job.title = metaContent(html, 'og:title') || titleTag(html);
  if (job.description === '') job.description = metaContent(html, 'og:description');
  return finishParsedJob(job);
}

export const GENERIC_PARSER: JobParser = { id: 'generic', matches: () => true, parse: parseGeneric };
