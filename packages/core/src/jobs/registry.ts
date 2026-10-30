import { CAREER_PAGE_PARSER } from './career-page';
import { CESNET_PARSER } from './cesnet';
import { DREAM_JOBS_PARSER } from './dream-jobs';
import { EASY_PRACE_PARSER } from './easy-prace';
import { FAJN_PARSER } from './fajn';
import { FLEK_PARSER } from './flek';
import { GENERIC_PARSER } from './generic';
import { GIGAPRACE_PARSER } from './gigaprace';
import { GREENHOUSE_PARSER } from './greenhouse';
import { htmlToText } from './html';
import { JOBS_CZ_PARSER } from './jobs-cz';
import { JOOBLE_PARSER } from './jooble';
import { LINKEDIN_PARSER } from './linkedin';
import { MANPOWER_PARSER } from './manpower';
import { PRIMA_KARIERA_PARSER } from './prima-kariera';
import { NELISA_PARSER } from './nelisa';
import { emptyParsedJob, finishParsedJob, mergeParsed, type JobParser, type ParsedJob } from './parsed-job';
import { SPRAVNYKROK_PARSER } from './spravnykrok';
import { STARTUPJOBS_PARSER } from './startupjobs';

export const PORTAL_PARSERS: readonly JobParser[] = [CAREER_PAGE_PARSER, JOBS_CZ_PARSER, LINKEDIN_PARSER, STARTUPJOBS_PARSER, FAJN_PARSER, GIGAPRACE_PARSER, JOOBLE_PARSER, SPRAVNYKROK_PARSER, NELISA_PARSER, MANPOWER_PARSER, FLEK_PARSER, CESNET_PARSER, GREENHOUSE_PARSER, DREAM_JOBS_PARSER, PRIMA_KARIERA_PARSER, EASY_PRACE_PARSER];

/** The websites that have a reader of their own, one per portal parser (by its id), for the list in Help. */
export const PORTAL_SITES: readonly { id: string; name: string; url: string }[] = [
  { id: 'jobs-cz', name: 'Jobs.cz', url: 'https://www.jobs.cz/' },
  { id: 'career-page', name: 'Company career pages on jobs.cz (e.g. Kaufland)', url: 'https://kaufland.jobs.cz/' },
  { id: 'linkedin', name: 'LinkedIn', url: 'https://www.linkedin.com/jobs/' },
  { id: 'startupjobs', name: 'StartupJobs', url: 'https://www.startupjobs.cz/' },
  { id: 'fajn', name: 'Fajn Brigády, Inwork', url: 'https://www.fajn-brigady.cz/' },
  { id: 'gigaprace', name: 'Gigaprace', url: 'https://www.gigaprace.cz/' },
  { id: 'jooble', name: 'Jooble', url: 'https://cz.jooble.org/' },
  { id: 'spravnykrok', name: 'Správný krok', url: 'https://www.spravnykrok.cz/' },
  { id: 'nelisa', name: 'Nelisa', url: 'https://nelisa.com/' },
  { id: 'manpower', name: 'Manpower', url: 'https://www.manpower.cz/' },
  { id: 'flek', name: 'Flek', url: 'https://www.flek.cz/' },
  { id: 'cesnet', name: 'CESNET', url: 'https://www.cesnet.cz/kariera/' },
  { id: 'greenhouse', name: 'Greenhouse', url: 'https://www.greenhouse.com/' },
  { id: 'dream-jobs', name: 'dream.jobs', url: 'https://dream.jobs/' },
  { id: 'easy-prace', name: 'Easy-práce.cz', url: 'https://www.easy-prace.cz/' },
  { id: 'prima-kariera', name: 'Prima kariéra', url: 'https://www.primakariera.cz/' },
];

export interface ParseOptions {
  parsers?: readonly JobParser[];
  onError?: (parserId: string, error: unknown) => void;
}

function attempt(parser: JobParser, html: string, url: string, onError?: ParseOptions['onError']): ParsedJob | undefined {
  try {
    return parser.parse(html, url);
  } catch (error) {
    try {
      onError?.(parser.id, error);
    } catch {
      // Reporting must not break parsing.
    }
    return undefined;
  }
}

/**
 * The generic result is always computed; the first matching portal parser is overlaid on it.
 * A parser that throws is reported and ignored, so a markup change never blocks saving a job.
 */
export function parseJobPage(html: string, url: string, options: ParseOptions = {}): { parserId: string; job: ParsedJob } {
  const generic = attempt(GENERIC_PARSER, html, url, options.onError) ?? finishParsedJob(emptyParsedJob());
  const parser = (options.parsers ?? PORTAL_PARSERS).find((candidate) => candidate.matches(url));
  if (parser === undefined) return { parserId: GENERIC_PARSER.id, job: generic };
  const portal = attempt(parser, html, url, options.onError);
  if (portal === undefined) return { parserId: GENERIC_PARSER.id, job: generic };
  return { parserId: parser.id, job: finishParsedJob(mergeParsed(generic, portal)) };
}

/** For ads the user pasted as text because the page could not be downloaded. */
export function parseManualText(text: string, hints: { title?: string; company?: string } = {}): ParsedJob {
  const clean = htmlToText(text);
  const firstLine = clean.split('\n').find((line) => line.trim() !== '') ?? '';
  return finishParsedJob({
    ...emptyParsedJob(),
    title: hints.title?.trim() || (firstLine.length <= 120 ? firstLine : ''),
    company: hints.company?.trim() ?? '',
    description: clean,
  });
}
