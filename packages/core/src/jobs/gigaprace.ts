import { elementsInnerHtml, htmlToText, jsonLdObjects } from './html';
import { emptyParsedJob, finishParsedJob, type JobParser } from './parsed-job';
import { hostIs, parseUrl } from './url';

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The places of work named in the JobPosting, as city names only: the generic parser adds the country code ("Brno, CZ"). */
function places(posting: Json): string {
  const raw = posting.jobLocation;
  const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  const names: string[] = [];
  for (const place of list) {
    const address = isRecord(place) ? place.address : undefined;
    const name = isRecord(address) && typeof address.addressLocality === 'string' ? address.addressLocality.trim() : '';
    if (name !== '' && !names.includes(name)) names.push(name);
  }
  return names.join(', ');
}

/**
 * GigaPrace.cz ads carry a full JobPosting in JSON-LD (checked 2026-10-22), which the generic parser reads and the
 * registry merges in. This parser only gives the place of work without the country code and the <h1> as a title
 * fallback, so an ad whose JSON-LD is gone still has a title.
 */
export const GIGAPRACE_PARSER: JobParser = {
  id: 'gigaprace',
  matches: (url) => hostIs(url, 'gigaprace.cz') && (parseUrl(url)?.path.startsWith('/nabidka-prace/') ?? false),
  parse(html) {
    const job = emptyParsedJob();
    const posting = jsonLdObjects(html).find((object) => object['@type'] === 'JobPosting');
    job.location = posting === undefined ? '' : places(posting);
    const heading = elementsInnerHtml(html, /^<h1\b/i)[0];
    job.title = heading === undefined ? '' : htmlToText(heading);
    return finishParsedJob(job);
  },
};
