import { ValidationError } from './errors';

export interface LabelInput {
  company: string;
  title: string;
  attempt: number;
  /** ISO date or date-time; only year and month are used. */
  date: string;
}

export function buildLabel(input: LabelInput): string {
  const company = input.company.trim();
  const title = input.title.trim();
  if (!company) throw new ValidationError('label_company_required', 'A label needs a company name');
  if (!title) throw new ValidationError('label_title_required', 'A label needs a job title');
  if (!Number.isInteger(input.attempt) || input.attempt < 1) {
    throw new ValidationError('label_attempt_invalid', `Attempt must be an integer >= 1, got ${input.attempt}`, {
      attempt: input.attempt,
    });
  }
  const match = /^(\d{4})-(\d{2})/.exec(input.date);
  const year = match?.[1];
  const month = match?.[2];
  if (!year || !month || Number(month) < 1 || Number(month) > 12) {
    throw new ValidationError('label_date_invalid', `Date must start with a valid YYYY-MM, got "${input.date}"`, {
      date: input.date,
    });
  }
  return `${company} – ${title} – #${input.attempt} (${year}-${month})`;
}
