import { GIG_TEXT } from './generic';
import { elementsInnerHtml, foldDiacritics, htmlToText } from './html';
import { emptyParsedJob, finishParsedJob, type JobParser } from './parsed-job';
import { parseSalaryText } from './salary';
import { hostIs, parseUrl } from './url';

/** An ad of Nelisa: `/<language>/offer/<uuid>`, on the subdomain of the company. */
const AD_PATH = /^\/[a-z]{2}\/offer\/[0-9a-f-]{36}\/?$/i;

/** Pictures and invisible joiners that recruiters put into headings and texts; they are not part of the words. */
function plain(text: string): string {
  return text
    .replace(/[⁠​‍️]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Every `<dt>label</dt><dd>value</dd>` of the page, label folded to lower case; the first of a label wins. */
function facts(html: string): Map<string, string> {
  const rows = new Map<string, string>();
  for (const match of html.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/g)) {
    const key = foldDiacritics(htmlToText(match[1]!)).toLowerCase().trim();
    if (key !== '' && !rows.has(key)) rows.set(key, htmlToText(match[2]!).replace(/\s+/g, ' ').trim());
  }
  return rows;
}

function periodOf(folded: string): string {
  if (folded.includes('mesic')) return 'month';
  if (folded.includes('hodin')) return 'hour';
  if (/\bden\b|denne/.test(folded)) return 'day';
  if (folded.includes('tyd')) return 'week';
  if (folded.includes('rok') || folded.includes('rocn')) return 'year';
  return '';
}

function employmentCode(folded: string): string {
  if (folded.includes('brigad') || folded.includes('docasn')) return 'temporary';
  if (folded.includes('zkracen') || folded.includes('castecn')) return 'part_time';
  if (folded.includes('plny')) return 'full_time';
  return '';
}

/**
 * Nelisa (nelisa.com, an applicant system of employers: `<company>.nelisa.com/cs/offer/<uuid>`) renders the ad on the
 * server (checked 2026-10-23) but has no JSON-LD: a heading, the company below it, a list of facts (type of work, place,
 * offered pay), the text of the ad in a block with the attribute `lang`, and more facts under "O pracovní pozici". The
 * heading is the headline of the ad ("Hook | Position | 36 000 Kč"), because the page has no separate position name.
 */
export const NELISA_PARSER: JobParser = {
  id: 'nelisa',
  matches: (url) => hostIs(url, 'nelisa.com') && AD_PATH.test(parseUrl(url)?.path ?? ''),
  parse(html) {
    const job = emptyParsedJob();
    const rows = facts(html);

    const heading = elementsInnerHtml(html, /^<h1\b/i)[0];
    const headline = heading === undefined ? '' : plain(htmlToText(heading));
    // A closing "| 36 000 Kč" is the pay, which has its own field.
    const parts = headline.split(/\s*\|\s*/);
    if (parts.length > 1 && parseSalaryText(parts[parts.length - 1]!) !== undefined) parts.pop();
    job.title = parts.join(' | ').trim();

    if (heading !== undefined) {
      const after = html.slice(html.indexOf(heading) + heading.length);
      const company = /^<\/h1>\s*<p\b[^>]*>([\s\S]*?)<\/p>/.exec(after)?.[1];
      job.company = company === undefined ? '' : plain(htmlToText(company));
    }
    if (job.company === '') job.company = /alt="Logo společnosti ([^"]+)"/.exec(html)?.[1]?.trim() ?? '';

    job.location = rows.get('misto pracoviste') ?? rows.get('lokalita') ?? '';

    const offer = rows.get('nabizena odmena') ?? '';
    const salary = parseSalaryText(offer);
    if (salary) {
      const folded = foldDiacritics(offer).toLowerCase();
      job.salary_currency = salary.currency;
      job.salary_period = periodOf(folded) || salary.period;
      // "od 36 000" is a lower limit, "do 40 000" an upper one.
      job.salary_min = salary.min !== null && /^do\b/.test(folded) && salary.min === salary.max ? null : salary.min;
      job.salary_max = salary.max !== null && /^od\b/.test(folded) && salary.min === salary.max ? null : salary.max;
    }

    const kind = foldDiacritics(rows.get('typ prace') ?? '').toLowerCase();
    job.employment_type = employmentCode(kind);
    const form = rows.get('forma spoluprace') ?? '';
    if (job.employment_type === '' && /\bdp[pc]\b|dohod/i.test(foldDiacritics(form))) job.employment_type = 'contractor';
    job.is_gig = GIG_TEXT.test(`${kind} ${form}`);

    const body = elementsInnerHtml(html, /^<div\b[^>]*\blang="/i)[0];
    job.description = body === undefined ? '' : plain(htmlToText(body));
    return finishParsedJob(job);
  },
};
