import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EASY_PRACE_PARSER } from './easy-prace';
import { parseJobPage } from './registry';
import { jobUrlKey, normalizeJobUrl } from './url';

const fixture = (name: string) => readFileSync(new URL(`../../fixtures/easy-prace/${name}`, import.meta.url), 'utf8');
const URL1 = 'https://www.easy-prace.cz/nabidka/skladnik-brno-az-42-000-kc/635110?utm_source=jooble_org&utm_medium=cpc&utm_source=jooble&utm_medium=cpc&utm_campaign=premium';

describe('Easy-práce reader: addresses', () => {
  it('takes the ad pages and nothing else', () => {
    expect(EASY_PRACE_PARSER.matches(URL1)).toBe(true);
    expect(EASY_PRACE_PARSER.matches('https://easy-prace.cz/nabidka/x/12')).toBe(true);
    expect(EASY_PRACE_PARSER.matches('https://www.easy-prace.cz/nabidka')).toBe(false);
    expect(EASY_PRACE_PARSER.matches('https://www.easy-prace.cz/firma/21213-example-staff-sro')).toBe(false);
    expect(EASY_PRACE_PARSER.matches('https://example.com/nabidka/x/12')).toBe(false);
  });

  it('gives every link to one ad the same key and drops the tracking parameters', () => {
    expect(normalizeJobUrl(URL1)).toBe('https://www.easy-prace.cz/nabidka/skladnik-brno-az-42-000-kc/635110');
    expect(jobUrlKey(URL1)).toBe('easy-prace.cz:635110');
    expect(jobUrlKey('https://easy-prace.cz/nabidka/other-words/635110/')).toBe(jobUrlKey(URL1));
    expect(jobUrlKey('https://www.easy-prace.cz/nabidka/skladnik-brno/635111')).not.toBe(jobUrlKey(URL1));
  });
});

describe('Easy-práce reader on an ad', () => {
  const { parserId, job } = parseJobPage(fixture('ad.html'), URL1);

  it('reads headline, company, places, pay and type of work', () => {
    expect(parserId).toBe('easy-prace');
    expect(job).toMatchObject({
      title: 'Skladník - Brno, až 42 000 Kč',
      company: 'Example Staff s.r.o.',
      location: 'Brno, Blansko',
      employment_type: 'full_time',
      salary_min: 32000, salary_max: 42000, salary_currency: 'CZK', salary_period: 'month',
      language: 'cs',
      missing: [],
    });
  });

  it('takes the text with its headings and leaves out the company blurb', () => {
    expect(job.description).toContain('Popis pracovní nabídky');
    expect(job.description).toContain('- Práce ve skladu');
    expect(job.description).toContain('Nabízíme');
    expect(job.description).not.toContain('Regionální agentura');
  });

  it('keeps the contact person without the company line', () => {
    expect(job.contact_person).toBe('Jana Nováková');
  });
});

describe('Easy-práce reader on odd input', () => {
  it('takes the company from the contact block when the page has no company header', () => {
    const { job } = parseJobPage(fixture('ad-minimal.html'), URL1);
    expect(job).toMatchObject({ title: 'Skladník - Brno', company: 'Example Staff s.r.o.' });
    expect(job.contact_person ?? '').toBe('');
  });

  it('does not throw on unrelated markup', () => {
    const { parserId, job } = parseJobPage('<html><body><p>Nothing here</p></body></html>', URL1);
    expect(parserId).toBe('easy-prace');
    expect(job.missing.length).toBeGreaterThan(0);
  });
});
