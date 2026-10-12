import type { AvailabilityCheck } from '../api/types';
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
