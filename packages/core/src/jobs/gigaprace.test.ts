import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GIGAPRACE_PARSER } from './gigaprace';
import { parseJobPage } from './registry';

const html = readFileSync(new URL('../../fixtures/gigaprace/ad.html', import.meta.url), 'utf8');
const URL1 = 'https://www.gigaprace.cz/nabidka-prace/abc123/doplnovacka-automatu-region-brno-brno';

describe('GigaPrace parser', () => {
  it('takes the ad pages of the portal, also with tracking parameters, and nothing else', () => {
    expect(GIGAPRACE_PARSER.matches(URL1)).toBe(true);
    expect(GIGAPRACE_PARSER.matches(`${URL1}?utm_source=jooble&utm_away=abc`)).toBe(true);
    expect(GIGAPRACE_PARSER.matches('https://www.gigaprace.cz/nabidky-prace/brno')).toBe(false);
    expect(GIGAPRACE_PARSER.matches('https://example.com/nabidka-prace/abc123/x')).toBe(false);
  });

  it('gives the place of work as the city only, without the country code the generic parser adds', () => {
    expect(GIGAPRACE_PARSER.parse(html, URL1).location).toBe('Brno');
  });

  it('is merged over the generic result: everything else comes from the JSON-LD of the page', () => {
    const result = parseJobPage(html, URL1);
    expect(result.parserId).toBe('gigaprace');
    expect(result.job).toMatchObject({
      title: 'DOPLŇOVAČKA AUTOMATŮ - region Brno', company: 'Example Automaty, s.r.o.', location: 'Brno', employment_type: 'full_time',
      salary_min: 28000, salary_max: null, salary_currency: 'CZK', salary_period: 'month', posted_at: '2026-10-22', valid_until: '2026-10-23', language: 'cs',
    });
    expect(result.job.description).toContain('Informace o pozici');
    expect(result.job.description).toContain('Služební dodávku');
    expect(result.job.missing).toEqual([]);
  });

  it('names several places once each, and still has a title when the JSON-LD is gone', () => {
    const place = (city: string) => ({ '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: city, addressCountry: 'CZ' } });
    const posting = { '@context': 'https://schema.org/', '@type': 'JobPosting', title: 'Doplňovačka', jobLocation: [place('Tišnov'), place('Brno'), place('Brno')] };
    const several = `<html><head><script type="application/ld+json">${JSON.stringify(posting)}</script></head><body></body></html>`;
    expect(GIGAPRACE_PARSER.parse(several, URL1).location).toBe('Tišnov, Brno');
    const noLd = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
    expect(GIGAPRACE_PARSER.parse(noLd, URL1)).toMatchObject({ title: 'DOPLŇOVAČKA AUTOMATŮ - region Brno', location: '' });
  });
});
