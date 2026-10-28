import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GREENHOUSE_PARSER } from './greenhouse';
import { parseJobPage } from './registry';
import { jobUrlKey, normalizeJobUrl } from './url';

const fixture = (name: string) => readFileSync(new URL(`../../fixtures/greenhouse/${name}`, import.meta.url), 'utf8');
const URL1 = 'https://job-boards.greenhouse.io/examplesoft/jobs/4000000001?utm_source=Otta';

describe('Greenhouse reader: addresses', () => {
  it('takes the ad pages of the job boards, also with tracking parameters, and nothing else', () => {
    expect(GREENHOUSE_PARSER.matches(URL1)).toBe(true);
    expect(GREENHOUSE_PARSER.matches('https://job-boards.eu.greenhouse.io/examplesoft/jobs/4000000001')).toBe(true);
    expect(GREENHOUSE_PARSER.matches('https://boards.greenhouse.io/examplesoft/jobs/4000000001')).toBe(true);
    expect(GREENHOUSE_PARSER.matches('https://job-boards.greenhouse.io/examplesoft')).toBe(false);
    expect(GREENHOUSE_PARSER.matches('https://job-boards.greenhouse.io/examplesoft/jobs/')).toBe(false);
    expect(GREENHOUSE_PARSER.matches('https://example.com/examplesoft/jobs/4000000001')).toBe(false);
  });

  it('removes the tracking parameters and gives every link to one ad the same key', () => {
    expect(normalizeJobUrl(URL1)).toBe('https://job-boards.greenhouse.io/examplesoft/jobs/4000000001');
    expect(normalizeJobUrl('https://boards.greenhouse.io/examplesoft/jobs/4000000001?gh_src=abc123')).toBe('https://boards.greenhouse.io/examplesoft/jobs/4000000001');
    expect(jobUrlKey(URL1)).toBe('greenhouse:4000000001');
    expect(jobUrlKey('https://boards.greenhouse.io/examplesoft/jobs/4000000001/')).toBe('greenhouse:4000000001');
  });
});

describe('Greenhouse reader', () => {
  const { parserId, job } = parseJobPage(fixture('ad.html'), URL1);

  it('is selected for Greenhouse addresses and reads title, company, place and dates from the data of the page', () => {
    expect(parserId).toBe('greenhouse');
    expect(job).toMatchObject({
      title: 'Platform Engineer, EMEA',
      company: 'Example Software',
      location: 'Remote, Germany; Remote, Poland',
      remote: 'yes',
      is_remote: true,
      posted_at: '2026-10-08',
      valid_until: '2026-11-30',
      employment_type: '',
      language: 'en',
      missing: [],
    });
  });

  it('reads the pay range, given in cents, as a yearly amount', () => {
    expect(job).toMatchObject({ salary_min: 90000, salary_max: 120000, salary_currency: 'USD', salary_period: 'year' });
  });

  it('joins the introduction, the body and the closing with their headings and lists, and decodes entities', () => {
    expect(job.description.startsWith('Example Software builds tools for planning conferences.')).toBe(true);
    expect(job.description).toContain('An overview of this role');
    expect(job.description).toContain('- Experience with Go or Python');
    expect(job.description).toContain('Comfort working in & with remote teams');
    expect(job.description.indexOf('Requirements')).toBeLessThan(job.description.indexOf('How we support employees'));
  });

  it('leaves the pay empty when the ad gives no range', () => {
    const none = fixture('ad.html').replace(/"pay_ranges":\[[^\]]*\]/, '"pay_ranges":[]');
    expect(parseJobPage(none, URL1).job).toMatchObject({ salary_min: null, salary_max: null, salary_currency: '', salary_period: '' });
  });

  it('reads escaped markup in the text', () => {
    const escaped = fixture('ad.html').replace('"introduction":"\\u003cp\\u003eExample Software builds tools for planning conferences.\\u003c/p\\u003e"', '"introduction":"\\u0026lt;p\\u0026gt;Escaped introduction.\\u0026lt;/p\\u0026gt;"');
    expect(parseJobPage(escaped, URL1).job.description).toContain('Escaped introduction.');
    expect(parseJobPage(escaped, URL1).job.description).not.toContain('<p>');
  });
});

describe('Greenhouse reader without the data of the page', () => {
  it('falls back to the headline, the tab title, the place and the visible text', () => {
    const { parserId, job } = parseJobPage(fixture('ad-no-data.html'), URL1);
    expect(parserId).toBe('greenhouse');
    expect(job).toMatchObject({ title: 'Platform Engineer, EMEA', company: 'Example Software', location: 'Remote, Germany; Remote, Poland', remote: 'yes', missing: [] });
    expect(job.description).toContain('- Experience with Go or Python');
  });

  it('survives data that is cut off or is not JSON', () => {
    const cut = fixture('ad.html').replace('"jobPost":{', '"jobPost":{"title":"Broken');
    const result = parseJobPage(cut, URL1);
    expect(result.parserId).toBe('greenhouse');
    expect(result.job.title).toBe('Platform Engineer, EMEA');
  });

  it('does not throw on unrelated markup', () => {
    const { parserId, job } = parseJobPage('<html><body><p>Nothing here</p></body></html>', URL1);
    expect(parserId).toBe('greenhouse');
    expect(job.missing.length).toBeGreaterThan(0);
  });
});
