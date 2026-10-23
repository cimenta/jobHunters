import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MANPOWER_PARSER, payFromText, withoutGenderNotice } from './manpower';
import { parseJobPage } from './registry';
import { jobUrlKey, normalizeJobUrl } from './url';

const html = readFileSync(new URL('../../fixtures/manpower/ad.html', import.meta.url), 'utf8');
const URL1 = 'https://manpower.cz/nabidky-prace/obsluha-stroju-vse-potrebne-vas-naucime--70466/?utm_source=jooble&utm_medium=cpc&utm_campaign=all';

describe('Manpower reader: addresses', () => {
  it('takes the ads, with tracking parameters and with www, and nothing else', () => {
    expect(MANPOWER_PARSER.matches(URL1)).toBe(true);
    expect(MANPOWER_PARSER.matches('https://www.manpower.cz/nabidky-prace/x--1/')).toBe(true);
    expect(MANPOWER_PARSER.matches('https://manpower.cz/nabidky-prace/')).toBe(false);
    expect(MANPOWER_PARSER.matches('https://manpower.cz/kontakt/')).toBe(false);
    expect(MANPOWER_PARSER.matches('https://example.com/nabidky-prace/x--1/')).toBe(false);
  });

  it('removes the tracking parameters and keys an ad by its number', () => {
    expect(normalizeJobUrl(URL1)).toBe('https://manpower.cz/nabidky-prace/obsluha-stroju-vse-potrebne-vas-naucime--70466/');
    expect(jobUrlKey(URL1)).toBe('manpower.cz:70466');
    expect(jobUrlKey('https://www.manpower.cz/nabidky-prace/other-slug--70466')).toBe('manpower.cz:70466');
  });
});

describe('Manpower reader', () => {
  const job = MANPOWER_PARSER.parse(html, URL1);

  it('reads the heading, the company, the contract and the place from the flags', () => {
    expect(job).toMatchObject({
      title: 'Obsluha strojů | Vše potřebné Vás naučíme',
      company: 'ManpowerGroup',
      location: 'Brno (Brno-město), Jihomoravský',
      employment_type: 'full_time',
      is_gig: false,
    });
  });

  it('reads "Mzdu až 45 000 Kč" as a monthly upper limit and the date from the invalid JSON-LD', () => {
    expect(job).toMatchObject({ salary_min: null, salary_max: 45000, salary_currency: 'CZK', salary_period: 'month', posted_at: '2026-10-21' });
  });

  it('takes the field and the benefits from the box on the left into the text, and the recruiter as the contact person', () => {
    expect(job.description).toContain('Obor: Výroba a vývoj');
    expect(job.description).toContain('Benefity: Příspěvek na stravování, Dovolená navíc');
    expect(job.contact_person).toBe('Jana Příkladová, 000 000 000, jana.prikladova@example.invalid');
    expect(MANPOWER_PARSER.parse('<html><body><h1>Only a title</h1></body></html>', URL1).contact_person).toBeUndefined();
  });

  it('finds the box on the left although the page has other "left" columns before it (header, back button)', () => {
    const others = '<div class="left"> <a href="/" class="logo">Logo</a> </div><div class="left"> <a href="#" class="history_back">Zpět</a> </div>';
    const page = html.replace('<body>', '<body>' + others);
    expect(MANPOWER_PARSER.parse(page, URL1)).toMatchObject({ contact_person: 'Jana Příkladová, 000 000 000, jana.prikladova@example.invalid' });
  });

  it('takes the introduction and the blocks, without the buttons, the similar ads and the notice', () => {
    expect(job.description.split('\n')[0]).toContain('Do našeho týmu hledáme');
    expect(job.description).toContain('Požadujeme');
    expect(job.description).toContain('Technické myšlení');
    expect(job.description).not.toMatch(/Odpovědět|PODOBNÉ|JINÁ POZICE|muže i|Naše inzeráty/i);
  });

  it('is merged over the generic result by the registry', () => {
    const result = parseJobPage(html, URL1);
    expect(result.parserId).toBe('manpower');
    expect(result.job).toMatchObject({ company: 'ManpowerGroup', location: 'Brno (Brno-město), Jihomoravský', salary_max: 45000 });
    expect(result.job.contact_person).toContain('Jana Příkladová');
  });
});

describe('Manpower reader: edge cases', () => {
  it('knows a brigáda as a gig and reads the other contracts', () => {
    expect(MANPOWER_PARSER.parse(html.replace('Plný úvazek', 'Brigáda'), URL1)).toMatchObject({ employment_type: 'temporary', is_gig: true });
    expect(MANPOWER_PARSER.parse(html.replace('Plný úvazek', 'Zkrácený úvazek'), URL1)).toMatchObject({ employment_type: 'part_time', is_gig: false });
    expect(MANPOWER_PARSER.parse(html.replace('Plný úvazek', 'Dohoda o provedení práce'), URL1).employment_type).toBe('contractor');
  });

  it('copes with a page that has only a heading', () => {
    const job = MANPOWER_PARSER.parse('<html><body><h1>Only a title</h1></body></html>', URL1);
    expect(job).toMatchObject({ title: 'Only a title', location: '', description: '', salary_max: null, posted_at: '' });
  });
});

describe('payFromText', () => {
  it('reads "až" as an upper limit, "od" as a lower one and a range as both', () => {
    expect(payFromText('Mzdu až 45 000 Kč')).toMatchObject({ salary_min: null, salary_max: 45000, salary_period: 'month' });
    expect(payFromText('Mzda od 30 000 Kč')).toMatchObject({ salary_min: 30000, salary_max: null });
    expect(payFromText('Mzda 30 000 - 40 000 Kč')).toMatchObject({ salary_min: 30000, salary_max: 40000 });
  });

  it('knows an hourly and a yearly pay, ignores lines that do not name the pay and returns nothing without one', () => {
    expect(payFromText('Odměna 200 Kč/hod')).toMatchObject({ salary_min: 200, salary_max: 200, salary_period: 'hour' });
    expect(payFromText('Stravenky 150 Kč / den')).toBeUndefined();
    expect(payFromText('Příjemné prostředí')).toBeUndefined();
  });
});

describe('withoutGenderNotice', () => {
  it('cuts the notice and everything after it', () => {
    expect(withoutGenderNotice('Text\n\nNABÍRÁME MUŽE I ŽENY\nNaše inzeráty')).toBe('Text');
    expect(withoutGenderNotice('Text')).toBe('Text');
  });
});
