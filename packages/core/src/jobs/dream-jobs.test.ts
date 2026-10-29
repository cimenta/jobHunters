import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DREAM_JOBS_PARSER } from './dream-jobs';
import { parseJobPage } from './registry';
import { dreamJobsId, jobUrlKey, normalizeJobUrl } from './url';

const fixture = (name: string) => readFileSync(new URL(`../../fixtures/dream-jobs/${name}`, import.meta.url), 'utf8');
const URL1 = 'https://dream.jobs/jobs?activeOpportunityId=21124&similarVacancyId=21124';

describe('dream.jobs reader: addresses', () => {
  it('takes the list page with an open ad, and nothing else', () => {
    expect(DREAM_JOBS_PARSER.matches(URL1)).toBe(true);
    expect(DREAM_JOBS_PARSER.matches('https://www.dream.jobs/jobs?activeOpportunityId=5')).toBe(true);
    expect(DREAM_JOBS_PARSER.matches('https://dream.jobs/jobs')).toBe(false);
    expect(DREAM_JOBS_PARSER.matches('https://dream.jobs/jobs?similarVacancyId=21124')).toBe(false);
    expect(DREAM_JOBS_PARSER.matches('https://dream.jobs/jobs?activeOpportunityId=abc')).toBe(false);
    expect(DREAM_JOBS_PARSER.matches('https://example.com/jobs?activeOpportunityId=21124')).toBe(false);
    expect(dreamJobsId(URL1)).toBe('21124');
  });

  it('keeps only the open ad in the address and gives every link to one ad the same key', () => {
    expect(normalizeJobUrl(URL1)).toBe('https://dream.jobs/jobs?activeOpportunityId=21124');
    expect(normalizeJobUrl('https://dream.jobs/jobs?similarVacancyId=9&activeOpportunityId=21124&utm_source=x')).toBe('https://dream.jobs/jobs?activeOpportunityId=21124');
    expect(jobUrlKey(URL1)).toBe('dream.jobs:21124');
    expect(jobUrlKey('https://dream.jobs/jobs?activeOpportunityId=21124')).toBe('dream.jobs:21124');
    expect(jobUrlKey('https://dream.jobs/jobs?activeOpportunityId=21125')).not.toBe(jobUrlKey(URL1));
  });
});

describe('dream.jobs reader', () => {
  const { parserId, job } = parseJobPage(fixture('ad.html'), URL1);

  it('is selected for such addresses and reads the ad named in the address, not another loaded one', () => {
    expect(parserId).toBe('dream-jobs');
    expect(job).toMatchObject({
      title: 'Insurance Agent (up to 75 000 CZK)',
      company: 'Example Insurance a.s.',
      location: 'Brno, Česko; Ostrava, Česko',
      remote: 'hybrid',
      is_hybrid: true,
      employment_type: 'full_time',
      posted_at: '2026-09-05',
      language: 'cs',
      missing: [],
    });
  });

  it('reads the monthly pay', () => {
    expect(job).toMatchObject({ salary_min: 35000, salary_max: 75000, salary_currency: 'CZK', salary_period: 'month' });
  });

  it('turns the markup of the text into lines and decodes entities', () => {
    expect(job.description).toContain('Jsme pojišťovna s dlouholetou tradicí & silným zázemím.');
    expect(job.description).toContain('- plánovat si vlastní schůzky');
    expect(job.description).not.toContain('<');
  });

  it('keeps the recruiter as the contact person', () => {
    expect(job.contact_person).toBe('Jana Nováková, jana.novakova@example.com');
  });

  it('reads another loaded ad when its number is in the address, with no pay and no recruiter', () => {
    const other = parseJobPage(fixture('ad.html'), 'https://dream.jobs/jobs?activeOpportunityId=30001').job;
    expect(other.title).toBe('Other Ad');
    expect(other).toMatchObject({ salary_min: null, salary_max: null, salary_currency: '', salary_period: '' });
    expect(other.contact_person).toBeUndefined();
  });

  it('maps the work environment and the contract', () => {
    const html = fixture('ad.html').replace(/"workEnvironment":"HYBRID"/g, '"workEnvironment":"REMOTE"').replace(/"type":\["FULL_TIME","CONTRACT"\]/g, '"type":["CONTRACT"]');
    expect(parseJobPage(html, URL1).job).toMatchObject({ remote: 'yes', is_remote: true, employment_type: 'contractor' });
    const onsite = fixture('ad.html').replace(/"workEnvironment":"HYBRID"/g, '"workEnvironment":"ON_SITE"');
    expect(parseJobPage(onsite, URL1).job.remote).toBe('no');
  });
});

describe('dream.jobs reader without the data of the page', () => {
  it('falls back to the title of the tab', () => {
    const { parserId, job } = parseJobPage(fixture('ad-no-data.html'), URL1);
    expect(parserId).toBe('dream-jobs');
    expect(job.title).toBe('Insurance Agent (up to 75 000 CZK)');
  });

  it('survives data that is cut off, and an ad that is not among the loaded ones', () => {
    const cut = fixture('ad.html').replace('"queries":[', '"queries":[{"broken":');
    expect(parseJobPage(cut, URL1).parserId).toBe('dream-jobs');
    const absent = parseJobPage(fixture('ad.html'), 'https://dream.jobs/jobs?activeOpportunityId=99999');
    expect(absent.parserId).toBe('dream-jobs');
    expect(absent.job.title).toBe('Insurance Agent (up to 75 000 CZK)');
  });

  it('does not throw on unrelated markup', () => {
    const { parserId, job } = parseJobPage('<html><body><p>Nothing here</p></body></html>', URL1);
    expect(parserId).toBe('dream-jobs');
    expect(job.missing.length).toBeGreaterThan(0);
  });
});
