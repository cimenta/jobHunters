import { GIG_TEXT } from './generic';
import { elementsInnerHtml, foldDiacritics, htmlToText } from './html';
import { emptyParsedJob, finishParsedJob, type JobParser } from './parsed-job';
import { parseSalaryText } from './salary';
import { hostIs, parseUrl } from './url';

/** The first element marked data-test-name="<name>", as text. Jooble's class names are scrambled and change; these marks stay. */
function marked(html: string, name: string): string {
  const inner = elementsInnerHtml(html, new RegExp(`data-test-name="${name}"`))[0];
  return inner === undefined ? '' : htmlToText(inner);
}

function periodOf(text: string): string {
  const unit = /\/\s*([^\s<]+)/.exec(foldDiacritics(text).toLowerCase())?.[1] ?? '';
  if (unit.startsWith('hod') || unit === 'h') return 'hour';
  if (unit.startsWith('mes')) return 'month';
  if (unit.startsWith('den')) return 'day';
  if (unit.startsWith('tyd')) return 'week';
  if (unit.startsWith('rok')) return 'year';
  return '';
}

/** Jooble lists several contract types ("Dočasný úvazek, Plný úvazek"): the most specific one wins. */
function employmentCode(folded: string): string {
  if (folded.includes('docasn') || folded.includes('brigad')) return 'temporary';
  if (folded.includes('castecn') || folded.includes('zkracen')) return 'part_time';
  if (folded.includes('plny')) return 'full_time';
  if (folded.includes('smlouv') || folded.includes('dohod')) return 'contractor';
  return '';
}

/**
 * Jooble (cz.jooble.org) shows the ad inside its own page: a header block with the title, the pay, the contract types, the
 * company and the region, and the text of the ad in a block of its own (marks data-test-name checked 2026-10-23). The page
 * sits behind a Cloudflare check, so this reader works on source code or on a piece of the page that the user pasted
 * (the whole page, or the part copied with "Copy outerHTML" in the browser tools). A Jooble ad only passes the reader on to
 * the site that placed it ("Přejít na ..."), so the original address is the better link to save when there is one.
 */
export const JOOBLE_PARSER: JobParser = {
  id: 'jooble',
  matches: (url) => hostIs(url, 'jooble.org') && /^\/(?:desc|jdp)\//.test(parseUrl(url)?.path ?? ''),
  parse(html) {
    const job = emptyParsedJob();
    const header = elementsInnerHtml(html, /data-test-name="_jdpHeaderBlock"/)[0] ?? html;
    const heading = elementsInnerHtml(header, /^<h1\b/i)[0];
    const rawTitle = heading === undefined ? '' : htmlToText(heading);
    // Jooble puts the kind of the ad after a bar: "Lector - Company | brigáda".
    const tag = /\s*\|\s*([^|]+)$/.exec(rawTitle);
    job.title = tag ? rawTitle.slice(0, tag.index).trim() : rawTitle;
    const kind = foldDiacritics(tag?.[1] ?? '').toLowerCase();

    job.company = marked(html, '_companyName');
    job.location = marked(html, '_regionLink');

    // The pay is the first short text after the title that holds an amount with a currency.
    const afterTitle = heading === undefined ? header : header.slice(header.indexOf(heading) + heading.length);
    for (const piece of elementsInnerHtml(afterTitle, /^<span\b/i)) {
      const text = htmlToText(piece);
      const salary = text.length <= 60 ? parseSalaryText(text) : undefined;
      if (salary) {
        job.salary_min = salary.min;
        job.salary_max = salary.max;
        job.salary_currency = salary.currency;
        job.salary_period = periodOf(text);
        break;
      }
    }

    const contracts = foldDiacritics(htmlToText(elementsInnerHtml(afterTitle, /class="[^"]*\bcaption\b[^"]*"/)[0] ?? '')).toLowerCase();
    job.employment_type = employmentCode(contracts);
    job.description = marked(html, '_jobDescriptionBlock');
    job.is_gig = kind.includes('brigad') || GIG_TEXT.test(`${job.title} ${contracts} ${job.description}`);
    return finishParsedJob(job);
  },
};
