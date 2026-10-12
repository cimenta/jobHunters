import { ValidationError } from './errors';
import { parseJobStatusStyles, serializeJobStatusStyles, type JobStatusStyles } from './job-status';
import type { Repository } from './repository';
import type { SettingsService } from './settings';
import type { Job } from './types';

export interface JobStatusServiceDeps {
  jobs: Repository<Job>;
  settings: SettingsService;
}

export class JobStatusService {
  constructor(private readonly deps: JobStatusServiceDeps) {}

  /** Saves the whole set of statuses. A custom status that an ad still uses cannot be removed. */
  save(styles: unknown): JobStatusStyles {
    const parsed = parseJobStatusStyles(JSON.stringify(styles ?? null));
    if (parsed === undefined) throw new ValidationError('settings_invalid', 'Invalid job statuses', { key: 'job_status_styles', value: '' });
    for (const code of Object.keys(this.deps.settings.get().settings.job_status_styles)) {
      if (Object.prototype.hasOwnProperty.call(parsed, code)) continue;
      const count = this.deps.jobs.list().filter((job) => job.status === code).length;
      if (count > 0) throw new ValidationError('job_status_in_use', `${count} ads use the status ${code}`, { count });
    }
    return this.deps.settings.update({ job_status_styles: serializeJobStatusStyles(parsed) }).job_status_styles;
  }
}
