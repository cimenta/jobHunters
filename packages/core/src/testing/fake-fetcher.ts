import type { FetchResult, PageFetcher } from '../jobs/fetcher';

/** A canned answer; finalUrl defaults to the requested address. */
export type FakePage = Omit<FetchResult, 'finalUrl'> & { finalUrl?: string };

export class FakePageFetcher implements PageFetcher {
  readonly calls: string[] = [];
  readonly readerCalls: string[] = [];

  constructor(
    private readonly pages: Readonly<Record<string, FakePage>> = {},
    readonly readerPages: Record<string, FakePage> = {},
  ) {}

  fetchViaReader(url: string): FetchResult {
    this.readerCalls.push(url);
    const page = Object.prototype.hasOwnProperty.call(this.readerPages, url) ? this.readerPages[url]! : { status: 404, html: '' };
    return { ...page, finalUrl: page.finalUrl ?? url };
  }

  fetch(url: string): FetchResult {
    this.calls.push(url);
    const page = Object.prototype.hasOwnProperty.call(this.pages, url) ? this.pages[url]! : { status: 404, html: '' };
    return { ...page, finalUrl: page.finalUrl ?? url };
  }
}
