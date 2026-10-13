import { GIG_TEXT } from './generic';
import { elementsInnerHtml, foldDiacritics, htmlToText } from './html';
import { emptyParsedJob, finishParsedJob, type JobParser, type ParsedJob } from './parsed-job';
import { parseSalaryText } from './salary';
import { hostIs } from './url';

function employmentCode(folded: string): string {
  if (folded.includes('plny uvazek')) return 'full_time';
  if (folded.includes('zkracen')) return 'part_time';
  if (folded.includes('brigad')) return 'temporary';
  return '';
}

function applySalary(job: ParsedJob, text: string): void {
  const salary = parseSalaryText(text);
  if (!salary) return;
  job.salary_min = salary.min;
  job.salary_max = salary.max;
  job.salary_currency = salary.currency;
  job.salary_period = salary.period;
}

/**
 * Modelled on the data-test attributes seen on Jobs.cz ad pages (2026-10-11, the salary block and the second place of
 * work checked 2026-10-13); the page has no JSON-LD. The places of work are shown twice (above and below the facts), and
 * the salary is a block of its own (data-test="jd-salary") besides the older "Mzda" item among the position facts.
 */
export const JOBS_CZ_PARSER: JobParser = {
  id: 'jobs-cz',
  matches: (url) => hostIs(url, 'jobs.cz'),
  parse(html) {
    const job = emptyParsedJob();
    const heading = elementsInnerHtml(html, /^<h1\b/i)[0];
    job.title = heading === undefined ? '' : htmlToText(heading);
    const places = elementsInnerHtml(html, /data-test="jd-info-location"/).map((place) => htmlToText(place)).filter((place) => place !== '');
    job.location = [...new Set(places)].join(', ');
    const salaryBlock = elementsInnerHtml(html, /data-test="jd-salary"/)[0];
    if (salaryBlock !== undefined) applySalary(job, htmlToText(elementsInnerHtml(salaryBlock, /^<p/i)[0] ?? salaryBlock));

    let contract = '';
    for (const item of elementsInnerHtml(html, /data-test="jd-info-item"/)) {
      const label = foldDiacritics(htmlToText(elementsInnerHtml(item, /class="[^"]*accessibility-hidden/)[0] ?? '')).toLowerCase();
      const value = htmlToText(elementsInnerHtml(item, /^<p\b/i)[0] ?? '');
      if (label === 'spolecnost') job.company = value;
      else if (label.startsWith('typ pracovniho pomeru')) job.employment_type = employmentCode(foldDiacritics(value).toLowerCase());
      else if (label.startsWith('typ smluvniho vztahu')) contract = value;
      else if ((label.startsWith('mzda') || label.startsWith('plat')) && job.salary_currency === '') applySalary(job, value);
    }
    job.is_gig = GIG_TEXT.test(`${job.employment_type} ${contract}`) || GIG_TEXT.test(foldDiacritics(contract));

    const body = elementsInnerHtml(html, /data-test="jd-body-richtext"/)[0];
    job.description = body === undefined ? '' : htmlToText(body).replace(/^Pracovní nabídka\s*\n+/, '');
    return finishParsedJob(job);
  },
};
