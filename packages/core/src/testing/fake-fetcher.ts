import type { FetchResult, PageFetcher } from '../jobs/fetcher';

export class FakePageFetcher implements PageFetcher {
  readonly calls: string[] = [];

  constructor(private readonly pages: Readonly<Record<string, FetchResult>> = {}) {}

  fetch(url: string): FetchResult {
    this.calls.push(url);
    return Object.prototype.hasOwnProperty.call(this.pages, url) ? this.pages[url]! : { status: 404, html: '' };
  }
}
