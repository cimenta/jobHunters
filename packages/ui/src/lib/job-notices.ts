import type { AvailabilityCheck, RefreshResult } from '../api/types';
import { toast } from '../state/toast.svelte';
import { tr } from './i18n.svelte';
import { availabilityReasonLabel } from './labels';

/** Informative notice after an availability check: names the job and explains the verdict. */
export function reportAvailability(check: AvailabilityCheck): void {
  const { job, verdict } = check;
  const reason = availabilityReasonLabel(job.availability_reason);
  const title = job.title;
  if (verdict.availability === 'online') toast.success(tr('ui.job.checkResult.online', { title }));
  else if (job.availability === 'offline') toast.warning(tr('ui.job.checkResult.offline', { title, reason }));
  else if (verdict.availability === 'offline') toast.warning(tr('ui.job.checkResult.suspected', { title, reason }));
  else toast.warning(tr('ui.job.checkResult.unknown', { title, reason }));
}

/** Changed Jobs columns, grouped the way the user thinks of them, in display order. */
const REFRESH_GROUPS: Array<{ key: string; columns: string[] }> = [
  { key: 'title', columns: ['title'] },
  { key: 'salary', columns: ['salary_min', 'salary_max', 'salary_currency', 'salary_period'] },
  { key: 'workMode', columns: ['remote'] },
  { key: 'type', columns: ['employment_type'] },
  { key: 'location', columns: ['location'] },
  { key: 'dates', columns: ['posted_at', 'valid_until'] },
  { key: 'description', columns: ['description'] },
  { key: 'language', columns: ['language'] },
  { key: 'company', columns: ['company'] },
];

/** Names (in the user's words) of the field groups that a refresh changed. */
export function refreshedFields(changed: string[]): string[] {
  return REFRESH_GROUPS.filter((group) => group.columns.some((column) => changed.includes(column))).map((group) => tr(`ui.job.refreshField.${group.key}`));
}

/** Informative notice after a refresh: names the job and what changed. */
export function reportRefresh(result: RefreshResult): void {
  const title = result.job.title;
  const fields = refreshedFields(result.changed);
  if (fields.length === 0) toast.success(tr('ui.job.refreshedNothing', { title }));
  else toast.success(tr('ui.job.refreshed', { title, fields: fields.join(', ') }));
}
