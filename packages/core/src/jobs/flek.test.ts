import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FLEK_PARSER } from './flek';
import { parseJobPage } from './registry';
import { jobUrlKey, normalizeJobUrl } from './url';

const html = readFileSync(new URL('../../fixtures/flek/ad.html', import.meta.url), 'utf8');
const URL1 = 'https://www.flek.cz/nabidka/pracovnik-linky-brno-ranni-smeny/6574995/?utm_source=jooble&utm_medium=cpc&utm_campaign=Temporary_jobs_ANSWER1';

describe('Flek reader: addresses', () => {
  it('takes the ads and nothing else', () => {
    expect(FLEK_PARSER.matches(URL1)).toBe(true);
    expect(FLEK_PARSER.matches('https://flek.cz/nabidka/x/1')).toBe(true);
    expect(FLEK_PARSER.matches('https://www.flek.cz/brigady/brno/')).toBe(false);
    expect(FLEK_PARSER.matches('https://www.flek.cz/firma/example/7/')).toBe(false);
    expect(FLEK_PARSER.matches('https://example.com/nabidka/x/1/')).toBe(false);
  });

  it('removes the tracking parameters and keys an ad by its number', () => {
    expect(normalizeJobUrl(URL1)).toBe('https://www.flek.cz/nabidka/pracovnik-linky-brno-ranni-smeny/6574995/');
    expect(jobUrlKey(URL1)).toBe('flek.cz:6574995');
    expect(jobUrlKey('https://flek.cz/nabidka/another-slug/6574995')).toBe('flek.cz:6574995');
  });
});

describe('Flek reader', () => {
  const job = FLEK_PARSER.parse(html, URL1);

  it('reads the heading, the city without the country, the contract and the gig mark', () => {
    expect(job).toMatchObject({ title: 'Pracovník linky | Brno | Ranní směny!', location: 'Brno', employment_type: 'full_time', is_gig: false });
  });

  it('takes the text of the ad without the notice about men and women', () => {
    expect(job.description).toContain('Hledáte stabilní zaměstnání');
    expect(job.description).toContain('cleanroomu');
    expect(job.description).not.toMatch(/NABÍRÁME|Naše inzeráty/);
  });

  it('is merged over the generic result, which brings the company, the pay and the dates', () => {
    const result = parseJobPage(html, URL1);
    expect(result.parserId).toBe('flek');
    expect(result.job).toMatchObject({
      company: 'Example Staffing',
      location: 'Brno',
      salary_min: 30000,
      salary_max: 40000,
      salary_currency: 'CZK',
      salary_period: 'month',
      posted_at: '2026-10-19',
    });
  });
});

describe('Flek reader: edge cases', () => {
  it('knows a brigáda as a gig and reads the other contracts', () => {
    expect(FLEK_PARSER.parse(html.replace('Plný úvazek', 'Brigáda'), URL1)).toMatchObject({ employment_type: 'temporary', is_gig: true });
    expect(FLEK_PARSER.parse(html.replace('Plný úvazek', 'Zkrácený úvazek'), URL1).employment_type).toBe('part_time');
  });

  it('leaves the contract empty when the ad has none', () => {
    const empty = html.replace(/(class="summary-label">Úvazek:<\/span> <span class="summary-value">)[^<]*/, '$1');
    expect(FLEK_PARSER.parse(empty, URL1)).toMatchObject({ employment_type: '', is_gig: false });
  });

  it('decodes a description whose markup arrives escaped', () => {
    const escaped = html.replace(/"description":"[^"]*"/, '"description":"&lt;p&gt;Escaped text of the ad&lt;/p&gt;"');
    expect(FLEK_PARSER.parse(escaped, URL1).description).toBe('Escaped text of the ad');
  });

  it('falls back to the visible text when there is no JSON-LD description', () => {
    const plain = html.replace(/"description":"[^"]*",/, '');
    const job = FLEK_PARSER.parse(plain, URL1);
    expect(job.description).toContain('Hledáte stabilní zaměstnání');
    expect(job.description).not.toMatch(/NABÍRÁME/);
  });

  it('copes with a page that has only a heading', () => {
    const job = FLEK_PARSER.parse('<html><body><h1>Only a title</h1></body></html>', URL1);
    expect(job).toMatchObject({ title: 'Only a title', location: '', description: '', employment_type: '' });
  });
});
