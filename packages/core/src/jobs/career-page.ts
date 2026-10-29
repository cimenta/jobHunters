import { GIG_TEXT } from './generic';
import { elementsInnerHtml, foldDiacritics, htmlToText, metaContent } from './html';
import { emptyParsedJob, finishParsedJob, type JobParser, type ParsedJob } from './parsed-job';
import { parseSalaryText } from './salary';
import { careerPageKey } from './url';

const clean = (markup: string | undefined): string => (markup === undefined ? '' : htmlToText(markup).replace(/[ \t]+/g, ' ').trim());

function employmentCode(folded: string): string {
  if (folded.includes('plny uvazek')) return 'full_time';
  if (folded.includes('zkracen')) return 'part_time';
  if (folded.includes('brigad')) return 'temporary';
  return '';
}

/** "Brigádník (ž/m), Brno - Slatina - Detail pozice | Kaufland": the title and the company around the fixed words. */
function fromTabTitle(job: ParsedJob, html: string): void {
  const raw = metaContent(html, 'og:title') || clean(elementsInnerHtml(html, /^<title\b/i)[0]);
  const parts = /^(.*?)\s*-\s*Detail pozice\s*\|\s*(.+)$/.exec(raw);
  if (parts === null) return;
  job.title = parts[1]!.trim();
  job.company = parts[2]!.trim();
}

/**
 * The career pages that Alma Career runs for a company on a jobs.cz subdomain (kaufland.jobs.cz, checked 2026-10-30) draw
 * the ad with a script, so the page as it is downloaded has only the tab title ("<title> - Detail pozice | <company>") and
 * the first lines of the text in the meta description. This reader takes that; when the page source was copied from the
 * browser after the ad had been drawn (the elements pane, "Copy outerHTML"), it reads the whole ad instead: headline,
 * place, type of work and contract, pay, the text with its headings and the contact. The address key is the host with the
 * number of the ad, without the parameters that only say where the link came from.
 */
export const CAREER_PAGE_PARSER: JobParser = {
  id: 'career-page',
  matches: (url) => careerPageKey(url) !== '',
  parse(html) {
    const job = emptyParsedJob();
    fromTabTitle(job, html);
    job.description = metaContent(html, 'og:description');

    const heading = elementsInnerHtml(html, /^<h1\b/i)[0];
    const body = elementsInnerHtml(html, /class="[^"]*\bcp-detail__content\b/)[0];
    if (heading === undefined && body === undefined) return finishParsedJob(job);

    if (heading !== undefined) job.title = clean(heading);
    if (body !== undefined) job.description = clean(body);
    let contract = '';
    for (const item of elementsInnerHtml(html, /class="[^"]*\bcp-info__item\b/)) {
      const label = foldDiacritics(clean(elementsInnerHtml(item, /^<dt\b/i)[0])).toLowerCase();
      const value = clean(elementsInnerHtml(item, /^<dd\b/i)[0]);
      if (label.startsWith('typ uvazku')) job.employment_type = employmentCode(foldDiacritics(value).toLowerCase());
      else if (label.startsWith('typ smluvniho vztahu')) contract = value;
      else if (label.startsWith('mzda') || label.startsWith('plat')) {
        const salary = parseSalaryText(value);
        if (salary) Object.assign(job, { salary_min: salary.min, salary_max: salary.max, salary_currency: salary.currency, salary_period: salary.period });
      } else if (label.startsWith('misto pracoviste')) job.location = value;
    }
    if (job.location === '') job.location = clean(elementsInnerHtml(html, /class="[^"]*\bcse-header__item\b/)[0]);
    job.is_gig = GIG_TEXT.test(`${job.employment_type} ${contract}`) || GIG_TEXT.test(foldDiacritics(contract)) || GIG_TEXT.test(foldDiacritics(clean(elementsInnerHtml(html, /class="[^"]*\bcse-header__item\b/)[1])));

    const address = elementsInnerHtml(html, /^<address\b/i)[0];
    if (address !== undefined) {
      const company = clean(elementsInnerHtml(address, /^<strong\b/i)[0]);
      if (company !== '') job.company = company;
      const person = clean(address.replace(/<strong\b[\s\S]*?<\/strong>/i, '')).replace(/\s*\n\s*/g, ', ');
      if (person !== '') job.contact_person = person;
    }
    return finishParsedJob(job);
  },
};
