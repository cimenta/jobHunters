import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseJobPage } from './registry';
import { SPRAVNYKROK_PARSER } from './spravnykrok';
import { jobUrlKey, normalizeJobUrl } from './url';

const html = readFileSync(new URL('../../fixtures/spravnykrok/ad.html', import.meta.url), 'utf8');
const URL1 = 'https://www.spravnykrok.cz/prace/nabidka/1000003-customer-support-specialist.html?utm_source=jooble&utm_medium=cpc&utm_campaign=jooble_paid';

describe('Správný krok reader: addresses', () => {
  it('takes the ad pages of the portal, also with tracking parameters, and nothing else', () => {
    expect(SPRAVNYKROK_PARSER.matches(URL1)).toBe(true);
    expect(SPRAVNYKROK_PARSER.matches('https://www.spravnykrok.cz/')).toBe(false);
    expect(SPRAVNYKROK_PARSER.matches('https://www.spravnykrok.cz/search/?category=x')).toBe(false);
    expect(SPRAVNYKROK_PARSER.matches('https://example.com/prace/nabidka/1000003-customer-support-specialist.html')).toBe(false);
  });

  it('removes the tracking parameters of the link and gives every link to one ad the same key', () => {
    expect(normalizeJobUrl(URL1)).toBe('https://www.spravnykrok.cz/prace/nabidka/1000003-customer-support-specialist.html');
    expect(jobUrlKey(URL1)).toBe('spravnykrok.cz:1000003');
    expect(jobUrlKey('https://spravnykrok.cz/prace/nabidka/1000003-another-slug.html')).toBe('spravnykrok.cz:1000003');
  });
});

describe('Správný krok reader', () => {
  const job = SPRAVNYKROK_PARSER.parse(html, URL1);

  it('reads the title, the company, the place and the contract', () => {
    expect(job).toMatchObject({ title: 'Customer Support Specialist Brno', company: 'Example Staffing Brno pobočka', location: 'Brno, Jihomoravský', employment_type: 'full_time', is_gig: false, language: 'cs' });
  });

  it('reads the monthly pay from the line "Plat"', () => {
    expect(job).toMatchObject({ salary_min: 40000, salary_max: 45000, salary_currency: 'CZK', salary_period: 'month' });
  });

  it('takes the text between the two answer buttons, with its headings and lines, and not the contact person', () => {
    expect(job.description).toContain('Jsme technologická společnost, která staví ukázkové produkty');
    expect(job.description).toContain('Požadujeme');
    expect(job.description).toContain('- Zkušenosti s CRM systémy.');
    expect(job.description).toContain('Těšíme se na Vaši reakci!');
    expect(job.description).not.toMatch(/Odpověď na inzerát|Kontaktní osoba|Jana Příkladová|\+420/);
    expect(job.missing).toEqual([]);
  });

  it('is merged over the generic result by the registry', () => {
    const result = parseJobPage(html, URL1);
    expect(result.parserId).toBe('spravnykrok');
    expect(result.job).toMatchObject({ title: 'Customer Support Specialist Brno', salary_min: 40000 });
  });
});

describe('Správný krok reader: edge cases', () => {
  it('reads an hourly pay and a part-time contract, and marks a brigáda as a gig', () => {
    const changed = html.replace('40000 - 45000 Kč za měsíc', '180 - 220 Kč za hodinu').replace('Plný úvazek', 'Brigáda');
    expect(SPRAVNYKROK_PARSER.parse(changed, URL1)).toMatchObject({ salary_min: 180, salary_max: 220, salary_period: 'hour', employment_type: 'temporary', is_gig: true });
    const part = html.replace('Plný úvazek', 'Zkrácený úvazek');
    expect(SPRAVNYKROK_PARSER.parse(part, URL1).employment_type).toBe('part_time');
  });

  it('leaves the pay empty when the page shows none, and takes the company from the page title when the company block is missing', () => {
    const changed = html.replace(/Plat: <strong>[\s\S]*?<\/strong><br>\n/, '').replace(/<div class="companyInfo">[\s\S]*?<div class="clear"><\/div>\n<\/div>/, '');
    expect(SPRAVNYKROK_PARSER.parse(changed, URL1)).toMatchObject({ salary_min: null, salary_max: null, salary_currency: '', company: 'Example Staffing Brno pobočka' });
  });

  it('still reads a page whose answer buttons are gone: the text then starts after the heading', () => {
    const changed = html.replace(/<div class=" mb-20">[\s\S]*?<\/div>\n/g, '');
    const job = SPRAVNYKROK_PARSER.parse(changed, URL1);
    expect(job.title).toBe('Customer Support Specialist Brno');
    expect(job.description).toContain('Požadujeme');
  });

  it('copes with a page that has nothing but a heading', () => {
    const job = SPRAVNYKROK_PARSER.parse('<html><body><h1>Only a title</h1></body></html>', URL1);
    expect(job).toMatchObject({ title: 'Only a title', salary_min: null, location: '' });
  });
});
