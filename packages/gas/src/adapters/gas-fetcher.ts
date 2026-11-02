import { resolveRedirect, type FetchResult, type PageFetcher } from '@jobhunters/core';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MAX_REDIRECTS = 5;
const READER_URL = 'https://r.jina.ai/';

/** What a desktop Chrome sends for a page opened by typing the address; some portals answer 403 to a bare request. */
const REQUEST_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'cs,en;q=0.8',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
};

/**
 * Downloads a page as UTF-8. Redirects are followed here, one request each, so the final address is known.
 * Portals may answer 403/429; the caller then asks the user to paste the text.
 */
export class GasPageFetcher implements PageFetcher {
  /** Jina Reader downloads the page from its own servers and returns the HTML; no key is needed for a few requests a minute. */
  fetchViaReader(url: string): FetchResult {
    try {
      const response = UrlFetchApp.fetch(READER_URL + url.replace(/#.*$/, ''), {
        muteHttpExceptions: true,
        headers: { 'X-Return-Format': 'html', Accept: 'text/html' },
      });
      const status = response.getResponseCode();
      return { status, finalUrl: url, html: status === 200 ? response.getContentText('UTF-8') : '' };
    } catch {
      return { status: 0, finalUrl: url, html: '' };
    }
  }

  fetch(url: string): FetchResult {
    // The part after # stays in the stored address (it names an ad on a page with several), but is not sent to the server.
    let current = url.replace(/#.*$/, '');
    let status = 0;
    try {
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const response = UrlFetchApp.fetch(current, {
          muteHttpExceptions: true,
          followRedirects: false,
          headers: REQUEST_HEADERS,
        });
        status = response.getResponseCode();
        const location = status >= 300 && status < 400 ? String((response.getHeaders() as Record<string, unknown>)['Location'] ?? '') : '';
        const next = location === '' ? undefined : resolveRedirect(current, location);
        if (next === undefined) return { status, finalUrl: current, html: status === 200 ? response.getContentText('UTF-8') : '' };
        current = next;
      }
      return { status, finalUrl: current, html: '' };
    } catch {
      return { status: 0, finalUrl: url, html: '' };
    }
  }
}
