import { GIG_TEXT } from './generic';
import { elementsInnerHtml, foldDiacritics, htmlToText } from './html';
import { emptyParsedJob, finishParsedJob, type JobParser } from './parsed-job';
import { parseSalaryText } from './salary';
import { hostIs } from './url';

function employmentCode(folded: string): string {
  if (folded.includes('plny uvazek')) return 'full_time';
  if (folded.includes('zkracen')) return 'part_time';
  if (folded.includes('brigad')) return 'temporary';
  return '';
}

/** Modelled on the data-test attributes seen on Jobs.cz ad pages (2026-10-11); the page has no JSON-LD. */
export const JOBS_CZ_PARSER: JobParser = {
  id: 'jobs-cz',
  matches: (url) => hostIs(url, 'jobs.cz'),
  parse(html) {
    const job = emptyParsedJob();
    const heading = elementsInnerHtml(html, /^<h1\b/i)[0];
    job.title = heading === undefined ? '' : htmlToText(heading);
    const location = elementsInnerHtml(html, /data-test="jd-info-location"/)[0];
    job.location = location === undefined ? '' : htmlToText(location);

    let contract = '';
    for (const item of elementsInnerHtml(html, /data-test="jd-info-item"/)) {
      const label = foldDiacritics(htmlToText(elementsInnerHtml(item, /class="[^"]*accessibility-hidden/)[0] ?? '')).toLowerCase();
      const value = htmlToText(elementsInnerHtml(item, /^<p\b/i)[0] ?? '');
      if (label === 'spolecnost') job.company = value;
      else if (label.startsWith('typ pracovniho pomeru')) job.employment_type = employmentCode(foldDiacritics(value).toLowerCase());
      else if (label.startsWith('typ smluvniho vztahu')) contract = value;
      else if (label.startsWith('mzda') || label.startsWith('plat')) {
        const salary = parseSalaryText(value);
        if (salary) {
          job.salary_min = salary.min;
          job.salary_max = salary.max;
          job.salary_currency = salary.currency;
          job.salary_period = salary.period;
        }
      }
    }
    job.is_gig = GIG_TEXT.test(`${job.employment_type} ${contract}`) || GIG_TEXT.test(foldDiacritics(contract));

    const body = elementsInnerHtml(html, /data-test="jd-body-richtext"/)[0];
    job.description = body === undefined ? '' : htmlToText(body).replace(/^Pracovní nabídka\s*\n+/, '');
    return finishParsedJob(job);
  },
};
