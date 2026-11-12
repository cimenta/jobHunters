import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DOBRAPRACE_PARSER } from './dobraprace';
import { withoutElements } from './html';
import { parseJobPage } from './registry';
import { jobUrlKey, normalizeJobUrl } from './url';

// Invented data only.

const fixture = (name: string) => readFileSync(new URL(`../../fixtures/dobraprace/${name}`, import.meta.url), 'utf8');
const URL1 = 'https://www.dobraprace.cz/1234567-brigada-baleni-zbozi-vyplata-ihned-old-v-2024-06-11.html';

describe('DobráPráce reader: addresses', () => {
  it('takes the ad pages and nothing else', () => {
    expect(DOBRAPRACE_PARSER.matches(URL1)).toBe(true);
    expect(DOBRAPRACE_PARSER.matches('https://dobraprace.cz/1234567-x.html')).toBe(true);
    expect(DOBRAPRACE_PARSER.matches('https://www.dobraprace.cz/nabidka-prace/praha/')).toBe(false);
    expect(DOBRAPRACE_PARSER.matches('https://www.dobraprace.cz/odpovedet.php?id_inzeratu=1234567')).toBe(false);
    expect(DOBRAPRACE_PARSER.matches('https://example.com/1234567-x.html')).toBe(false);
  });

  it('gives every link to one ad the same key, whatever the words of the title', () => {
    expect(normalizeJobUrl(URL1)).toBe(URL1);
    expect(jobUrlKey(URL1)).toBe('dobraprace.cz:1234567');
    expect(jobUrlKey('https://dobraprace.cz/1234567-other-words.html')).toBe(jobUrlKey(URL1));
    expect(jobUrlKey('https://www.dobraprace.cz/1234568-brigada-baleni-zbozi.html')).not.toBe(jobUrlKey(URL1));
  });
});

describe('DobráPráce reader on an ad', () => {
  const { parserId, job } = parseJobPage(fixture('ad.html'), URL1);

  it('reads the headline, the company, both places, the hourly pay and the type of work', () => {
    expect(parserId).toBe('dobraprace');
    expect(job).toMatchObject({
      title: 'Brigáda - balení zboží, výplata ihned - Praha až 210 Kč/hod.',
      company: 'Example Staff',
      location: 'Praha okres Praha-město, Kladno',
      employment_type: 'temporary',
      is_gig: true,
      salary_min: 160, salary_max: 210, salary_currency: 'CZK', salary_period: 'hour',
      language: 'cs',
      missing: [],
    });
  });

  it('takes the pay of the page and not the monthly figure of the structured data', () => {
    expect(job.salary_period).toBe('hour');
    expect(job.salary_min).not.toBe(33000);
  });

  it('keeps the date posted and drops the "never expires" date of the structured data', () => {
    expect(job.posted_at).toBe('2026-10-27');
    expect(job.valid_until).toBe('');
  });

  it('keeps the contact person', () => {
    expect(job.contact_person).toBe('Jana Nováková');
  });

  it('takes the whole text with its headings and leaves out the frame of the page', () => {
    expect(job.description).toContain('Hledáme brigádníky na balení zboží do skladu v Praze.');
    expect(job.description).toContain('Pracovní náplň');
    expect(job.description).toContain('- balení zboží do krabic,');
    expect(job.description).toContain('Požadujeme');
    expect(job.description).toContain('Nabízíme');
    expect(job.description).toContain('- Výplata ihned následující den.');
    expect(job.description).not.toContain('Aktualizováno');
    expect(job.description).not.toContain('ID:');
    expect(job.description).not.toContain('Odpovědět na inzerát');
    expect(job.description).not.toContain('podobné pozici');
  });
});

describe('DobráPráce reader on odd input', () => {
  it('works with a page that has only the headline, a few facts and a short text', () => {
    const { job } = parseJobPage(fixture('ad-minimal.html'), URL1);
    expect(job).toMatchObject({
      title: 'Skladník - Praha',
      company: 'Example Staff s.r.o.',
      location: 'Praha',
      employment_type: 'full_time',
      is_gig: false,
      description: 'Hledáme skladníka.',
    });
    expect(job.salary_min).toBeNull();
    expect(job.contact_person ?? '').toBe('');
  });

  it('does not fail on a page without the facts bar', () => {
    const { job } = parseJobPage('<html><body><h1>Brigáda - kuchyně</h1><main><p>Text.</p></main></body></html>', URL1);
    expect(job).toMatchObject({ title: 'Brigáda - kuchyně', is_gig: true, employment_type: 'temporary', description: 'Text.' });
  });
});

describe('withoutElements', () => {
  it('cuts out the matching elements with their content, nested ones too', () => {
    const html = '<div>a<div class="x">b<div>c</div>d</div>e<div class="x">f</div>g</div>';
    expect(withoutElements(html, /^<div\b[^>]*class="x"/)).toBe('<div>aeg</div>');
    expect(withoutElements(html, /^<span\b/)).toBe(html);
  });
});
