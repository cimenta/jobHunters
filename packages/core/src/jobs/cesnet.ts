import { elementsInnerHtml, htmlToText, stripPictographs } from './html';
import { emptyParsedJob, finishParsedJob, type JobParser } from './parsed-job';
import { hostIs, parseUrl } from './url';

/**
 * The career page of CESNET (cesnet.cz/kariera, checked 2026-10-24) lists all open positions on one page, each as a
 * folding item with a heading, the place and the text; the part of the address after # (the id of the item) says which
 * one is meant. The page is behind a "not a bot" check, so the source code usually has to be pasted.
 */
export const CESNET_PARSER: JobParser = {
  id: 'cesnet',
  matches: (url) => hostIs(url, 'cesnet.cz') && /^\/kariera\/?$/i.test(parseUrl(url)?.path ?? ''),
  parse(html, url) {
    const job = emptyParsedJob();
    const fragment = parseUrl(url)?.fragment ?? '';
    const items = elementsInnerHtml(html, /^<div\b[^>]*class="list-items__item(?:\s[^"]*)?"/i);
    const item = fragment !== '' ? items.find((inner) => inner.includes(`id="${fragment}"`)) : items.length === 1 ? items[0] : undefined;
    if (item === undefined) return finishParsedJob(job);

    const heading = elementsInnerHtml(item, /^<h3\b/i)[0];
    job.title = heading === undefined ? '' : stripPictographs(htmlToText(heading)).replace(/\s+/g, ' ').trim();
    job.company = 'CESNET';
    const place = elementsInnerHtml(item, /^<div\b[^>]*class="location"/i)[0];
    job.location = place === undefined ? '' : htmlToText(place).replace(/\s+/g, ' ').trim();
    const text = elementsInnerHtml(item, /^<div\b[^>]*class="description"/i)[0];
    job.description = text === undefined ? '' : stripPictographs(htmlToText(text));
    return finishParsedJob(job);
  },
};
