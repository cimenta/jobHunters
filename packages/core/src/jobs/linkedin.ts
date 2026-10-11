import { elementsInnerHtml, htmlToText } from './html';
import { emptyParsedJob, finishParsedJob, type JobParser } from './parsed-job';
import { hostIs, parseUrl } from './url';

const firstText = (html: string, openTag: RegExp): string => {
  const inner = elementsInnerHtml(html, openTag)[0];
  return inner === undefined ? '' : htmlToText(inner);
};

/** Modelled on the public (guest) job page classes seen on 2026-10-11. The server often answers 429 to scripts. */
export const LINKEDIN_PARSER: JobParser = {
  id: 'linkedin',
  matches: (url) => hostIs(url, 'linkedin.com') && (parseUrl(url)?.path.startsWith('/jobs') ?? false),
  parse(html) {
    const job = emptyParsedJob();
    job.title = firstText(html, /class="[^"]*top-card-layout__title/);
    job.company = firstText(html, /class="[^"]*topcard__org-name-link/);
    job.location = firstText(html, /class="[^"]*topcard__flavor--bullet/);
    job.description = firstText(html, /class="[^"]*show-more-less-html__markup/);
    return finishParsedJob(job);
  },
};
