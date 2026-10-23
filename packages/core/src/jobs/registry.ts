import { FAJN_PARSER } from './fajn';
import { FLEK_PARSER } from './flek';
import { GENERIC_PARSER } from './generic';
import { GIGAPRACE_PARSER } from './gigaprace';
import { htmlToText } from './html';
import { JOBS_CZ_PARSER } from './jobs-cz';
import { JOOBLE_PARSER } from './jooble';
import { LINKEDIN_PARSER } from './linkedin';
import { MANPOWER_PARSER } from './manpower';
import { NELISA_PARSER } from './nelisa';
import { emptyParsedJob, finishParsedJob, mergeParsed, type JobParser, type ParsedJob } from './parsed-job';
import { SPRAVNYKROK_PARSER } from './spravnykrok';
import { STARTUPJOBS_PARSER } from './startupjobs';

export const PORTAL_PARSERS: readonly JobParser[] = [JOBS_CZ_PARSER, LINKEDIN_PARSER, STARTUPJOBS_PARSER, FAJN_PARSER, GIGAPRACE_PARSER, JOOBLE_PARSER, SPRAVNYKROK_PARSER, NELISA_PARSER, MANPOWER_PARSER, FLEK_PARSER];

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
