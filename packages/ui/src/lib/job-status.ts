import { parseJobStatusStyles, resolveJobStatus, type JobStatusStyles, type ResolvedJobStatus } from '@jobhunters/core';
import { app } from '../state/app.svelte';
import { ui } from './i18n.svelte';

const DEFAULTS = parseJobStatusStyles('{}')!;

/** The statuses of ads with the user's customisation; the built-in ones until the settings are loaded. */
export function jobStyles(): JobStatusStyles {
  return app.settings?.job_status_styles ?? DEFAULTS;
}

/** Text and colours of the status of an ad; a new ad that was evaluated shows its match. */
export function jobStatus(job: { status: string; match_percent: number | null }): ResolvedJobStatus {
  return resolveJobStatus(jobStyles(), job.status, job.match_percent, ui.locale);
}

/** The statuses an ad may be put in, with their names in the current language. */
export function jobStatusOptions(includeAwaiting = false): { code: string; text: string }[] {
  const styles = jobStyles();
  // "awaiting" is set by the app for ads handed to the AI; nobody picks it by hand.
  return Object.keys(styles).filter((code) => includeAwaiting || code !== 'awaiting').map((code) => ({ code, text: resolveJobStatus(styles, code, null, ui.locale).text }));
}
