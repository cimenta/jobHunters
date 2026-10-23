import { GIG_TEXT } from './generic';
import { decodeEntities, elementsInnerHtml, foldDiacritics, htmlToText, jsonLdObjects, stripPictographs } from './html';
import { withoutGenderNotice } from './manpower';
import { emptyParsedJob, finishParsedJob, type JobParser } from './parsed-job';
import { hostIs, parseUrl } from './url';

type Json = Record<string, unknown>;

/** An ad of Flek: `/nabidka/<slug>/<id>/`. */
const AD_PATH = /^\/nabidka\/[a-z0-9-]+\/\d+\/?$/i;

const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The rows "Label: value" of the summary of the offer (position, pay, contract, start, suitable for). */
function summary(html: string): Map<string, string> {
  const rows = new Map<string, string>();
  for (const match of html.matchAll(/class="summary-label">([^<]*)<\/span>\s*<(?:span|a)\b[^>]*summary-value[^>]*>([\s\S]*?)<\/(?:span|a)>/g)) {
    const key = foldDiacritics(htmlToText(match[1]!)).toLowerCase().replace(/:$/, '').trim();
    if (key !== '' && !rows.has(key)) rows.set(key, htmlToText(match[2]!).replace(/\s+/g, ' ').trim());
  }
  return rows;
}

function employmentCode(folded: string): string {
  if (folded.includes('brigad') || folded.includes('docasn')) return 'temporary';
  if (folded.includes('zkracen') || folded.includes('castecn')) return 'part_time';
  if (folded.includes('plny')) return 'full_time';
  if (folded.includes('dpp') || folded.includes('dpc') || folded.includes('dohod')) return 'contractor';
  return '';
}

/**
 * Flek (flek.cz, the brigády portal of the same family as Inwork) carries a JobPosting in JSON-LD (checked 2026-10-23),
 * which the generic parser reads and the registry merges in. This parser adds what that misses: the place as the city
 * only (no country code), the contract from the summary box, the gig mark, and the text of the ad without the notice
 * about men and women that Manpower ads end with.
 */
export const FLEK_PARSER: JobParser = {
  id: 'flek',
  matches: (url) => hostIs(url, 'flek.cz') && AD_PATH.test(parseUrl(url)?.path ?? ''),
  parse(html) {
    const job = emptyParsedJob();
    const heading = elementsInnerHtml(html, /^<h1\b/i)[0];
    job.title = heading === undefined ? '' : stripPictographs(htmlToText(heading));

    const posting = jsonLdObjects(html).find((object) => object['@type'] === 'JobPosting');
    const place = posting !== undefined && isRecord(posting.jobLocation) && isRecord(posting.jobLocation.address) ? posting.jobLocation.address.addressLocality : undefined;
    job.location = typeof place === 'string' ? place.trim() : '';

    const rows = summary(html);
    const contract = foldDiacritics(rows.get('uvazek') ?? '').toLowerCase();
    job.employment_type = employmentCode(contract);
    job.is_gig = GIG_TEXT.test(`${job.title} ${rows.get('uvazek') ?? ''}`);

    const raw = posting !== undefined && typeof posting.description === 'string' ? posting.description : '';
    const section = elementsInnerHtml(html, /class="job-section"/)[0] ?? '';
    const source = raw !== '' ? (!raw.includes('<') && raw.includes('&lt;') ? decodeEntities(raw) : raw) : section;
    job.description = withoutGenderNotice(stripPictographs(htmlToText(source)));
    return finishParsedJob(job);
  },
};
