import type { FetchResult, PageFetcher } from '@jobhunters/core';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** Downloads a page as UTF-8. Portals may answer 403/429; the caller then asks the user to paste the text. */
export class GasPageFetcher implements PageFetcher {
  fetch(url: string): FetchResult {
    try {
      const response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        followRedirects: true,
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'cs,en;q=0.8' },
      });
      const status = response.getResponseCode();
      return { status, html: status === 200 ? response.getContentText('UTF-8') : '' };
    } catch {
      return { status: 0, html: '' };
    }
  }
}
