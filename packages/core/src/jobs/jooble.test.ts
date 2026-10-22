import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { looksLikeHtml } from './html';
import { jobUrlKey, normalizeJobUrl } from './url';
import { JOOBLE_PARSER } from './jooble';
import { parseJobPage } from './registry';

const fragment = readFileSync(new URL('../../fixtures/jooble/ad-fragment.html', import.meta.url), 'utf8');
const URL1 = 'https://cz.jooble.org/desc/-1000000000000000001?ckey=Lektor+Brno&rgn=24&pos=1&elckey=1790902570866177803&p=1&jobAge=90&jdpSource=8';

describe('Jooble reader: which addresses', () => {
  it('takes the ad pages of Jooble, and nothing else', () => {
    expect(JOOBLE_PARSER.matches(URL1)).toBe(true);
    expect(JOOBLE_PARSER.matches('https://cz.jooble.org/jdp/-1000000000000000001')).toBe(true);
    expect(JOOBLE_PARSER.matches('https://cz.jooble.org/prace/Brno')).toBe(false);
    expect(JOOBLE_PARSER.matches('https://example.com/desc/-1000000000000000001')).toBe(false);
  });

  it('gives every link to one Jooble ad the same key, whatever its parameters', () => {
    expect(jobUrlKey(URL1)).toBe('jooble:-1000000000000000001');
    expect(jobUrlKey('https://cz.jooble.org/desc/-1000000000000000001?utm_source=x&p=2')).toBe('jooble:-1000000000000000001');
    expect(jobUrlKey('https://cz.jooble.org/desc/-1000000000000000002')).not.toBe(jobUrlKey(URL1));
  });

  it('keeps the parameters of the link: Jooble needs them', () => {
    expect(normalizeJobUrl(URL1 + '#x')).toBe(URL1);
  });
});

describe('Jooble reader: a piece of the page copied with "Copy outerHTML"', () => {
  const job = JOOBLE_PARSER.parse(fragment, URL1);

  it('is recognised as markup and not as the text of an ad', () => {
    expect(looksLikeHtml(fragment)).toBe(true);
  });

  it('reads the title without the kind of the ad, the company and the region', () => {
    expect(job).toMatchObject({ title: 'Lektor/ka robotiky pro děti - Example Academy Brno', company: 'Example Academy s.r.o.', location: 'Brno' });
  });

  it('reads the hourly pay, the contract and that it is a gig', () => {
    expect(job).toMatchObject({ salary_min: 200, salary_max: 250, salary_currency: 'CZK', salary_period: 'hour', employment_type: 'temporary', is_gig: true });
  });

  it('reads the whole text of the ad, with its headings, lists and lines, and not the buttons', () => {
    expect(job.description).toContain('Hledáme lektora, který s námi nadchne děti pro technologie.');
    expect(job.description).toContain('Náplň práce:');
    expect(job.description).toContain('- zaškolení před zahájením výuky.');
    expect(job.description).toContain('Forma spolupráce: DPP');
    expect(job.description).not.toContain('Přejít na');
    expect(job.language).toBe('cs');
    expect(job.missing).toEqual([]);
  });

  it('is merged over the generic result by the registry', () => {
    const result = parseJobPage(fragment, URL1);
    expect(result.parserId).toBe('jooble');
    expect(result.job).toMatchObject({ title: 'Lektor/ka robotiky pro děti - Example Academy Brno', location: 'Brno', salary_period: 'hour' });
  });
});

describe('Jooble reader: edge cases', () => {
  it('reads the whole page source as well as a piece of it', () => {
    const page = `<!doctype html><html><head><title>Jooble</title></head><body>${fragment}</body></html>`;
    expect(JOOBLE_PARSER.parse(page, URL1)).toMatchObject({ title: 'Lektor/ka robotiky pro děti - Example Academy Brno', company: 'Example Academy s.r.o.' });
  });

  it('keeps a title that has no kind after a bar, and takes a monthly pay and a part-time contract', () => {
    const html = fragment.replace(' | brigáda', '').replace('200 - 250 Kč/hod', '30 000 - 40 000 Kč/měs.').replace('Dočasný úvazek, Plný úvazek', 'Částečný úvazek');
    expect(JOOBLE_PARSER.parse(html, URL1)).toMatchObject({ title: 'Lektor/ka robotiky pro děti - Example Academy Brno', salary_min: 30000, salary_max: 40000, salary_period: 'month', employment_type: 'part_time' });
  });

  it('leaves the pay empty when the header shows none, and does not take a text that only mentions money for it', () => {
    const html = fragment.replace('<span class="nywwrd h3">200 - 250 Kč/hod</span>', '<span class="nywwrd h3">Mzda dle dohody</span>');
    expect(JOOBLE_PARSER.parse(html, URL1)).toMatchObject({ salary_min: null, salary_currency: '' });
  });

  it('copes with a piece that has only a description', () => {
    const job = JOOBLE_PARSER.parse('<div data-test-name="_jobDescriptionBlock"><p>Only the text of the ad, about the work in a warehouse in Brno.</p></div>', URL1);
    expect(job.description).toBe('Only the text of the ad, about the work in a warehouse in Brno.');
    expect(job.title).toBe('');
    expect(job.missing).toEqual(['title', 'company', 'location']);
  });
});
