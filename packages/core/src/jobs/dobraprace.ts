import { GIG_TEXT } from './generic';
import { elementsInnerHtml, foldDiacritics, htmlToText, stripPictographs, withoutElements } from './html';
import { emptyParsedJob, finishParsedJob, type JobParser } from './parsed-job';
import { parseSalaryText } from './salary';
import { dobrapraceId } from './url';

const clean = (markup: string | undefined): string => (markup === undefined ? '' : stripPictographs(htmlToText(markup)).replace(/[ \t]+/g, ' ').trim());

function employmentCode(folded: string): string {
  if (/\bhpp\b|plny uvazek/.test(folded)) return 'full_time';
  if (/\bdpp\b|\bdpc\b|brigad/.test(folded)) return 'temporary';
  if (folded.includes('zkracen') || folded.includes('castecny')) return 'part_time';
  return '';
}

/**
 * DobráPráce.cz (checked 2026-11-12): the page has structured data, but its pay is a monthly figure worked out from the hourly
 * one and its text is only a summary, so this reader takes the visible page: the headline, the facts bar (Plat, Typ úvazku,
 * Místo pracoviště, Klient, Zadavatel, Odpovědná osoba) and the text with its headings (Pracovní náplň, Požadujeme, Nabízíme).
 * Links look like `/<number>-<words-of-the-title>.html`; the number is the key of the ad.
 */
export const DOBRAPRACE_PARSER: JobParser = {
  id: 'dobraprace',
  matches: (url) => dobrapraceId(url) !== '',
  parse(html) {
    const job = emptyParsedJob();
    job.title = clean(elementsInnerHtml(html, /^<h1\b/i)[0]);

    const facts = new Map<string, { text: string; markup: string }>();
    const bar = elementsInnerHtml(html, /^<div\b[^>]*id="jobDetail-infobar"/i)[0] ?? '';
    for (const item of elementsInnerHtml(bar, /^<li\b/i)) {
      const label = clean(elementsInnerHtml(item, /^<span\b[^>]*class="label-note"/i)[0]);
      if (label === '') continue;
      const text = clean(item).replace(label, '').trim();
      facts.set(foldDiacritics(label).toLowerCase().replace(/:\s*$/, ''), { text, markup: item });
    }

    const salary = parseSalaryText(facts.get('plat')?.text ?? '');
    if (salary) Object.assign(job, { salary_min: salary.min, salary_max: salary.max, salary_currency: salary.currency, salary_period: salary.period });

    const contract = facts.get('typ uvazku')?.text ?? '';
    job.employment_type = employmentCode(foldDiacritics(contract).toLowerCase());
    job.is_gig = GIG_TEXT.test(foldDiacritics(contract)) || GIG_TEXT.test(foldDiacritics(job.title));
    if (job.is_gig && job.employment_type === '') job.employment_type = 'temporary';

    const place = facts.get('misto pracoviste');
    if (place) {
      const places = elementsInnerHtml(place.markup, /^<a\b/i).map(clean).filter((name) => name !== '');
      job.location = places.length > 0 ? places.join(', ') : place.text;
    }

    job.company = facts.get('zadavatel')?.text || facts.get('klient')?.text || '';
    job.contact_person = facts.get('odpovedna osoba')?.text ?? '';

    // The ID and age line and the reply button belong to the page and not to the ad.
    const main = withoutElements(elementsInnerHtml(html, /^<main\b/i)[0] ?? '', /^<div\b[^>]*class="(job-system-info|no-print)"/i);
    job.description = clean(main);
    return finishParsedJob(job);
  },
};
