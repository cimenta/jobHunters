import { describe, expect, it } from 'vitest';
import { errorOf } from '../testing/errors';
import { hostIs, jobUrlKey, normalizeJobUrl, parseUrl, resolveRedirect, titleFromUrl } from './url';

describe('parseUrl', () => {
  it('splits a web address without the URL class', () => {
    expect(parseUrl('HTTPS://WWW.Example.com:8080/a/b?x=1&y=2#frag')).toEqual({
      protocol: 'https',
      host: 'www.example.com',
      path: '/a/b',
      query: ['x=1', 'y=2'],
    });
  });
  it('defaults the path to /', () => {
    expect(parseUrl('https://example.com')?.path).toBe('/');
  });
  it('rejects anything that is not a public http(s) address', () => {
    for (const bad of ['ftp://x.cz/a', 'not a url', 'https://user:pw@example.com/', 'http://localhost/x', 'javascript:alert(1)', 'http://10.0.0.1/']) {
      expect(parseUrl(bad), bad).toBeUndefined();
    }
  });
});

describe('hostIs', () => {
  it('matches the domain and its subdomains only', () => {
    expect(hostIs('https://www.jobs.cz/x', 'jobs.cz')).toBe(true);
    expect(hostIs('https://beta.jobs.cz/x', 'jobs.cz')).toBe(true);
    expect(hostIs('https://jobs.cz/x', 'jobs.cz')).toBe(true);
    expect(hostIs('https://notjobs.cz/x', 'jobs.cz')).toBe(false);
    expect(hostIs('https://jobs.cz.evil.example/x', 'jobs.cz')).toBe(false);
  });
});

describe('normalizeJobUrl', () => {
  it('removes tracking parameters and the fragment, keeps meaningful ones', () => {
    expect(normalizeJobUrl('https://www.jobs.cz/rpd/1564217303/?searchId=a0071c64&rps=233#x')).toBe('https://www.jobs.cz/rpd/1564217303/');
    expect(normalizeJobUrl('https://example.com/job?id=7&utm_source=x&fbclid=y')).toBe('https://example.com/job?id=7');
  });
  it('removes the entry parameter of the Fajn Brigády and Inwork links that come from Jooble', () => {
    expect(normalizeJobUrl('https://www.inwork.cz/prace/jihomoravsky-kraj/brno/brno/6565355-operator-ka-vyroby/?vstup=jooble&utm_source=jooble&utm_medium=cpc#segmetation=STANDARD')).toBe('https://www.inwork.cz/prace/jihomoravsky-kraj/brno/brno/6565355-operator-ka-vyroby/');
  });
  it('adds https:// when the scheme is missing and lower-cases the host', () => {
    expect(normalizeJobUrl(' Jobs.cz/rpd/1 ')).toBe('https://jobs.cz/rpd/1');
  });
  it('throws a coded error for an invalid address', () => {
    expect(errorOf(() => normalizeJobUrl('ftp://x.cz/a'))).toMatchObject({ code: 'url_invalid', params: { url: 'ftp://x.cz/a' } });
    expect(errorOf(() => normalizeJobUrl('hello world'))).toMatchObject({ code: 'url_invalid' });
  });
});

describe('jobUrlKey', () => {
  it('gives every Jobs.cz link to one ad the same key', () => {
    const key = jobUrlKey('https://www.jobs.cz/rpd/2001370717/');
    expect(key).toBe('jobs.cz:2001370717');
    expect(jobUrlKey('https://www.jobs.cz/fp/profinit-eu-s-r-o-214226/2001370717/')).toBe(key);
    expect(jobUrlKey('https://beta.jobs.cz/rpd/2001370717')).toBe(key);
  });
  it('gives every LinkedIn link to one ad the same key', () => {
    const key = 'linkedin:4450632852';
    expect(jobUrlKey('https://cz.linkedin.com/jobs/view/senior-software-engineer-at-kiwi-com-4450632852')).toBe(key);
    expect(jobUrlKey('https://www.linkedin.com/jobs/view/4450632852/')).toBe(key);
    expect(jobUrlKey('https://www.linkedin.com/jobs/search/?currentJobId=4450632852&keywords=x')).toBe(key);
  });
  it('gives StartupJobs links with or without the slug the same key', () => {
    expect(jobUrlKey('https://www.startupjobs.cz/nabidka/103773/senior-backend-developer')).toBe('startupjobs.cz:103773');
    expect(jobUrlKey('https://www.startupjobs.cz/nabidka/103773')).toBe('startupjobs.cz:103773');
  });
  it('gives every link to one Fajn Brigády or Inwork ad the same key, whatever its slug, region or parameters', () => {
    const key = jobUrlKey('https://www.inwork.cz/prace/jihomoravsky-kraj/brno/brno/6565355-operator-ka-vyroby-skvele/?vstup=jooble');
    expect(key).toBe('inwork.cz:6565355');
    expect(jobUrlKey('https://inwork.cz/prace/jihomoravsky-kraj/praha/praha/6565355-jiny-slug/')).toBe(key);
    expect(jobUrlKey('https://www.fajn-brigady.cz/brigady/manualni/brno/6574929-hledas-stabilni-brigadu/?vstup=jooble')).toBe('fajn-brigady.cz:6574929');
    expect(jobUrlKey('https://www.fajn-brigady.cz/brigady/manualni/brno/6565355-x/')).not.toBe(key);
  });

  it('gives every link to one GigaPrace ad the same key', () => {
    expect(jobUrlKey('https://www.gigaprace.cz/nabidka-prace/wd1yzk/doplnovacka-automatu-region-brno-brno?utm_source=jooble&utm_away=abc')).toBe('gigaprace.cz:wd1yzk');
    expect(jobUrlKey('https://gigaprace.cz/nabidka-prace/WD1YZK/anything')).toBe('gigaprace.cz:wd1yzk');
  });

  it('falls back to host + path + query for other sites', () => {
    expect(jobUrlKey(normalizeJobUrl('https://WWW.Example.com/a/b/?utm_x=1'))).toBe('example.com/a/b');
    expect(jobUrlKey('https://example.com/job?id=7')).toBe('example.com/job?id=7');
  });
});

describe('titleFromUrl', () => {
  it('humanises the slug and drops the trailing id', () => {
    expect(titleFromUrl('https://www.linkedin.com/jobs/view/software-engineer-at-acme-123456789')).toBe('software engineer at acme');
    expect(titleFromUrl('https://www.startupjobs.cz/nabidka/103773/senior-backend-developer-python')).toBe('senior backend developer python');
  });
  it('falls back to the host when there is no slug, and ignores the company slug of Jobs.cz', () => {
    expect(titleFromUrl('https://www.jobs.cz/rpd/2000000001/')).toBe('jobs.cz');
    expect(titleFromUrl('https://www.jobs.cz/fp/example-s-r-o-1/2000000001/')).toBe('jobs.cz');
  });
});

describe('resolveRedirect', () => {
  const base = 'https://www.example.com/jobs/detail/42?x=1';
  it('resolves absolute, scheme-relative, root-relative, relative and query-only targets', () => {
    expect(resolveRedirect(base, 'https://other.example.org/a')).toBe('https://other.example.org/a');
    expect(resolveRedirect(base, '//cdn.example.com/a')).toBe('https://cdn.example.com/a');
    expect(resolveRedirect(base, '/list')).toBe('https://www.example.com/list');
    expect(resolveRedirect(base, '43')).toBe('https://www.example.com/jobs/detail/43');
    expect(resolveRedirect(base, '?page=2')).toBe('https://www.example.com/jobs/detail/42?page=2');
    expect(resolveRedirect(base, '  ')).toBeUndefined();
    expect(resolveRedirect('not a url', '/x')).toBeUndefined();
  });
});
