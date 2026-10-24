import type { ApplicationFactory, CreateApplicationResult } from './applications/application-factory';
import { companyKey } from './jobs/job-service';
import type { Repository } from './repository';
import type { Application, Company, Job } from './types';

/** The name of the company and the base title of the jobs made by the test data buttons in Settings. */
export const TEST_NAME = 'test';

export interface TestDataDeps {
  jobs: Repository<Job>;
  companies: Repository<Company>;
  factory: ApplicationFactory;
  newId: () => string;
  /** ISO 8601 date-time. */
  now: () => string;
}

export interface TestJobResult {
  job: Job;
  company: Company;
}

export interface TestApplicationResult extends TestJobResult {
  application: Application;
  /** Warnings of the application factory (e.g. a missing template), shown to the user. */
  warnings: CreateApplicationResult['warnings'];
}

/** Makes a job (and an application) that is clearly fake, so the user can try the app without touching real data. */
export class TestDataService {
  constructor(private readonly deps: TestDataDeps) {}

  /** The company "test" (reused) with a new job "test", "test 2", "test 3"...; the job has no link and the status New. */
  createJob(): TestJobResult {
    const { jobs, companies, newId, now } = this.deps;
    const key = companyKey(TEST_NAME);
    const company = companies.list().find((existing) => companyKey(existing.name) === key)
      ?? companies.insert({ id: newId(), name: TEST_NAME, website: '', notes: '' });

    const taken = new Set(jobs.list().filter((job) => job.company_id === company.id).map((job) => job.title));
    let title = TEST_NAME;
    for (let number = 2; taken.has(title); number += 1) title = `${TEST_NAME} ${number}`;

    const job = jobs.insert({
      id: newId(), company_id: company.id, title, url: '', source: '', parser_id: '', parsed_at: '', contact_id: '', found_at: now(),
      is_gig: false, location: '', salary_min: null, salary_max: null, salary_currency: '', salary_period: '', employment_type: '',
      remote: '', is_remote: false, is_hybrid: false, posted_at: '', valid_until: '', description: '', language: '',
      availability: 'unknown', availability_reason: '', offline_strikes: 0, last_checked_at: '', flags: '', folder_url: '', notes: '',
      status: 'new', match_percent: null, ai_salary: '', contact_person: '', no_reason: '', gig_shift: '', match_note: '', gig_priority: false,
    });
    return { job, company };
  }

  /** The same, plus a real application made by the normal factory (Drive folder, documents from the templates). */
  createJobWithApplication(): TestApplicationResult {
    const created = this.createJob();
    const result = this.deps.factory.create({ jobId: created.job.id });
    // The factory moved the job to Applied: return it as stored.
    const job = this.deps.jobs.get(created.job.id) ?? created.job;
    return { job, company: created.company, application: result.application, warnings: result.warnings };
  }
}
