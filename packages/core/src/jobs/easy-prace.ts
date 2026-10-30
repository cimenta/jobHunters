import { GIG_TEXT } from './generic';
import { elementsInnerHtml, foldDiacritics, htmlToText, stripPictographs } from './html';
import { emptyParsedJob, finishParsedJob, type JobParser } from './parsed-job';
import { parseSalaryText } from './salary';
import { easyPraceId } from './url';

const clean = (markup: string | undefined): string => (markup === undefined ? '' : stripPictographs(htmlToText(markup)).replace(/[ \t]+/g, ' ').trim());

function employmentCode(folded: string): string {
  if (folded.includes('plny uvazek')) return 'full_time';
  if (folded.includes('zkracen') || folded.includes('castecny')) return 'part_time';
  if (folded.includes('brigad')) return 'temporary';
  return '';
}

/**
 * Easy-práce.cz (checked 2026-10-30): the ad has no structured data, so this reader takes the visible page: the headline,
 * the pay range under it, the labelled facts (Lokalita, Úvazek, Vzdělání), the text with its headings (Popis pracovní nabídky,
 * Požadujeme, Nabízíme), the company and the contact person. Links look like `/nabidka/<words-of-the-title>/<number>`; the
 * number is the key of the ad.
 */
export const EASY_PRACE_PARSER: JobParser = {
  id: 'easy-prace',
  matches: (url) => easyPraceId(url) !== '',
  parse(html) {
    const job = emptyParsedJob();
    job.title = clean(elementsInnerHtml(html, /^<h1\b/i)[0]);

    const salary = parseSalaryText(clean(elementsInnerHtml(html, /^<div\b[^>]*class="NabidkaDetail-salary"/i)[0]));
    if (salary) Object.assign(job, { salary_min: salary.min, salary_max: salary.max, salary_currency: salary.currency, salary_period: salary.period });

    let contract = '';
    for (const item of elementsInnerHtml(html, /^<div\b[^>]*class="NabidkaDetail-infoItem"/i)) {
      const label = foldDiacritics(clean(elementsInnerHtml(item, /^<p\b[^>]*class="NabidkaDetail-infoLabel"/i)[0])).toLowerCase();
      const valueMarkup = elementsInnerHtml(item, /^<div\b[^>]*class="NabidkaDetail-infoValue"/i)[0];
      if (label === 'lokalita') {
        const places = elementsInnerHtml(valueMarkup ?? '', /^<a\b[^>]*class="map-link"/i).map(clean).filter((place) => place !== '');
        job.location = places.length > 0 ? places.join(', ') : clean(valueMarkup).replace(/\s*a další\s*$/i, '');
      } else if (label === 'uvazek') {
        contract = clean(valueMarkup);
        job.employment_type = employmentCode(foldDiacritics(contract).toLowerCase());
      }
    }
    job.is_gig = GIG_TEXT.test(foldDiacritics(contract));

    const rows = elementsInnerHtml(html, /^<div\b[^>]*class="NabidkaDetail-contentRow"/i).map(clean).filter((row) => row !== '');
    job.description = rows.join('\n\n');

    const contact = elementsInnerHtml(html, /^<div\b[^>]*class="NabidkaDetail-contactPerson"/i)[0] ?? '';
    const items = elementsInnerHtml(contact, /^<div\b[^>]*class="NabidkaDetail-contactPersonItem"/i).map(clean).filter((item) => item !== '');
    job.company = clean(elementsInnerHtml(html, /^<h2\b[^>]*class="NabidkaDetail-companyHeaderTitle"/i)[0]) || (items[0] ?? '');
    if (items.length > 1) job.contact_person = items.slice(1).join(', ');
    return finishParsedJob(job);
  },
};
