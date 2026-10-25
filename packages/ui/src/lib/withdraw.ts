import { canTransition, INACTIVE_APPLICATION_STATUSES, isApplicationStatus, type StatusTransitions } from '@jobhunters/core';
import { api } from '../api';
import type { ApplicationRow } from '../api/types';

/** The applications that are still open and that the rules of Settings allow to move to Withdrawn. */
export function withdrawable(applications: readonly ApplicationRow[], transitions: StatusTransitions): ApplicationRow[] {
  return applications.filter(
    (application) => isApplicationStatus(application.status) && !INACTIVE_APPLICATION_STATUSES.includes(application.status) && canTransition(application.status, 'withdrawn', transitions),
  );
}

/** Moves the applications to Withdrawn one by one; returns the ones that could not be moved. */
export async function withdrawApplications(applications: readonly ApplicationRow[]): Promise<ApplicationRow[]> {
  const failed: ApplicationRow[] = [];
  for (const application of applications) {
    try {
      await api.setApplicationStatus(application.id, 'withdrawn');
    } catch {
      failed.push(application);
    }
  }
  return failed;
}
