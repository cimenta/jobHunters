import type { Company, Job } from '../types';
import { hasOwn } from '../util';

/** Keys of the Profile sheet that templates may use. Other Profile rows are never copied into documents. */
export const PROFILE_KEYS = ['name', 'email', 'phone', 'address', 'portfolio', 'linkedin', 'github', 'website', 'links'] as const;
/** The link rows, in the order {{links}} lists them; `links` itself holds the other links. */
const LINK_KEYS = ['portfolio', 'linkedin', 'github', 'website', 'links'] as const;
export type ProfileKey = (typeof PROFILE_KEYS)[number];

export interface PlaceholderInput {
  profile: Readonly<Record<string, string>>;
  company: Company | undefined;
  job: Job;
  /** YYYY-MM-DD. */
  today: string;
}

/**
 * Values for {{name}}, {{email}}, {{phone}}, {{address}}, {{portfolio}}, {{linkedin}}, {{github}}, {{website}}, {{links}}, {{company}},
 * {{position}}, {{location}} and {{date}}. {{links}} lists every filled link, one per line, so documents of people who only
 * filled the "other links" row look as they always did.
 * {{body}} is deliberately absent: it stays in the Doc until the AI plan fills it.
 */
export function buildPlaceholders(input: PlaceholderInput): Record<string, string> {
  const values: Record<string, string> = {};
  for (const key of PROFILE_KEYS) values[key] = hasOwn(input.profile, key) ? input.profile[key]!.trim() : '';
  const combined = LINK_KEYS.map((key) => values[key]!).filter((value) => value !== '');
  values.links = combined.join('\n');
  values.company = input.company?.name ?? '';
  values.position = input.job.title;
  values.location = input.job.location;
  values.date = input.today;
  return values;
}
