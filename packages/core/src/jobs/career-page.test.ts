import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CAREER_PAGE_PARSER } from './career-page';
import { parseJobPage } from './registry';
import { careerPageKey, jobUrlKey, normalizeJobUrl } from './url';

const fixture = (name: string) => readFileSync(new URL(`../../fixtures/career-page/${name}`, import.meta.url), 'utf8');
const URL1 = 'https://example.jobs.cz/detail-pozice?r=detail&id=2001463306&impressionId=38b66977-bf6c-4b7b-97bf-b786366b1f67';

describe('career page reader: addresses', () => {
  it('takes the ads of the company pages on jobs.cz subdomains, and not the portal itself', () => {
    expect(CAREER_PAGE_PARSER.matches(URL1)).toBe(true);
    expect(CAREER_PAGE_PARSER.matches('https://example.jobs.cz/detail-pozice?id=5')).toBe(true);
    expect(CAREER_PAGE_PARSER.matches('https://example.jobs.cz/volne-pozice')).toBe(false);
    expect(CAREER_PAGE_PARSER.matches('https://example.jobs.cz/detail-pozice')).toBe(false);
    expect(CAREER_PAGE_PARSER.matches('https://www.jobs.cz/rpd/1234567890/')).toBe(false);
    expect(CAREER_PAGE_PARSER.matches('https://jobs.cz/detail-pozice?id=5')).toBe(false);
    expect(CAREER_PAGE_PARSER.matches('https://example.com/detail-pozice?id=5')).toBe(false);
  });

  it('keeps only the number of the ad and gives every link to it the same key', () => {
    expect(careerPageKey(URL1)).toBe('example.jobs.cz:2001463306');
    expect(normalizeJobUrl(URL1)).toBe('https://example.jobs.cz/detail-pozice?id=2001463306');
    expect(jobUrlKey(URL1)).toBe('example.jobs.cz:2001463306');
    expect(jobUrlKey('https://example.jobs.cz/detail-pozice?id=2001463306')).toBe(jobUrlKey(URL1));
    expect(jobUrlKey('https://example.jobs.cz/detail-pozice?id=2001463307')).not.toBe(jobUrlKey(URL1));
    expect(normalizeJobUrl('https://www.jobs.cz/rpd/1234567890/?rps=233')).toBe('https://www.jobs.cz/rpd/1234567890/');
  });
});

describe('career page reader on the page as it is downloaded', () => {
  const { parserId, job } = parseJobPage(fixture('ad-static.html'), URL1);

  it('takes the title and the company from the tab title and the first lines from the meta description', () => {
    expect(parserId).toBe('career-page');
    expect(job).toMatchObject({ title: 'Brigádník (ž/m), Brno - Slatina', company: 'Example Retail' });
    expect(job.description).toContain('Hledáš DPP nebo DPČ?');
  });
});

describe('career page reader on the page after the ad was drawn', () => {
  const { parserId, job } = parseJobPage(fixture('ad-rendered.html'), URL1);

  it('reads headline, company, place, work and pay', () => {
    expect(parserId).toBe('career-page');
    expect(job).toMatchObject({
      title: 'Brigádník (ž/m), Brno - Slatina',
      company: 'Example Retail v.o.s.',
      location: 'Ulice 1/2, 62700 Brno - Slatina, Česká republika',
      employment_type: 'temporary',
      is_gig: true,
      salary_min: 190, salary_max: 202, salary_currency: 'CZK', salary_period: 'hour',
      language: 'cs',
      missing: [],
    });
  });

  it('takes the whole text with its headings and lists', () => {
    expect(job.description).toContain('Co je u nás volného');
    expect(job.description).toContain('- bylo ti už 18 let');
    expect(job.description).not.toContain('Informace o pozici');
  });

  it('keeps the contact person', () => {
    expect(job.contact_person).toBe('Jana Nováková');
  });

  it('takes the place from the header when the facts have none', () => {
    const html = fixture('ad-rendered.html').replace(/<div class="cp-info__item cp-info__item--locality">[\s\S]*?<\/div>/, '');
    expect(parseJobPage(html, URL1).job.location).toBe('Ulice 1/2, 62700 Brno - Slatina, Česká republika');
  });
});

describe('career page reader on odd input', () => {
  it('does not throw on unrelated markup', () => {
    const { parserId, job } = parseJobPage('<html><body><p>Nothing here</p></body></html>', URL1);
    expect(parserId).toBe('career-page');
    expect(job.missing.length).toBeGreaterThan(0);
  });
});
