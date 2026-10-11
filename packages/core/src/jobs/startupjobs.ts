import { elementsInnerHtml, htmlToText, metaContent } from './html';
import { emptyParsedJob, finishParsedJob, type JobParser } from './parsed-job';
import { hostIs, parseUrl } from './url';

const EMPLOYMENT: Record<string, string> = {
  'full-time': 'full_time',
  'part-time': 'part_time',
  contract: 'contractor',
  internship: 'intern',
};

/**
 * A live ad carries a full JobPosting in JSON-LD (checked 2026-10-11), which the generic parser reads and
 * the registry merges in. This parser only adds the <h1> title and the employment link as fallbacks, so an
 * expired ad (no JobPosting) still yields its title.
 */
export const STARTUPJOBS_PARSER: JobParser = {
  id: 'startupjobs',
  matches: (url) => hostIs(url, 'startupjobs.cz') && (parseUrl(url)?.path.startsWith('/nabidka/') ?? false),
  parse(html) {
    const job = emptyParsedJob();
    const heading = elementsInnerHtml(html, /^<h1\b/i)[0];
    job.title = heading === undefined ? metaContent(html, 'og:title') : htmlToText(heading);
    const link = /href="\/nabidky\?uvazek=([a-z-]+)"/.exec(html);
    job.employment_type = link ? (EMPLOYMENT[link[1]!] ?? '') : '';
    return finishParsedJob(job);
  },
};
