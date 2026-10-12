import type { FetchResult, PageFetcher } from '../jobs/fetcher';

/** A canned answer; finalUrl defaults to the requested address. */
export type FakePage = Omit<FetchResult, 'finalUrl'> & { finalUrl?: string };

export class FakePageFetcher implements PageFetcher {
  readonly calls: string[] = [];

  constructor(private readonly pages: Readonly<Record<string, FakePage>> = {}) {}

  fetch(url: string): FetchResult {
    this.calls.push(url);
    const page = Object.prototype.hasOwnProperty.call(this.pages, url) ? this.pages[url]! : { status: 404, html: '' };
    return { ...page, finalUrl: page.finalUrl ?? url };
  }
}
