import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeEntities } from './html';
import { JOBS_CZ_PARSER } from './jobs-cz';

const read = (name: string): string => readFileSync(new URL(`../../fixtures/jobs-cz/${name}`, import.meta.url), 'utf8');
const parse = (html: string) => JOBS_CZ_PARSER.parse(html, 'https://www.jobs.cz/rpd/2000000002/');

describe('Jobs.cz parser', () => {
  it('reads both places of work, each once although the page shows them in two blocks', () => {
    expect(parse(read('ad-two-places.html')).location).toBe('Brno, Olomouc');
  });

  it('reads the salary from the salary block of the page', () => {
    expect(parse(read('ad-two-places.html'))).toMatchObject({ salary_min: 100000, salary_max: 140000, salary_currency: 'CZK', salary_period: 'month' });
  });

  it('still reads the rest of such a page', () => {
    expect(parse(read('ad-two-places.html'))).toMatchObject({ title: 'Business Analyst', company: 'Example Staffing s.r.o.', employment_type: 'full_time', language: 'cs' });
  });

  it('still reads a single place and a salary among the position facts (the older layout)', () => {
    expect(parse(read('ad.html'))).toMatchObject({ location: 'Example 1, Praha – Karlín', salary_min: 60000, salary_max: 80000, salary_currency: 'CZK' });
  });

  it('leaves the salary empty when the page shows none', () => {
    const html = read('ad-two-places.html').replace(/<div data-test="jd-salary"[\s\S]*?<\/p><\/div>/, '');
    expect(parse(html)).toMatchObject({ salary_min: null, salary_max: null, salary_currency: '' });
  });

  it('does not repeat a place that the page names twice in a row', () => {
    const html = read('ad-two-places.html').replace(/>Olomouc<\/a>/g, '>Brno</a>');
    expect(parse(html).location).toBe('Brno');
  });
});

describe('decodeEntities', () => {
  it('turns the zero-width joiner entities of Jobs.cz into their characters instead of leaving the entity text', () => {
    expect(decodeEntities('100&zwj;–&zwnj;140')).toBe('100‍–‌140');
  });
});
