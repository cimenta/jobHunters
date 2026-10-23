import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FAJN_PARSER } from './fajn';
import { parseJobPage } from './registry';

const read = (name: string): string => readFileSync(new URL(`../../fixtures/fajn/${name}`, import.meta.url), 'utf8');
const FAJN_URL = 'https://www.fajn-brigady.cz/brigady/manualni/brno/1000001-hledame-skladnika-na-vikendy/';
const INWORK_URL = 'https://www.inwork.cz/prace/jihomoravsky-kraj/brno/brno/1000002-operator-ka-vyroby-volne-vikendy/';

describe('Fajn Brigády and Inwork parser: which addresses', () => {
  it('takes the ad pages of both portals, also with tracking parameters, and nothing else', () => {
    expect(FAJN_PARSER.matches(FAJN_URL)).toBe(true);
    expect(FAJN_PARSER.matches(`${FAJN_URL}?vstup=jooble&utm_source=jooble#segmetation=STANDARD`)).toBe(true);
    expect(FAJN_PARSER.matches(INWORK_URL)).toBe(true);
    for (const other of ['https://www.fajn-brigady.cz/', 'https://www.inwork.cz/prace/', 'https://www.inwork.cz/profil-zamestnavatele/1-example-staffing/', 'https://example.com/prace/1000002-operator/', 'https://www.jobs.cz/rpd/1000002/']) {
      expect(FAJN_PARSER.matches(other), other).toBe(false);
    }
  });
});

describe('Fajn Brigády parser (temporary jobs)', () => {
  const job = FAJN_PARSER.parse(read('ad-brigada.html'), FAJN_URL);

  it('reads the title, the company, the place of work and the date the ad was put in', () => {
    expect(job).toMatchObject({ title: 'Hledáme skladníka na víkendy', company: 'Example Lift s.r.o.', location: 'Brno, Ukázková 18/10', posted_at: '2026-10-19', language: 'cs' });
  });

  it('knows every ad of the portal is a gig, and does not call a wage per task a monthly one', () => {
    expect(job).toMatchObject({ is_gig: true, employment_type: 'temporary', salary_min: 180, salary_max: 220, salary_currency: 'CZK', salary_period: '' });
  });

  it('takes the text of every block of the ad and leaves the facts table and the contact out of it', () => {
    expect(job.description).toContain('Informace o pracovním místě');
    expect(job.description).toContain('Kompletace paletových vozíků');
    expect(job.description).toContain('Požadujeme');
    expect(job.description).toContain('Nabízíme');
    expect(job.description).not.toMatch(/Zobrazit kontakt|Zadavatel|Jana Příkladová/);
    expect(job.missing).toEqual([]);
  });

  it('is merged over the generic result by the registry', () => {
    const result = parseJobPage(read('ad-brigada.html'), FAJN_URL);
    expect(result.parserId).toBe('fajn');
    expect(result.job).toMatchObject({ title: 'Hledáme skladníka na víkendy', is_gig: true });
  });
});

describe('Inwork parser (jobs)', () => {
  const job = FAJN_PARSER.parse(read('ad-prace.html'), INWORK_URL);

  it('reads the title, the company, the place, the monthly wage and the full-time contract', () => {
    expect(job).toMatchObject({
      title: 'Operátor/ka výroby, volné víkendy', company: 'Example Staffing s.r.o.', location: 'Brno', employment_type: 'full_time',
      salary_min: 30000, salary_max: 35000, salary_currency: 'CZK', salary_period: 'month', is_gig: false,
    });
  });

  it('has no date when the page shows none, and keeps the headings of the text apart from the paragraphs', () => {
    expect(job.posted_at).toBe('');
    expect(job.description.split('\n')[0]).toBe('Informace o pracovním místě');
    expect(job.description).toContain('Ranní směna: 6:00 – 14:00');
    expect(job.description).toContain('Garantovaná mzda 30 000 Kč + bonusy!');
  });
});

describe('Fajn Brigády and Inwork parser: edge cases', () => {
  it('turns a wage per hour into an hourly one and a part-time contract into part time', () => {
    const html = read('ad-prace.html').replace('30 000 - 35 000 Kč/<span title="měsíčně">měs.</span>', '150 Kč/hod').replace('>Plný<', '>Zkrácený<');
    expect(FAJN_PARSER.parse(html, INWORK_URL)).toMatchObject({ salary_min: 150, salary_max: 150, salary_period: 'hour', employment_type: 'part_time' });
  });

  it('reads a pay per "h" as hourly and drops emoji from the text', () => {
    const html = read('ad-prace.html').replace('30 000 - 35 000 Kč/<span title="měsíčně">měs.</span>', '200 - 200 Kč/h').replace('Garantovaná mzda', '💰 Garantovaná mzda');
    const job = FAJN_PARSER.parse(html, INWORK_URL);
    expect(job).toMatchObject({ salary_min: 200, salary_max: 200, salary_period: 'hour' });
    expect(/\p{Extended_Pictographic}/u.test(job.title + job.description)).toBe(false);
  });

  it('leaves the salary empty when the wage row is missing or has no amount, and takes the company from the page title when there is no company row', () => {
    const html = read('ad-prace.html').replace(/<div class="iw-offer-detail__info__item">\s*<span class="green-text __tabulka_nadpisek">Mzda:[\s\S]*?<\/div>/, '').replace(/<div class="iw-offer-detail__info__item">\s*<span class="green-text __tabulka_nadpisek">Firma:[\s\S]*?<\/div>/, '');
    expect(FAJN_PARSER.parse(html, INWORK_URL)).toMatchObject({ salary_min: null, salary_max: null, salary_currency: '', company: 'Example Staffing s.r.o.' });
    const negotiable = read('ad-prace.html').replace('30 000 - 35 000 Kč/<span title="měsíčně">měs.</span>', 'dohodou');
    expect(FAJN_PARSER.parse(negotiable, INWORK_URL).salary_currency).toBe('');
  });

  it('uses the place named "Lokalita" when there is no workplace row, and survives a page without any facts', () => {
    const html = read('ad-prace.html').replace(/<div class="iw-offer-detail__info__item">\s*<span class="green-text __tabulka_nadpisek">Pracoviště:[\s\S]*?<\/div>/, '');
    expect(FAJN_PARSER.parse(html, INWORK_URL).location).toBe('Brno');
    const bare = FAJN_PARSER.parse('<html><head><title>x</title></head><body><h1>Only a title</h1></body></html>', INWORK_URL);
    expect(bare).toMatchObject({ title: 'Only a title', location: '', description: '', salary_min: null });
    expect(bare.missing).toEqual(['company', 'location', 'description']);
  });

  it('treats a page that is a Cloudflare check as an ad without any content', () => {
    const check = FAJN_PARSER.parse('<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title></head><body><h1>www.inwork.cz</h1></body></html>', INWORK_URL);
    expect(check.description).toBe('');
    expect(check.company).toBe('');
  });
});
