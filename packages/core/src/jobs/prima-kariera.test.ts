import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRIMA_KARIERA_PARSER } from './prima-kariera';
import { parseJobPage } from './registry';
import { jobUrlKey, normalizeJobUrl } from './url';

const fixture = (name: string) => readFileSync(new URL(`../../fixtures/prima-kariera/${name}`, import.meta.url), 'utf8');
const URL1 = 'https://www.primakariera.cz/prace/data-analyst-minus-hybrid-comma-pro-juniory_id2625?utm_source=x';

describe('Prima kariéra reader: addresses', () => {
  it('takes the ad pages and nothing else', () => {
    expect(PRIMA_KARIERA_PARSER.matches(URL1)).toBe(true);
    expect(PRIMA_KARIERA_PARSER.matches('https://primakariera.cz/prace/data-analyst_id12')).toBe(true);
    expect(PRIMA_KARIERA_PARSER.matches('https://www.primakariera.cz/prace')).toBe(false);
    expect(PRIMA_KARIERA_PARSER.matches('https://www.primakariera.cz/prace?query=analyst')).toBe(false);
    expect(PRIMA_KARIERA_PARSER.matches('https://www.primakariera.cz/blog/clanek_id5')).toBe(false);
    expect(PRIMA_KARIERA_PARSER.matches('https://example.com/prace/data-analyst_id12')).toBe(false);
  });

  it('gives every link to one ad the same key, whatever the words of the title', () => {
    expect(jobUrlKey(URL1)).toBe('primakariera.cz:2625');
    expect(jobUrlKey('https://primakariera.cz/prace/other-words_id2625/')).toBe('primakariera.cz:2625');
    expect(jobUrlKey('https://www.primakariera.cz/prace/data-analyst_id2626')).not.toBe(jobUrlKey(URL1));
    expect(normalizeJobUrl(URL1)).toBe('https://www.primakariera.cz/prace/data-analyst-minus-hybrid-comma-pro-juniory_id2625');
  });
});

describe('Prima kariéra reader', () => {
  const { parserId, job } = parseJobPage(fixture('ad.html'), URL1);

  it('is selected and keeps what the structured data gives (company, pay, dates, contract)', () => {
    expect(parserId).toBe('prima-kariera');
    expect(job).toMatchObject({
      title: 'Data Analyst - hybrid, pro juniory',
      company: 'Example Staffing s.r.o.',
      salary_min: 40000, salary_max: 60000, salary_currency: 'CZK', salary_period: 'month',
      employment_type: 'full_time', posted_at: '2026-09-01', valid_until: '2026-11-30', missing: [],
    });
  });

  it('lists all the places of the ad and reads the work mode from its labels', () => {
    expect(job.location).toBe('Brno-město, Praha');
    expect(job).toMatchObject({ remote: 'hybrid', is_hybrid: true, is_remote: false });
  });

  it('takes the sections of the visible text with their headings, without the notice under the ad', () => {
    expect(job.description.startsWith('Informace o pozici')).toBe(true);
    expect(job.description).toContain('Pomůžete týmu & klientům.');
    expect(job.description).toContain('Náplň práce');
    expect(job.description).toContain('- Tvorba reportů');
    expect(job.description.indexOf('Požadavky')).toBeLessThan(job.description.indexOf('Co nabízíme'));
    expect(job.description).not.toContain('Legal notice');
  });

  it('keeps the recruiter with the position and the contacts', () => {
    expect(job.contact_person).toBe('Jana Nováková, Team Lead, +420 000 000 000, jana@example.com');
  });

  it('works without labels and contacts, using the contact of the structured data for the rest', () => {
    const minimal = parseJobPage(fixture('ad-minimal.html'), URL1).job;
    expect(minimal.remote).toBe('');
    expect(minimal.contact_person).toBeUndefined();
    expect(minimal.description).toContain('Tvorba reportů');
  });

  it('falls back to the generic text when the page has no sections', () => {
    const bare = fixture('ad.html').replace(/class="border-bottom"/g, 'class="x"');
    expect(parseJobPage(bare, URL1).job.description).toContain('Hledáme analytika.');
  });

  it('does not throw on unrelated markup', () => {
    const { parserId: id, job: none } = parseJobPage('<html><body><p>Nothing here</p></body></html>', URL1);
    expect(id).toBe('prima-kariera');
    expect(none.missing.length).toBeGreaterThan(0);
  });
});
