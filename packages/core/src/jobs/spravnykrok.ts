import { GIG_TEXT } from './generic';
import { elementsInnerHtml, foldDiacritics, htmlToText, titleTag } from './html';
import { emptyParsedJob, finishParsedJob, type JobParser } from './parsed-job';
import { parseSalaryText } from './salary';
import { hostIs, parseUrl } from './url';

/** An ad of Správný krok: `/prace/nabidka/<id>-<slug>.html`. */
const AD_PATH = /^\/prace\/nabidka\/\d+-[a-z0-9-]+\.html$/i;
const ANSWER_BLOCK = /<div class="\s*mb-20\s*">/g;

/** The lines "Label: <strong>value</strong>" above the text of the ad, label folded to lower case. */
function facts(html: string): Map<string, string> {
  const rows = new Map<string, string>();
  for (const match of html.matchAll(/([^<>:\n]{2,60}):\s*<strong>([\s\S]*?)<\/strong>/g)) {
    const key = foldDiacritics(htmlToText(match[1]!)).toLowerCase().trim();
    // The page may break a value over two lines ("Brno,\n  Jihomoravský"): it is one line of text.
    if (key !== '' && !rows.has(key)) rows.set(key, htmlToText(match[2]!).replace(/\s+/g, ' ').trim());
  }
  return rows;
}

function periodOf(text: string): string {
  const unit = /(?:za\s+|\/\s*)(mesic|mes|hodinu|hod|den|tyden|tyd|rok)/.exec(foldDiacritics(text).toLowerCase())?.[1] ?? '';
  if (unit.startsWith('mes')) return 'month';
  if (unit.startsWith('hod')) return 'hour';
  if (unit.startsWith('den')) return 'day';
  if (unit.startsWith('tyd')) return 'week';
  if (unit.startsWith('rok')) return 'year';
  return '';
}

function employmentCode(folded: string): string {
  if (folded.includes('brigad') || folded.includes('docasn')) return 'temporary';
  if (folded.includes('zkracen') || folded.includes('castecn')) return 'part_time';
  if (folded.includes('plny')) return 'full_time';
  if (folded.includes('dpp') || folded.includes('dpc') || folded.includes('dohod')) return 'contractor';
  return '';
}

/**
 * Správný krok (spravnykrok.cz, the staffing portal of the same family as Inwork) has no JSON-LD (checked 2026-10-23): the
 * ad page holds the heading, a block of lines "Label: value" (pay, contract, place), two "Odpověď na inzerát" buttons with
 * the text of the ad between them, and the company with a contact person in a block of its own.
 */
export const SPRAVNYKROK_PARSER: JobParser = {
  id: 'spravnykrok',
  matches: (url) => hostIs(url, 'spravnykrok.cz') && AD_PATH.test(parseUrl(url)?.path ?? ''),
  parse(html) {
    const job = emptyParsedJob();
    const region = elementsInnerHtml(html, /class="[^"]*content--FrontAd/)[0] ?? html;
    const heading = elementsInnerHtml(region, /^<h1\b/i)[0];
    job.title = heading === undefined ? '' : htmlToText(heading);

    const afterHeading = region.indexOf('</h1>') + 5;
    const buttons = [...region.matchAll(ANSWER_BLOCK)].map((match) => match.index ?? 0).filter((index) => index >= afterHeading);
    const info = region.indexOf('<div class="companyInfo"');
    const factsHtml = region.slice(afterHeading, buttons[0] ?? (info >= 0 ? info : region.length));
    const rows = facts(factsHtml);

    const pay = rows.get('plat') ?? rows.get('mzda') ?? '';
    const salary = parseSalaryText(pay);
    if (salary) {
      job.salary_min = salary.min;
      job.salary_max = salary.max;
      job.salary_currency = salary.currency;
      job.salary_period = periodOf(pay) || salary.period;
    }
    const contract = foldDiacritics(rows.get('typ uvazku') ?? '').toLowerCase();
    job.employment_type = employmentCode(contract);
    job.location = rows.get('lokalita pracoviste') ?? '';
    job.is_gig = GIG_TEXT.test(`${job.title} ${[...rows.values()].join(' ')}`);

    const first = buttons[0];
    const start = first === undefined ? afterHeading : region.indexOf('</div>', first) + 6;
    const end = buttons[1] ?? (info >= 0 ? info : region.length);
    job.description = htmlToText(region.slice(start, end));

    const card = elementsInnerHtml(region, /class="companyInfo"/)[0];
    const name = card === undefined ? '' : htmlToText(elementsInnerHtml(card, /^<h3\b/i)[0] ?? '');
    job.company = name !== '' ? name : (/Nabídka práce v (.+?)\s*\|/.exec(titleTag(html))?.[1] ?? '');
    return finishParsedJob(job);
  },
};
