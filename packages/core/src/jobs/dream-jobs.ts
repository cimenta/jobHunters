import { htmlToText, metaContent, titleTag } from './html';
import { emptyParsedJob, finishParsedJob, type JobParser, type ParsedJob } from './parsed-job';
import { dreamJobsId } from './url';

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const amount = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null);

const EMPLOYMENT: Record<string, string> = { FULL_TIME: 'full_time', PART_TIME: 'part_time', CONTRACT: 'contractor', INTERNSHIP: 'intern', TEMPORARY: 'temporary' };

/** The data the page hands to its own scripts (`__NEXT_DATA__`), or undefined when it is missing or cut off. */
function pageData(html: string): Json | undefined {
  const raw = /<script\b[^>]*\bid="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(html)?.[1];
  if (raw === undefined) return undefined;
  try {
    const data: unknown = JSON.parse(raw);
    return isRecord(data) ? data : undefined;
  } catch {
    return undefined;
  }
}

/** The loaded detail of the ad: the cached query "opportunityDetail" whose id is the one in the address (or the only one). */
function openedAd(data: Json, id: string): Json | undefined {
  const props = isRecord(data.props) ? data.props : undefined;
  const pageProps = props !== undefined && isRecord(props.pageProps) ? props.pageProps : undefined;
  const state = pageProps !== undefined && isRecord(pageProps.dehydratedState) ? pageProps.dehydratedState : undefined;
  const queries = state !== undefined && Array.isArray(state.queries) ? state.queries : [];
  const ads: Json[] = [];
  for (const query of queries) {
    if (!isRecord(query) || !Array.isArray(query.queryKey) || query.queryKey[0] !== 'opportunityDetail') continue;
    const result = isRecord(query.state) && isRecord(query.state.data) ? query.state.data : undefined;
    if (result !== undefined && isRecord(result.opportunity)) ads.push(result.opportunity);
  }
  return ads.find((ad) => String(ad.id) === id) ?? (ads.length === 1 && id === '' ? ads[0] : undefined);
}

function fromAd(ad: Json): ParsedJob {
  const job = emptyParsedJob();
  job.title = text(ad.title);
  job.company = isRecord(ad.company) ? text(ad.company.name) : '';
  const places = Array.isArray(ad.locations) ? ad.locations.filter(isRecord) : [];
  job.location = places.map((place) => [text(place.city), text(place.country)].filter((part) => part !== '').join(', ')).filter((place) => place !== '').join('; ');
  const mode = text(ad.workEnvironment).toUpperCase();
  job.remote = mode === 'REMOTE' ? 'yes' : mode === 'HYBRID' ? 'hybrid' : mode === 'ON_SITE' ? 'no' : '';
  const types = Array.isArray(ad.type) ? ad.type.map((type) => String(type).toUpperCase()) : [];
  job.employment_type = types.map((type) => EMPLOYMENT[type]).find((code) => code !== undefined) ?? '';
  // The site shows the pay as a monthly amount ("At least ... monthly").
  const pay = isRecord(ad.salary) ? ad.salary : undefined;
  const min = amount(pay?.min);
  const max = amount(pay?.max);
  const currency = text(pay?.currency).toUpperCase();
  if ((min !== null || max !== null) && currency !== '') {
    job.salary_min = min ?? max;
    job.salary_max = max ?? min;
    job.salary_currency = currency;
    job.salary_period = 'month';
  }
  job.posted_at = /^\d{4}-\d{2}-\d{2}/.exec(text(ad.createdAt))?.[0] ?? '';
  const markup = text(ad.rawDescription);
  job.description = markup === '' ? '' : htmlToText(markup);
  const recruiter = (Array.isArray(ad.hiringTeam) ? ad.hiringTeam : []).find(isRecord);
  if (recruiter !== undefined) {
    const name = isRecord(recruiter.name) ? [text(recruiter.name.firstname), text(recruiter.name.lastname)].filter((part) => part !== '').join(' ') : '';
    const contact = [name, text(recruiter.email)].filter((part) => part !== '').join(', ');
    if (contact !== '') job.contact_person = contact;
  }
  return job;
}

/**
 * dream.jobs (checked 2026-10-30) is a list page: the ad that is open is named in the address (`activeOpportunityId`),
 * and `similarVacancyId` only chooses the similar ads shown beside it. The page is server-rendered and carries the
 * loaded ads as data for its own scripts (`__NEXT_DATA__`): title, company, places, work mode, contract types, monthly
 * pay, the whole text as markup, the date it was created and the recruiter. Without that data only the title is read
 * from the tab. The address key is the number of the open ad.
 */
export const DREAM_JOBS_PARSER: JobParser = {
  id: 'dream-jobs',
  matches: (url) => dreamJobsId(url) !== '',
  parse(html, url) {
    const data = pageData(html);
    const ad = data === undefined ? undefined : openedAd(data, dreamJobsId(url));
    if (ad !== undefined) return finishParsedJob(fromAd(ad));
    const job = emptyParsedJob();
    job.title = metaContent(html, 'og:title') || titleTag(html);
    return finishParsedJob(job);
  },
};
