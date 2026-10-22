import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NELISA_PARSER } from './nelisa';
import { parseJobPage } from './registry';
import { jobUrlKey, normalizeJobUrl } from './url';

const html = readFileSync(new URL('../../fixtures/nelisa/offer.html', import.meta.url), 'utf8');
const URL1 = 'https://example-market-cz.nelisa.com/cs/offer/11111111-2222-3333-4444-555555555555?utm_source=czjooble&utm_medium=cpc&utm_content=x&utm_campaign=y';

describe('Nelisa reader: addresses', () => {
  it('takes the offer pages on any company subdomain, with tracking parameters, and nothing else', () => {
    expect(NELISA_PARSER.matches(URL1)).toBe(true);
    expect(NELISA_PARSER.matches('https://nelisa.com/cs/offer/11111111-2222-3333-4444-555555555555')).toBe(true);
    expect(NELISA_PARSER.matches('https://example-market-cz.nelisa.com/cs')).toBe(false);
    expect(NELISA_PARSER.matches('https://example-market-cz.nelisa.com/cs/offers')).toBe(false);
    expect(NELISA_PARSER.matches('https://example.com/cs/offer/11111111-2222-3333-4444-555555555555')).toBe(false);
  });

  it('removes the tracking parameters and gives every link to one offer the same key', () => {
    expect(normalizeJobUrl(URL1)).toBe('https://example-market-cz.nelisa.com/cs/offer/11111111-2222-3333-4444-555555555555');
    expect(jobUrlKey(URL1)).toBe('nelisa:11111111-2222-3333-4444-555555555555');
    expect(jobUrlKey('https://other.nelisa.com/en/offer/11111111-2222-3333-4444-555555555555/')).toBe(jobUrlKey(URL1));
  });
});

describe('Nelisa reader', () => {
  const job = NELISA_PARSER.parse(html, URL1);

  it('reads the headline without the pictures and the closing pay, the company and the place', () => {
    expect(job.title).toBe('Chuť do práce? Naučíme Vás všechno | Prodavač/ka Ukázka');
    expect(job).toMatchObject({ company: 'Example Market CZ, s.r.o.', location: 'Ukázková, Brno', language: 'cs' });
  });

  it('reads "od 36 000 Kč měsíčně" as a monthly lower limit of the pay, and the contract', () => {
    expect(job).toMatchObject({ salary_min: 36000, salary_max: null, salary_currency: 'CZK', salary_period: 'month', employment_type: 'full_time', is_gig: false });
  });

  it('takes the text of the ad, with its headings, lists and lines, without pictures, the video and the facts blocks', () => {
    expect(job.description.split('\n')[0]).toBe('Hledáte práci, kde dostanete prostor naučit se něco nového?');
    expect(job.description).toContain('Ideální kandidát:');
    expect(job.description).toContain('- má chuť pracovat a učit se nové věci,');
    expect(job.description).toContain('Pošlete nám svůj životopis.');
    expect(job.description).not.toMatch(/Obchodní podmínky|Mám zájem|Délka úvazku|Firemní akce|youtube/);
    expect(/\p{Extended_Pictographic}|⁠/u.test(job.title + job.description)).toBe(false);
    expect(job.missing).toEqual([]);
  });

  it('is merged over the generic result by the registry', () => {
    const result = parseJobPage(html, URL1);
    expect(result.parserId).toBe('nelisa');
    expect(result.job).toMatchObject({ company: 'Example Market CZ, s.r.o.', salary_min: 36000 });
  });
});

describe('Nelisa reader: edge cases', () => {
  it('reads a range, an upper limit and an hourly pay', () => {
    const range = html.replaceAll('od 36 000 Kč měsíčně', '30 000 - 40 000 Kč měsíčně');
    expect(NELISA_PARSER.parse(range, URL1)).toMatchObject({ salary_min: 30000, salary_max: 40000, salary_period: 'month' });
    const upper = html.replaceAll('od 36 000 Kč měsíčně', 'do 40 000 Kč měsíčně');
    expect(NELISA_PARSER.parse(upper, URL1)).toMatchObject({ salary_min: null, salary_max: 40000 });
    const hourly = html.replaceAll('od 36 000 Kč měsíčně', '200 Kč hodinově');
    expect(NELISA_PARSER.parse(hourly, URL1)).toMatchObject({ salary_min: 200, salary_max: 200, salary_period: 'hour' });
  });

  it('knows a part-time brigáda made by an agreement as a gig, and keeps a title that has no pay at its end', () => {
    const changed = html.replaceAll('Plný úvazek', 'Brigáda').replace('Pracovní smlouva', 'DPP').replace(' | 36 000 Kč</h1>', '</h1>');
    expect(NELISA_PARSER.parse(changed, URL1)).toMatchObject({ employment_type: 'temporary', is_gig: true, title: 'Chuť do práce? Naučíme Vás všechno | Prodavač/ka Ukázka' });
    const agreement = html.replaceAll('Plný úvazek', 'Jiný').replace('Pracovní smlouva', 'DPP');
    expect(NELISA_PARSER.parse(agreement, URL1)).toMatchObject({ employment_type: 'contractor', is_gig: true });
  });

  it('takes the company from the logo when it is not under the heading, and the place named "Lokalita" when there is no workplace', () => {
    const changed = html.replace(/<p class="mt-4">[\s\S]*?<\/p>/, '').replace(/<div id="misto-pracoviste">[\s\S]*?<\/dd><\/div>/, '').replace(/<div class="max-w-full">[\s\S]*?<\/dd><\/div>/, '');
    expect(NELISA_PARSER.parse(changed, URL1)).toMatchObject({ company: 'Example Market CZ, s.r.o.', location: 'Brno' });
  });

  it('copes with a page that has only a heading', () => {
    const job = NELISA_PARSER.parse('<html><body><h1>Only a title</h1></body></html>', URL1);
    expect(job).toMatchObject({ title: 'Only a title', company: '', location: '', description: '', salary_min: null });
  });
});
