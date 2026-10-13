import { describe, expect, it } from 'vitest';
import { makeCompany, makeJob } from '../testing/fixtures';
import { buildPlaceholders, PROFILE_KEYS } from './placeholders';

describe('buildPlaceholders', () => {
  it('combines profile, company, job and date', () => {
    const values = buildPlaceholders({
      profile: { name: ' Eva Example ', email: 'eva@example.com', phone: '', address: 'Praha', links: 'example.com/eva' },
      company: makeCompany({ name: 'Example s.r.o.' }),
      job: makeJob({ title: 'Android Developer', location: 'Brno' }),
      today: '2026-10-11',
    });
    expect(values).toEqual({
      name: 'Eva Example',
      email: 'eva@example.com',
      phone: '',
      address: 'Praha',
      portfolio: '',
      linkedin: '',
      github: '',
      website: '',
      links: 'example.com/eva',
      company: 'Example s.r.o.',
      position: 'Android Developer',
      location: 'Brno',
      date: '2026-10-11',
    });
  });

  it('leaves {{body}} alone so the AI can fill it later', () => {
    expect(Object.keys(buildPlaceholders({ profile: {}, company: undefined, job: makeJob(), today: '2026-10-11' }))).not.toContain('body');
  });

  it('uses empty strings for a missing company and missing profile keys, and ignores unknown profile keys', () => {
    const values = buildPlaceholders({ profile: { secret_note: 'x', constructor: 'y' }, company: undefined, job: makeJob(), today: '2026-10-11' });
    expect(values.company).toBe('');
    for (const key of PROFILE_KEYS) expect(values[key]).toBe('');
    expect(Object.keys(values)).not.toContain('secret_note');
  });

  it('gives each link alone and lists every filled link in {{links}} in a fixed order without blank lines', () => {
    const values = buildPlaceholders({
      profile: { portfolio: 'example.com/p', linkedin: '', github: 'github.com/eva', website: 'eva.example.com', links: 'other.example.com' },
      company: undefined,
      job: makeJob(),
      today: '2026-10-11',
    });
    expect(values.portfolio).toBe('example.com/p');
    expect(values.linkedin).toBe('');
    expect(values.github).toBe('github.com/eva');
    expect(values.website).toBe('eva.example.com');
    expect(values.links).toBe('example.com/p\ngithub.com/eva\neva.example.com\nother.example.com');
  });

  it('keeps {{links}} exactly as before for a profile that only has the other-links row', () => {
    const values = buildPlaceholders({ profile: { links: 'example.com/a\nexample.com/b' }, company: undefined, job: makeJob(), today: '2026-10-11' });
    expect(values.links).toBe('example.com/a\nexample.com/b');
  });
});
