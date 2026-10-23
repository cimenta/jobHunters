import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CESNET_PARSER } from './cesnet';
import { parseJobPage } from './registry';
import { jobUrlKey, normalizeJobUrl } from './url';

const html = readFileSync(new URL('../../fixtures/cesnet/kariera.html', import.meta.url), 'utf8');
const PAGE = 'https://www.cesnet.cz/kariera';
const FIRST = `${PAGE}#product-manager-m-z`;
const SECOND = `${PAGE}#identity-analyst-medior`;

describe('CESNET career page: addresses', () => {
  it('takes the career page and nothing else on the site', () => {
    expect(CESNET_PARSER.matches(FIRST)).toBe(true);
    expect(CESNET_PARSER.matches(PAGE)).toBe(true);
    expect(CESNET_PARSER.matches('https://www.cesnet.cz/sluzby')).toBe(false);
    expect(CESNET_PARSER.matches('https://example.com/kariera')).toBe(false);
  });

  it('tells the ads of one page apart by the anchor, and does not take a setting or tracking as an anchor', () => {
    expect(normalizeJobUrl(FIRST)).toBe(FIRST);
    expect(jobUrlKey(FIRST)).not.toBe(jobUrlKey(SECOND));
    expect(jobUrlKey(FIRST)).toBe(jobUrlKey(normalizeJobUrl(`${PAGE}/?utm_source=x#Product-Manager-M-Z`)));
    expect(normalizeJobUrl('https://www.jobs.cz/rpd/1/#some-anchor')).toBe('https://www.jobs.cz/rpd/1/');
    expect(normalizeJobUrl(`${PAGE}#segmetation=STANDARD`)).toBe(PAGE);
    expect(jobUrlKey(`${PAGE}#segmetation=STANDARD`)).toBe(jobUrlKey(PAGE));
  });
});

describe('CESNET career page reader', () => {
  it('reads the item the anchor names: title, place and the text', () => {
    const job = CESNET_PARSER.parse(html, FIRST);
    expect(job).toMatchObject({ title: 'Product manager (m/ž)', company: 'CESNET', location: 'Praha, Brno' });
    expect(job.description).toContain('We look for a person for a full-time position.');
    expect(job.description).toContain('- run the portfolio');
    expect(job.description).not.toMatch(/Identity|Reply|Analyse/);
  });

  it('reads the other item for its own anchor', () => {
    expect(CESNET_PARSER.parse(html, SECOND)).toMatchObject({ title: 'Identity analyst (medior)', location: 'Praha', description: 'Analyse identities.' });
  });

  it('gives nothing for an anchor that names no item, and for a page with several items and no anchor', () => {
    expect(CESNET_PARSER.parse(html, `${PAGE}#nope`).title).toBe('');
    expect(CESNET_PARSER.parse(html, PAGE).title).toBe('');
  });

  it('is merged by the registry', () => {
    expect(parseJobPage(html, SECOND)).toMatchObject({ parserId: 'cesnet', job: { title: 'Identity analyst (medior)' } });
  });
});
