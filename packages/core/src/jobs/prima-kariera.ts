import { elementsInnerHtml, htmlToText, stripPictographs } from './html';
import { emptyParsedJob, finishParsedJob, type JobParser } from './parsed-job';
import { hostIs, parseUrl } from './url';

/** An ad of Prima kariéra: `/prace/<words-of-the-title>_id<number>`. */
const AD_PATH = /^\/prace\/[^\/]+_id\d+\/?$/i;

const clean = (markup: string | undefined): string => (markup === undefined ? '' : stripPictographs(htmlToText(markup)).replace(/[ \t]+/g, ' ').trim());

/**
 * Prima kariéra (primakariera.cz, checked 2026-10-30) gives the generic reader the JobPosting data (title, company, pay,
 * dates, contract), but there its text is one run of lines and the place is "Brno-město, CZ". This reader takes the
 * visible page instead: the places the ad lists, the sections of the text with their headings (without the legal notice
 * under "Doplňující informace"), the work mode from the labels of the ad and the recruiter with the position and contacts.
 */
export const PRIMA_KARIERA_PARSER: JobParser = {
  id: 'prima-kariera',
  matches: (url) => hostIs(url, 'primakariera.cz') && AD_PATH.test(parseUrl(url)?.path ?? ''),
  parse(html) {
    const job = emptyParsedJob();
    const heading = elementsInnerHtml(html, /^<h1\b/i)[0];
    job.title = clean(heading);

    const places = elementsInnerHtml(html, /^<span\b[^>]*class="lokalita-item"/i).map(clean).filter((place) => place !== '');
    job.location = places.join(', ');

    const labels = elementsInnerHtml(html, /^<span\b[^>]*class="reklamni-stitek-text"/i).map(clean).join(' | ');
    if (/hybrid/i.test(labels)) job.remote = 'hybrid';
    else if (/\bremote\b|z domova/i.test(labels)) job.remote = 'yes';

    const sections = elementsInnerHtml(html, /^<div\b[^>]*class="border-bottom"/i).map(clean).filter((section) => section !== '');
    job.description = sections.join('\n\n');

    const recruiter = elementsInnerHtml(html, /^<div\b[^>]*class="company-recruiter\b/i)[0];
    const contacts = elementsInnerHtml(html, /^<div\b[^>]*class="company-contacts"/i)[0];
    const person = clean(recruiter).split('\n').map((line) => line.trim()).filter((line) => line !== '');
    const reach = clean(contacts).split('\n').map((line) => line.trim()).filter((line) => line !== '');
    const contact = [...person, ...reach].join(', ');
    if (contact !== '') job.contact_person = contact;
    return finishParsedJob(job);
  },
};
