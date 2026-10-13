import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { emptyParsedJob, type JobParser } from './parsed-job';
import { parseJobPage, parseManualText } from './registry';

const fixture = (name: string) => readFileSync(new URL(`../../fixtures/${name}`, import.meta.url), 'utf8');

describe('Jobs.cz parser', () => {
  const { parserId, job } = parseJobPage(fixture('jobs-cz/ad.html'), 'https://www.jobs.cz/rpd/2000000001/');

  it('is selected for Jobs.cz addresses', () => {
    expect(parserId).toBe('jobs-cz');
  });
  it('reads title, company, location, employment and salary from the info blocks', () => {
    expect(job).toMatchObject({
      title: 'Android Developer',
      company: 'Example s.r.o.',
      location: 'Example 1, Praha – Karlín',
      employment_type: 'full_time',
      is_gig: false,
      salary_min: 60000,
      salary_max: 80000,
      salary_currency: 'CZK',
      salary_period: 'month',
      language: 'cs',
      missing: [],
    });
  });
  it('keeps the description structure and drops the section label', () => {
    expect(job.description.startsWith('Hledáme zkušeného vývojáře')).toBe(true);
    expect(job.description).toContain('- Znalost Kotlinu');
    expect(job.description).not.toContain('Pracovní nabídka');
  });
});

describe('LinkedIn parser', () => {
  const { parserId, job } = parseJobPage(fixture('linkedin/ad.html'), 'https://cz.linkedin.com/jobs/view/senior-engineer-at-example-corp-4000000001');

  it('reads the public job page', () => {
    expect(parserId).toBe('linkedin');
    expect(job).toMatchObject({ title: 'Senior Engineer', company: 'Example Corp', location: 'Brno, South Moravia, Czechia', language: 'en', missing: [] });
    expect(job.description).toContain('Requirements');
    expect(job.description).toContain('- Python or Kotlin');
  });
});

describe('StartupJobs parser', () => {
  const { parserId, job } = parseJobPage(fixture('startupjobs/ad.html'), 'https://www.startupjobs.cz/nabidka/100000/senior-backend-developer-python-example');

  it('reads company, location, employment and description from the JSON-LD of a live ad', () => {
    expect(parserId).toBe('startupjobs');
    expect(job).toMatchObject({
      title: 'Senior Backend Developer (Python) - Example',
      company: 'Example Startup a.s.',
      location: 'Praha, Česko',
      employment_type: 'full_time',
      is_gig: false,
      posted_at: '2026-10-02',
      language: 'en',
      missing: [],
    });
    expect(job.description).toContain('We are building tools for conferences.');
    expect(job.description).toContain('- Python');
  });

  it('degrades on an expired ad (no JobPosting) to title and employment type', () => {
    const expired = parseJobPage(fixture('startupjobs/expired.html'), 'https://www.startupjobs.cz/nabidka/100001/old-offer');
    expect(expired.parserId).toBe('startupjobs');
    expect(expired.job).toMatchObject({ title: 'Old Offer', company: '', missing: ['company', 'location', 'description'] });
  });
});

describe('StartupJobs work mode', () => {
  const url = 'https://www.startupjobs.cz/nabidka/108415/product-specialist-technical-engineer-integrations-ai';
  const withLinks = (...modes: string[]) =>
    fixture('startupjobs/ad.html').replace('</main>', modes.map((m) => `<a href="/nabidky?pracovni-rezim=${m}" class="label-sm">x </a>`).join('') + '</main>');

  it('reads a hybrid ad and keeps the other fields', () => {
    const { parserId, job } = parseJobPage(fixture('startupjobs/ad-hybrid.html'), url);
    expect(parserId).toBe('startupjobs');
    expect(job).toMatchObject({
      title: 'Product Specialist / Technical Engineer – Integrations & AI',
      company: 'salesconnect, s.r.o.',
      location: 'Praha, Česko',
      salary_min: 60000,
      salary_max: 90000,
      salary_currency: 'CZK',
      salary_period: 'month',
      employment_type: 'full_time',
      language: 'cs',
      remote: 'hybrid',
    });
  });

  it('maps the on-site, remote and missing markers', () => {
    expect(parseJobPage(withLinks('onsite'), url).job.remote).toBe('no');
    expect(parseJobPage(withLinks('remote'), url).job.remote).toBe('yes');
    expect(parseJobPage(fixture('startupjobs/ad.html'), url).job.remote).toBe('');
  });

  it('prefers remote over hybrid over on-site when an ad lists several modes', () => {
    expect(parseJobPage(withLinks('onsite', 'hybrid'), url).job.remote).toBe('hybrid');
    expect(parseJobPage(withLinks('onsite', 'hybrid', 'remote'), url).job.remote).toBe('yes');
  });
});

describe('parseJobPage fallbacks', () => {
  it('uses the generic parser for other sites', () => {
    const { parserId, job } = parseJobPage(fixture('generic/json-ld.html'), 'https://example.com/job/1');
    expect(parserId).toBe('generic');
    expect(job.title).toBe('Data Analyst');
  });

  it('does not throw on a portal URL with unrelated markup', () => {
    const { parserId, job } = parseJobPage(fixture('linkedin/ad.html'), 'https://www.jobs.cz/rpd/2000000001/');
    expect(parserId).toBe('jobs-cz');
    expect(job.missing.length).toBeGreaterThan(0);
  });

  it('falls back to the generic result when a parser throws, and reports it', () => {
    const throwing: JobParser = {
      id: 'broken',
      matches: () => true,
      parse: () => {
        throw new Error('markup changed');
      },
    };
    const errors: string[] = [];
    const { parserId, job } = parseJobPage(fixture('generic/json-ld.html'), 'https://example.com/x', {
      parsers: [throwing],
      onError: (id, error) => errors.push(`${id}:${(error as Error).message}`),
    });
    expect(parserId).toBe('generic');
    expect(job.title).toBe('Data Analyst');
    expect(errors).toEqual(['broken:markup changed']);
  });

  it('lets a portal parser fill gaps while keeping generic JSON-LD values', () => {
    const portal: JobParser = {
      id: 'portal',
      matches: () => true,
      parse: () => ({ ...emptyParsedJob(), company: 'Portal Co' }),
    };
    const { parserId, job } = parseJobPage(fixture('generic/json-ld.html'), 'https://example.com/x', { parsers: [portal] });
    expect(parserId).toBe('portal');
    expect(job).toMatchObject({ title: 'Data Analyst', company: 'Portal Co' });
  });
});

describe('parseManualText', () => {
  it('uses the first line as the title and the whole text as the description', () => {
    const job = parseManualText('Backend Developer\n\nWe are hiring a developer for our team and you will work with us on services.');
    expect(job.title).toBe('Backend Developer');
    expect(job.description).toContain('We are hiring');
    expect(job.missing).toEqual(['company', 'location']);
  });
  it('prefers hints and strips markup from pasted text', () => {
    const job = parseManualText('<b>Hello</b> <script>x</script>world', { title: 'Mine', company: 'Acme' });
    expect(job).toMatchObject({ title: 'Mine', company: 'Acme', description: 'Hello world' });
  });
  it('never exceeds the cell limit', () => {
    expect(parseManualText('x'.repeat(100_000)).description.length).toBeLessThanOrEqual(49000);
  });
});
