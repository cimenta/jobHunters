import { ValidationError } from '../errors';

export interface ParsedUrl {
  protocol: string;
  host: string;
  path: string;
  /** Raw "key=value" pairs in their original order. */
  query: string[];
  /** The part after #, without it. */
  fragment: string;
}

// Apps Script has no URL class, so web addresses are split by hand.
const URL_PATTERN = /^(https?):\/\/([^\/?#]+)([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/i;

const TRACKING_PARAMS = new Set([
  'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid', 'igshid', '_ga',
  'trk', 'gh_src', 'trackingid', 'refid', 'ref', 'searchid', 'rps', 'vstup',
]);

export function parseUrl(raw: string): ParsedUrl | undefined {
  const match = URL_PATTERN.exec(raw.trim());
  if (!match) return undefined;
  const authority = match[2]!;
  if (authority.includes('@')) return undefined;
  const host = authority.replace(/:\d+$/, '').toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return undefined;
  return {
    protocol: match[1]!.toLowerCase(),
    host,
    path: match[3] || '/',
    query: (match[4] ?? '').split('&').filter((pair) => pair !== ''),
    fragment: match[5] ?? '',
  };
}

export function hostIs(url: string, domain: string): boolean {
  const parsed = parseUrl(url);
  return parsed !== undefined && (parsed.host === domain || parsed.host.endsWith(`.${domain}`));
}

function isTrackingParam(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.startsWith('utm_') || TRACKING_PARAMS.has(lower);
}

/** Sites whose single page lists several ads, each reached by an anchor ("#analytik-medior"). */
const ANCHOR_HOSTS = ['cesnet.cz'];

/** The anchor that tells the ads of such a page apart; the fragment of every other address is dropped as noise. */
function anchorOf(parsed: ParsedUrl): string {
  const listed = ANCHOR_HOSTS.some((domain) => parsed.host === domain || parsed.host.endsWith(`.${domain}`));
  return listed && /^[a-z0-9][a-z0-9_.-]*$/i.test(parsed.fragment) ? parsed.fragment : '';
}

/** The address that is stored: tracking parameters removed, and the fragment too unless the site is one that needs its anchor. */
export function normalizeJobUrl(raw: string): string {
  const trimmed = raw.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = parseUrl(withScheme);
  if (!parsed) throw new ValidationError('url_invalid', `Not a valid web address: ${trimmed}`, { url: trimmed.slice(0, 200) });
  // dream.jobs names the open ad in activeOpportunityId; the other parameters only choose what the list beside it shows.
  const own = hostIs(withScheme, 'dream.jobs') && parsed.query.some((pair) => pair.startsWith('activeOpportunityId='));
  const career = careerPageKey(withScheme) !== '';
  const kept = parsed.query.filter((pair) => (own ? pair.startsWith('activeOpportunityId=') : career ? pair.startsWith('id=') : !isTrackingParam(pair.split('=')[0]!)));
  return `${parsed.protocol}://${parsed.host}${parsed.path}${kept.length > 0 ? `?${kept.join('&')}` : ''}${anchorOf(parsed) === '' ? '' : `#${anchorOf(parsed)}`}`;
}

function queryValue(query: string[], name: string): string | undefined {
  for (const pair of query) {
    const [key, value] = pair.split('=');
    if (key === name) return value;
  }
  return undefined;
}

/**
 * An ad on the career pages that Alma Career runs for a company (kaufland.jobs.cz/detail-pozice?id=<number>): the key is
 * "<host>:<number>", empty for any other address. Every other parameter (r, impressionId, rps) only says where the link came from.
 */
export function careerPageKey(url: string): string {
  const parsed = parseUrl(url);
  if (parsed === undefined || !/^(?!www\.)[a-z0-9-]+\.jobs\.cz$/.test(parsed.host) || !/^\/detail-pozice\/?$/i.test(parsed.path)) return '';
  const id = parsed.query.find((pair) => /^id=\d+$/.test(pair));
  return id === undefined ? '' : `${parsed.host}:${id.slice(3)}`;
}

/** The ad that is open on the list page is named in the address: `/jobs?activeOpportunityId=<id>`. */
export function dreamJobsId(url: string): string {
  const parsed = parseUrl(url);
  if (parsed === undefined || !hostIs(url, 'dream.jobs') || !/^\/jobs\/?$/i.test(parsed.path)) return '';
  for (const pair of parsed.query) {
    const [key, value] = pair.split('=');
    if (key === 'activeOpportunityId' && /^\d+$/.test(value ?? '')) return value!;
  }
  return '';
}

/** Same ad, same key: used to find duplicates whatever link the user pasted. */
export function jobUrlKey(url: string): string {
  const parsed = parseUrl(url);
  if (!parsed) return url.trim().toLowerCase();

  const career = careerPageKey(url);
  if (career !== '') return career;
  if (hostIs(url, 'jobs.cz')) {
    const match = /^\/(?:rpd\/(\d+)|fp\/[^\/]+\/(\d+))\/?$/.exec(parsed.path);
    if (match) return `jobs.cz:${match[1] ?? match[2]}`;
  }
  if (hostIs(url, 'linkedin.com')) {
    const match = /^\/jobs\/view\/(?:[^\/]*-)?(\d+)\/?$/.exec(parsed.path);
    if (match) return `linkedin:${match[1]}`;
    const current = queryValue(parsed.query, 'currentJobId');
    if (current !== undefined && /^\d+$/.test(current)) return `linkedin:${current}`;
  }
  if (hostIs(url, 'startupjobs.cz')) {
    const match = /^\/nabidka\/(\d+)(?:\/.*)?$/.exec(parsed.path);
    if (match) return `startupjobs.cz:${match[1]}`;
  }

  if (hostIs(url, 'fajn-brigady.cz') || hostIs(url, 'inwork.cz')) {
    const match = /\/(\d{4,})-[a-z0-9-]+\/?$/i.exec(parsed.path);
    if (match) return `${hostIs(url, 'inwork.cz') ? 'inwork.cz' : 'fajn-brigady.cz'}:${match[1]}`;
  }
  if (hostIs(url, 'manpower.cz')) {
    const match = /^\/nabidky-prace\/[a-z0-9-]+--(\d+)\/?$/i.exec(parsed.path);
    if (match) return `manpower.cz:${match[1]}`;
  }
  if (hostIs(url, 'flek.cz')) {
    const match = /^\/nabidka\/[a-z0-9-]+\/(\d+)\/?$/i.exec(parsed.path);
    if (match) return `flek.cz:${match[1]}`;
  }
  if (hostIs(url, 'nelisa.com')) {
    const match = /^\/[a-z]{2}\/offer\/([0-9a-f-]{36})\/?$/i.exec(parsed.path);
    if (match) return `nelisa:${match[1]!.toLowerCase()}`;
  }
  if (hostIs(url, 'spravnykrok.cz')) {
    const match = /^\/prace\/nabidka\/(\d+)-[a-z0-9-]+\.html$/i.exec(parsed.path);
    if (match) return `spravnykrok.cz:${match[1]}`;
  }
  if (hostIs(url, 'jooble.org')) {
    const match = /^\/(?:desc|jdp)\/(-?\d+)\/?$/.exec(parsed.path);
    if (match) return `jooble:${match[1]}`;
  }
  if (hostIs(url, 'greenhouse.io')) {
    const match = /^\/[^\/]+\/jobs\/(\d+)\/?$/.exec(parsed.path);
    if (match) return `greenhouse:${match[1]}`;
  }
  if (hostIs(url, 'primakariera.cz')) {
    const match = /^\/prace\/[^\/]+_id(\d+)\/?$/i.exec(parsed.path);
    if (match) return `primakariera.cz:${match[1]}`;
  }
  if (hostIs(url, 'dream.jobs')) {
    const id = dreamJobsId(url);
    if (id !== '') return `dream.jobs:${id}`;
  }
  if (hostIs(url, 'gigaprace.cz')) {
    const match = /^\/nabidka-prace\/([a-z0-9]+)(?:\/.*)?$/i.exec(parsed.path);
    if (match) return `gigaprace.cz:${match[1]!.toLowerCase()}`;
  }

  const host = parsed.host.replace(/^www\./, '');
  const path = parsed.path.length > 1 ? parsed.path.replace(/\/+$/, '') : '';
  const anchor = anchorOf(parsed).toLowerCase();
  return `${host}${path}${parsed.query.length > 0 ? `?${parsed.query.join('&')}` : ''}${anchor === '' ? '' : `#${anchor}`}`;
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** A readable placeholder title when nothing could be downloaded: the slug of the address, else the host. */
export function titleFromUrl(url: string): string {
  const parsed = parseUrl(url);
  if (!parsed) return '';
  const host = parsed.host.replace(/^www\./, '');
  const all = parsed.path.split('/').filter((segment) => segment !== '');
  // On Jobs.cz the segment after /fp/ is the company, not the job.
  const slug = all
    .filter((_, index) => all[index - 1] !== 'fp')
    .reverse()
    .find((segment) => /[a-z]/i.test(segment) && /[-_]/.test(segment));
  if (slug === undefined) return host;
  const words = safeDecode(slug).replace(/[-_]+/g, ' ').replace(/\s+\d+$/, '').trim();
  return words === '' ? host : words;
}

/** Turns the Location header of a redirect into an absolute address; undefined when it cannot be resolved. */
export function resolveRedirect(base: string, location: string): string | undefined {
  const target = location.trim();
  if (target === '') return undefined;
  if (/^https?:\/\//i.test(target)) return target;
  const match = /^(https?:)\/\/([^\/?#]+)([^?#]*)/i.exec(base.trim());
  if (!match) return undefined;
  const [, scheme, authority, path] = match;
  if (target.startsWith('//')) return `${scheme}${target}`;
  if (target.startsWith('/')) return `${scheme}//${authority}${target}`;
  if (target.startsWith('?') || target.startsWith('#')) return `${scheme}//${authority}${path}${target}`;
  const directory = path!.slice(0, path!.lastIndexOf('/') + 1);
  return `${scheme}//${authority}${directory === '' ? '/' : directory}${target}`;
}
