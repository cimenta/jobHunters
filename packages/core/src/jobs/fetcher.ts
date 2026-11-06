export interface FetchResult {
  /** HTTP status of the last answer; 0 when the request itself failed. */
  status: number;
  /** The address the download ended at, after following redirects. The requested address when there was none. */
  finalUrl: string;
  /** The page body for a 200 answer, otherwise empty (fetchApi gives the body whatever the status). */
  html: string;
  /** Why no answer arrived (status 0), when it is known; only fetchApi fills it in. */
  error?: string;
}

export interface PageFetcher {
  fetch(url: string): FetchResult;
  /** Downloads the page through a third-party reader service (Jina), for pages that refuse a direct request. */
  fetchViaReader?(url: string): FetchResult;
  /** A plain GET request to the user's own parser with the headers of its configuration (Settings, tab Parser); the body is returned whatever the status. */
  fetchApi?(url: string, headers: Record<string, string>): FetchResult;
}
