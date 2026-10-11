export interface FetchResult {
  /** HTTP status; 0 when the request itself failed. */
  status: number;
  /** The page body for a 200 answer, otherwise empty. */
  html: string;
}

export interface PageFetcher {
  fetch(url: string): FetchResult;
}
