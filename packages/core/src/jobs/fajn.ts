import { GIG_TEXT } from './generic';
import { elementsInnerHtml, foldDiacritics, htmlToText, stripPictographs, titleTag } from './html';
import { emptyParsedJob, finishParsedJob, type JobParser, type ParsedJob } from './parsed-job';
import { parseSalaryText } from './salary';
import { hostIs, parseUrl } from './url';

/** The address of an ad of these portals ends with `<id>-<slug>/`. */
const AD_PATH = /\/\d{4,}-[a-z0-9-]+\/?$/i;

/** The rows of the facts table: label folded to lower case without the colon, value as text. */
function facts(html: string): Map<string, string> {
  const rows = new Map<string, string>();
  for (const item of elementsInnerHtml(html, /class="[^"]*info__item/)) {
    const label = elementsInnerHtml(item, /__tabulka_nadpisek/)[0];
    if (label === undefined) continue;
    const key = foldDiacritics(htmlToText(label)).toLowerCase().replace(/[:\s]+$/, '').trim();
    const value = htmlToText(item.replace(/<span\b[^>]*__tabulka_nadpisek[^>]*>[\s\S]*?<\/span>/, ''));
    if (key !== '' && !rows.has(key)) rows.set(key, value);
  }
  return rows;
}

/** The unit after the slash in "30 000 - 35 000 Kc/mes." ("per task" and anything unknown leave the period empty). */
function periodOf(text: string): string {
  const unit = /\/\s*([^\s<]+)/.exec(foldDiacritics(text).toLowerCase())?.[1] ?? '';
  if (unit.startsWith('mes')) return 'month';
  if (unit.startsWith('hod') || unit === 'h') return 'hour';
  if (unit.startsWith('den')) return 'day';
  if (unit.startsWith('tyd')) return 'week';
  if (unit.startsWith('rok')) return 'year';
  return '';
}

function employmentCode(folded: string): string {
  if (folded.startsWith('plny')) return 'full_time';
  if (folded.startsWith('zkracen') || folded.startsWith('castecn')) return 'part_time';
  if (folded.includes('brigad')) return 'temporary';
  if (folded.includes('dohod')) return 'contractor';
  return '';
}

/** "19.10.2026" to "2026-10-19"; empty for anything else. */
function dateOf(html: string): string {
  const match = /<span>\s*Vlo[žz]eno:\s*<\/span>\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(html);
  if (!match) return '';
  return `${match[3]}-${match[2]!.padStart(2, '0')}-${match[1]!.padStart(2, '0')}`;
}

/** The company at the end of "Prace: Title - Company | Inwork.cz". */
function companyFromTitleTag(html: string): string {
  const title = titleTag(html);
  const end = title.lastIndexOf(' | ');
  const head = end >= 0 ? title.slice(0, end) : title;
  const dash = head.lastIndexOf(' - ');
  return dash >= 0 ? head.slice(dash + 3).trim() : '';
}

/**
 * Fajn Brigády (fajn-brigady.cz, only temporary jobs) and Inwork (inwork.cz) are one product: the page has no JSON-LD, a
 * table of rows "label: value" (workplace, wage, company, ...) and the text of the ad in blocks of the class
 * `rich-text-content` (checked 2026-10-22). Both sites answer a plain download with a Cloudflare check (HTTP 403), so this
 * parser works only where the page does arrive.
 */
export const FAJN_PARSER: JobParser = {
  id: 'fajn',
  matches: (url) => (hostIs(url, 'fajn-brigady.cz') || hostIs(url, 'inwork.cz')) && AD_PATH.test(parseUrl(url)?.path ?? ''),
  parse(html, url) {
    const job: ParsedJob = emptyParsedJob();
    const heading = elementsInnerHtml(html, /^<h1\b/i)[0];
    job.title = heading === undefined ? '' : stripPictographs(htmlToText(heading));
    const rows = facts(html);
    job.company = rows.get('firma') ?? companyFromTitleTag(html);
    job.location = rows.get('pracoviste') ?? rows.get('lokalita') ?? '';

    const wage = rows.get('mzda') ?? '';
    const salary = parseSalaryText(wage);
    if (salary) {
      job.salary_min = salary.min;
      job.salary_max = salary.max;
      job.salary_currency = salary.currency;
      job.salary_period = periodOf(wage);
    }

    const contract = foldDiacritics(rows.get('uvazek') ?? '').toLowerCase();
    job.employment_type = employmentCode(contract);
    const onlyGigs = hostIs(url, 'fajn-brigady.cz') || /^brig[aá]da\b/i.test(titleTag(html));
    job.is_gig = onlyGigs || GIG_TEXT.test(`${job.title} ${contract}`);
    if (job.is_gig && job.employment_type === '') job.employment_type = 'temporary';

    job.posted_at = dateOf(html);
    const blocks = elementsInnerHtml(html, /class="[^"]*rich-text-content/).map((block) => stripPictographs(htmlToText(block))).filter((block) => block !== '');
    job.description = [...new Set(blocks)].join('\n\n');
    return finishParsedJob(job);
  },
};
