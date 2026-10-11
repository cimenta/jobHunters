import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CELL_LIMIT } from './html';
import { emptyParsedJob, finishParsedJob, mergeParsed } from './parsed-job';
import { parseGeneric } from './generic';

const fixture = (name: string) => readFileSync(new URL(`../../fixtures/${name}`, import.meta.url), 'utf8');

describe('parseGeneric', () => {
  it('reads a JSON-LD JobPosting', () => {
    const job = parseGeneric(fixture('generic/json-ld.html'), 'https://example.com/job');
    expect(job).toMatchObject({
      title: 'Data Analyst',
      company: 'Example Ltd',
      location: 'Brno, CZ',
      salary_min: 250,
      salary_max: 300,
      salary_currency: 'CZK',
      salary_period: 'hour',
      employment_type: 'part_time',
      is_gig: true,
      remote: 'yes',
      posted_at: '2026-09-30',
      valid_until: '2026-11-30',
      language: 'en',
      missing: [],
    });
    expect(job.description).toBe('Analyse data for the business. You will work with the team and report to the head of data.\n- SQL');
  });

  it('falls back to OpenGraph and the title tag, and lists what is missing', () => {
    const html = '<head><title>Fallback title</title><meta property="og:title" content="OG title"><meta property="og:description" content="Teaser"></head>';
    const job = parseGeneric(html, 'https://example.com/job');
    expect(job.title).toBe('OG title');
    expect(job.description).toBe('Teaser');
    expect(job.missing).toEqual(['company', 'location']);
    expect(parseGeneric('<title>Only title</title>', 'https://example.com').title).toBe('Only title');
  });

  it('survives a page without any data', () => {
    expect(parseGeneric('', 'https://example.com')).toMatchObject({ title: '', description: '', missing: ['title', 'company', 'location', 'description'] });
  });

  it('ignores a JobPosting with the wrong shape instead of throwing', () => {
    const html = '<script type="application/ld+json">{"@type":"JobPosting","title":5,"hiringOrganization":[1],"jobLocation":"Praha","baseSalary":"lots"}</script>';
    const job = parseGeneric(html, 'https://example.com');
    expect(job.company).toBe('');
    expect(job.location).toBe('Praha');
    expect(job.salary_min).toBeNull();
  });
});

describe('finishParsedJob / mergeParsed', () => {
  it('caps the description below the cell limit and detects the language', () => {
    const job = finishParsedJob({ ...emptyParsedJob(), description: 'We are looking for an engineer to build services for our team. '.repeat(2000) });
    expect(job.description.length).toBe(CELL_LIMIT);
    expect(job.language).toBe('en');
  });

  it('lets non-empty values of the second job win and ORs is_gig', () => {
    const base = { ...emptyParsedJob(), title: 'Base', company: 'Base Co', salary_min: 1, is_gig: true };
    const over = { ...emptyParsedJob(), title: 'Over', salary_min: null, remote: 'yes' as const };
    expect(mergeParsed(base, over)).toMatchObject({ title: 'Over', company: 'Base Co', salary_min: 1, is_gig: true, remote: 'yes' });
  });
});
