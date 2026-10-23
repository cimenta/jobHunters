import { GIG_TEXT } from './generic';
import { elementsInnerHtml, foldDiacritics, htmlToText, stripPictographs } from './html';
import { emptyParsedJob, finishParsedJob, type JobParser, type ParsedJob } from './parsed-job';
import { parseSalaryText } from './salary';
import { hostIs, parseUrl } from './url';

/** An ad of Manpower: `/nabidky-prace/<slug>--<id>/`. */
const AD_PATH = /^\/nabidky-prace\/[a-z0-9-]+--\d+\/?$/i;

/** Manpower ends every ad with the same notice about men and women; it says nothing about the job. */
export function withoutGenderNotice(text: string): string {
  return text.replace(/\n*\s*NAB[ÍI]R[ÁA]ME MU[ŽZ]E I\s*[ŽZ]ENY[\s\S]*$/i, '').trim();
}

function employmentCode(folded: string): string {
  if (folded.includes('brigad') || folded.includes('docasn')) return 'temporary';
  if (folded.includes('zkracen') || folded.includes('castecn')) return 'part_time';
  if (folded.includes('plny')) return 'full_time';
  if (folded.includes('dpp') || folded.includes('dpc') || folded.includes('dohod')) return 'contractor';
  return '';
}

/**
 * The pay is written inside the text of the ad, as a list item such as "Mzdu až 45 000 Kč": "až" is an upper limit,
 * "od" a lower one. Only a line that names the pay (mzda, plat, odměna) and an amount in crowns counts.
 */
export function payFromText(text: string): Pick<ParsedJob, 'salary_min' | 'salary_max' | 'salary_currency' | 'salary_period'> | undefined {
  for (const line of text.split('\n')) {
    const folded = foldDiacritics(line).toLowerCase();
    if (!/\b(?:mzd\w*|plat\w*|odmen\w*)\b/.test(folded)) continue;
    const salary = parseSalaryText(line);
    if (!salary || salary.currency !== 'CZK') continue;
    const range = salary.min !== null && salary.min !== salary.max;
    const upTo = !range && /\b(?:az|do)\s+[\d ]/.test(folded);
    const from = !range && /\bod\s+[\d ]/.test(folded);
    const period = /hod/.test(folded) ? 'hour' : /\brok|rocn/.test(folded) ? 'year' : 'month';
    return { salary_min: upTo ? null : salary.min, salary_max: from ? null : salary.max, salary_currency: 'CZK', salary_period: period };
  }
  return undefined;
}

/** The box on the left: the field and the benefits ("Obor", "Benefity") and the recruiter with the phone and the e-mail. */
function sideBox(html: string): { facts: string[]; contact: string } {
  // The page has several "left" columns (header, back button); the right one holds the facts or the team list.
  const left = elementsInnerHtml(html, /^<div\b[^>]*class="left"/i).find((inner) => /class="(?:icon\b|our_team_list)/.test(inner)) ?? '';
  const facts: string[] = [];
  for (const match of left.matchAll(/<p\b[^>]*class="icon[^"]*"[^>]*>\s*<strong>([\s\S]*?)<\/strong>([\s\S]*?)<\/p>/g)) {
    const label = htmlToText(match[1]!).trim();
    const value = htmlToText(match[2]!).replace(/\s+/g, ' ').trim();
    if (label !== '' && value !== '') facts.push(`${label}: ${value}`);
  }
  const part = (name: string): string => {
    const inner = elementsInnerHtml(left, new RegExp(`^<p\\b[^>]*class="${name}"`, 'i'))[0];
    return inner === undefined ? '' : htmlToText(inner).replace(/\s+/g, ' ').trim();
  };
  const contact = [part('name'), part('phone'), part('mail')].filter((value) => value !== '').join(', ');
  return { facts, contact };
}

/**
 * Manpower (manpower.cz) has a JobPosting in JSON-LD that is not valid JSON (a comma before the closing brace) and gives
 * the address of the head office, so the page itself is read (checked 2026-10-23): the heading, a short introduction, two
 * "flags" (contract and place) and the blocks of the ad (Popis pozice, Požadujeme, Nabízíme). The box on the left gives the field,
 * the benefits (added to the text) and the recruiter, who becomes the contact person.
 */
export const MANPOWER_PARSER: JobParser = {
  id: 'manpower',
  matches: (url) => hostIs(url, 'manpower.cz') && AD_PATH.test(parseUrl(url)?.path ?? ''),
  parse(html) {
    const job = emptyParsedJob();
    const region = elementsInnerHtml(html, /^<div\b[^>]*class="right"/i).find((inner) => inner.includes('<h1')) ?? html;
    const heading = elementsInnerHtml(region, /^<h1\b/i)[0];
    job.title = heading === undefined ? '' : stripPictographs(htmlToText(heading));
    job.company = 'ManpowerGroup';

    const flags = elementsInnerHtml(region, /class="flag_list"/)[0] ?? '';
    let contract = '';
    for (const flag of flags.matchAll(/<span\b[^>]*class="[^"]*\bicon(\d)\b[^"]*"[^>]*>([\s\S]*?)<\/span>/g)) {
      const text = htmlToText(flag[2]!).replace(/\s+/g, ' ').trim();
      if (flag[1] === '1') contract = text;
      else if (flag[1] === '2') job.location = text.replace(/\s*\|\s*/g, ', ');
    }
    const foldedContract = foldDiacritics(contract).toLowerCase();
    job.employment_type = employmentCode(foldedContract);
    job.is_gig = GIG_TEXT.test(`${job.title} ${contract}`);

    const intro = elementsInnerHtml(region, /class="text_box big"/)[0];
    const blocks = elementsInnerHtml(region, /class="page_module_list"/)[0];
    const text = [intro, blocks].filter((part): part is string => part !== undefined).map((part) => stripPictographs(htmlToText(part)));
    const side = sideBox(html);
    job.description = [withoutGenderNotice(text.join('\n\n')), side.facts.join('\n')].filter((part) => part !== '').join('\n\n');
    if (side.contact !== '') job.contact_person = side.contact;

    const pay = payFromText(job.description);
    if (pay) Object.assign(job, pay);
    job.posted_at = /"datePosted"\s*:\s*"(\d{4}-\d{2}-\d{2})/.exec(html)?.[1] ?? '';
    return finishParsedJob(job);
  },
};
