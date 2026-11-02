export interface FetchResult {
  /** HTTP status of the last answer; 0 when the request itself failed. */
  status: number;
  /** The address the download ended at, after following redirects. The requested address when there was none. */
  finalUrl: string;
  /** The page body for a 200 answer, otherwise empty. */
  html: string;
}

export interface PageFetcher {
  fetch(url: string): FetchResult;
  /** Downloads the page through a third-party reader service (Jina), for pages that refuse a direct request. */
  fetchViaReader?(url: string): FetchResult;
}
