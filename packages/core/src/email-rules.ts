/**
 * The words and patterns that decide what an e-mail is. The defaults live here; the user can change every category in
 * Settings (the setting `email_rules` holds only the categories the user changed). Patterns are regular expressions
 * written as text, one per line, applied to the subject and the body folded to lower case without diacritics.
 */
export const EMAIL_RULE_CATEGORIES = [
  'portal_confirmation',
  'portal_rejection',
  'after_meeting',
  'rejection',
  'offer',
  'homework',
  'calendar',
  'meeting_words',
  'confirmation',
  'info_request',
  'noise',
  'noise_subject',
  'relay_domains',
] as const;

export type EmailRuleCategory = (typeof EMAIL_RULE_CATEGORIES)[number];

/** Every category with its lines; `relay_domains` holds plain domains, the others regular expressions. */
export type EmailRules = Record<EmailRuleCategory, string[]>;

/** What the setting stores: only the categories the user changed. An empty list is a real choice (no patterns). */
export type EmailRulesOverride = Partial<EmailRules>;

const MAX_LINES = 100;
const MAX_LINE_LENGTH = 300;

export const DEFAULT_EMAIL_RULES: Readonly<EmailRules> = {
  portal_confirmation: [
    String.raw`odeslany zajem|podarilo se nam uspesne poslat vas zajem`,
    String.raw`hlasime doruceni vasi odpovedi`,
  ],
  portal_rejection: [
    String.raw`zamitl[a]? vas zajem|tentokrat to nevyslo`,
  ],
  rejection: [
    String.raw`rozhodli( jsme| sme)?( se| sa)?[^.\n]{0,80}(pokracovat|pokrocit|uprednostnit|postoupit)[^.\n]{0,100}(jin|dalsi|ostatn|kandidat|uchazec)`,
    String.raw`rozhodli( jsme| sme)?( se| sa)?[^.\n]{0,40}(nepokracovat|neprodlouzit)`,
    String.raw`upredn?ostnit jin`,
    String.raw`rozhodli( jsme| sme)?( se| sa)?[^.\n]{0,60}(dat prednost|dat prednost|davat prednost)`,
    String.raw`vyberove (konanie|rizeni) (sme )?ukoncil`,
    String.raw`pozici (se nam )?(podarilo )?obsadit|pozicia (je )?obsaden|pozici jsme obsadili|podarilo sa (nam )?poziciu obsadit`,
    String.raw`(move|moving|proceed|proceeding|continue|go) (forward )?(on )?with (some )?(other|another|different)`,
    String.raw`(decided|chosen|selected) (to )?(not )?(to )?(move|proceed|continue|go)[^.\n]{0,60}(other|different|another)`,
    String.raw`(not|won'?t|will not) (be )?(to )?(move|moving|proceed|proceeding|continue|continuing)[^.\n]{0,25}(forward|with your application)`,
    String.raw`unfortunately[^.\n]{0,80}(not (be )?(select|chosen|successful|move)|other candidates)`,
    String.raw`regret to inform`,
    String.raw`we (have|had) decided not to`,
    String.raw`position (has been|was) filled|vacancy (has been|was) filled`,
    String.raw`decided to pursue (other|another)`,
  ],
  offer: [
    String.raw`(pleased|happy|delighted|thrilled) to (offer|extend an offer)`,
    String.raw`(job|employment) offer\b`,
    String.raw`offer (letter|of employment)`,
    String.raw`rad(i)? bychom (vam )?nabidl`,
    String.raw`nabidka (zamestnani|pracovniho pomeru)`,
    String.raw`pracovni smlouv`,
  ],
  homework: [
    String.raw`domaci (ukol|zadani)`,
    String.raw`take[- ]?home`,
    String.raw`home ?assignment`,
    String.raw`case study`,
    String.raw`coding (challenge|task|test|assignment)`,
    String.raw`(technical|technicky|odborny) (test|ukol|zadani)`,
    String.raw`(test|ukol) (task|zadani)`,
    String.raw`zadani (ukolu|testu)|zasilam (vam )?(zadani|ukol)`,
    String.raw`(please|prosim)[^.\n]{0,60}(complete|dokoncete|vyplnte|vypracujte|vypracovat)[^.\n]{0,40}(task|assignment|ukol|test)`,
  ],
  calendar: [
    String.raw`invitation from google calendar`,
    String.raw`^(updated )?invitation:`,
    String.raw`^(aktualizovana )?pozvanka:`,
    String.raw`join with google meet|meet\.google\.com`,
    String.raw`microsoft teams meeting|schuzka v microsoft teams|teams\.microsoft\.com\/(meet|l\/meetup)`,
    String.raw`appointment booked|this meeting was scheduled|calendar\.app\.google|zoom\.us\/j\/`,
    String.raw`\.ics\b`,
  ],
  meeting_words: [
    String.raw`\b(pohovor|pohovoru|pohovorem|rozhovor|rozhovoru|interview|schuzk|schuzce|schuzku)\b`,
    String.raw`\b(introduction|intro|screening|screen|precall|uvodni) (call|online call|hovor|meeting)\b`,
    String.raw`\b(call|hovor|meeting|videohovor|videocall)\b[^.\n]{0,60}(zitra|dnes|v (po|ut|st|ct|pa)|on (mon|tue|wed|thu|fri)|at \d|v \d|o \d)`,
    String.raw`(pozvanka|pozvanku|pozvani|pozvala|pozvat|invite you|invitation|schedule (a|an|your|the) )`,
    String.raw`(book|booking|rezervac|vyberte)[^.\n]{0,40}(termin|time|slot|schuzk|meeting|cas)`,
    String.raw`(availability|dostupnost)`,
    String.raw`vyhovoval by (vam )?termin|prefer (a )?(time|slot)|time (slot|window)|casove okno`,
  ],
  after_meeting: [
    String.raw`\bmeeting summary\b`,
    String.raw`\bfull summary\b`,
    String.raw`\baction items?\b`,
    String.raw`shrnuti (schuzky|hovoru|meetingu)|souhrn (schuzky|hovoru)`,
    String.raw`(otter|fireflies|fathom|bubbles|tldv|read)\.(ai|io|com)|usebubbles|notetaker`,
  ],
  confirmation: [
    String.raw`zaradili jsme vas do vyberoveho rizeni|zarazen(y|a|i) do (vyberoveho rizeni|selection)`,
    String.raw`(potvrzeni|potvrzujeme)[^.\n]{0,30}(prijeti|obdrzeni|registrace|prihlasky)`,
    String.raw`(prihlasku|zivotopis|vase materialy|vami zaslane materialy)[^.\n]{0,60}(obdrzeli|doputovaly|prijali|v poradku)`,
    String.raw`(obdrzeli|prijali) jsme (vasi|vas|vase)`,
    String.raw`(prijeti|obdrzeni) (cv|zivotopisu|prihlasky)`,
    String.raw`(we('ve| have)? (successfully )?(received|got)|has (successfully )?(been )?received|was submitted|been submitted)`,
    String.raw`thank(s| you) (you )?for (applying|your application|submitting)`,
    String.raw`(application|cv|resume)[^.\n]{0,40}(received|submitted|in safe hands|is in)`,
    String.raw`(included|part of|put) (you )?(in|of) (the|our) (selection|hiring|recruitment) (process|procedure)`,
    String.raw`selection (process|procedure)[^.\n]{0,40}(included|received)`,
    String.raw`(thank you|thanks|dekujeme)[^.\n]{0,30}(za prihlaseni|applying)`,
    String.raw`odpoved na nabidku prace|^requestor:`,
    String.raw`dejte nam[^.\n]{0,20}par dni|than?ks for your interest in (the )?(position|role|vacancy)`,
    String.raw`dekujeme[^.\n]{0,40}(za vas zajem|za zajem)[^.\n]{0,60}(pozici|nabizenou)`,
    String.raw`(zpetnou vazbu|feedback)[^.\n]{0,40}(do|within|ocekavat)`,
  ],
  info_request: [
    String.raw`(vyplneni|vyplnte|vyplnit)[^.\n]{0,60}(formular|form)`,
    String.raw`(gdpr|souhlas)[^.\n]{0,20}(formular|form)`,
    String.raw`(fill (in|out)|complete|upload|send us)[^.\n]{0,60}(form|document|portfolio|references)`,
    String.raw`(poslete|zaslete|dodejte|doplnte)[^.\n]{0,40}(dokument|zivotopis|referenc|portfolio|prilohu)`,
  ],
  noise: [
    String.raw`\b(job alert|new jobs? for you|doporucujeme|doporucene nabidky|nove nabidky|jobs? you may like)\b`,
    String.raw`\b(newsletter|weekly digest|unsubscribe from (this|these) (emails?|alerts?))\b`,
  ],
  noise_subject: [
    String.raw`\bnov(y|e|ych) nabid`,
    String.raw`\bnew jobs?\b`,
  ],
  relay_domains: [
    'jobs.cz', 'startupjobs.cz', 'teamio.com', 'recruitis.io', 'ashbyhq.com', 'workablemail.com', 'greenhouse-mail.io',
    'greenhouse.io', 'lever.co', 'hire.lever.co', 'icims.com', 'myworkday.com', 'paradox.ai', 'datacruit.com',
    'smartrecruiters.com', 'linkedin.com', 'indeed.com', 'usebubbles.com', 'gmail.com', 'seznam.cz', 'email.cz',
    'centrum.cz', 'atlas.cz', 'outlook.com', 'icloud.com', 'yahoo.com',
  ],
};

/** The first line of a pattern list that is not a valid regular expression, with its 1-based number. */
export function checkEmailPatterns(lines: readonly string[]): { line: number; message: string } | undefined {
  for (let index = 0; index < lines.length; index++) {
    const text = lines[index]!;
    if (text.length > MAX_LINE_LENGTH) return { line: index + 1, message: `longer than ${MAX_LINE_LENGTH} characters` };
    try {
      new RegExp(text, 'm');
    } catch (error) {
      return { line: index + 1, message: error instanceof Error ? error.message : 'not a valid pattern' };
    }
  }
  return undefined;
}

function isCategory(key: string): key is EmailRuleCategory {
  return (EMAIL_RULE_CATEGORIES as readonly string[]).includes(key);
}

/** Cleans the lines the user typed: trimmed, without empty lines and duplicates. */
export function cleanEmailLines(lines: readonly string[]): string[] {
  return [...new Set(lines.map((line) => line.trim()).filter((line) => line !== ''))];
}

/**
 * The setting parser. Unknown categories are dropped; a category that is not a list of text, has too many lines or holds a
 * pattern that does not compile makes the whole value invalid (undefined), so the defaults apply with a warning.
 */
export function parseEmailRules(raw: string): EmailRulesOverride | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw.trim() === '' ? '{}' : raw);
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const out: EmailRulesOverride = {};
  for (const [key, lines] of Object.entries(value)) {
    if (!isCategory(key)) continue;
    if (!Array.isArray(lines) || !lines.every((line) => typeof line === 'string') || lines.length > MAX_LINES) return undefined;
    const cleaned = cleanEmailLines(lines as string[]);
    if (key !== 'relay_domains' && checkEmailPatterns(cleaned) !== undefined) return undefined;
    out[key] = cleaned;
  }
  return out;
}

export function serializeEmailRules(override: EmailRulesOverride): string {
  return JSON.stringify(override);
}

/** The rules in force: the default of every category the user did not change. */
export function effectiveEmailRules(override: EmailRulesOverride | undefined): EmailRules {
  const out = {} as EmailRules;
  for (const category of EMAIL_RULE_CATEGORIES) out[category] = [...(override?.[category] ?? DEFAULT_EMAIL_RULES[category])];
  return out;
}

export interface CompiledEmailRules {
  patterns: Record<Exclude<EmailRuleCategory, 'relay_domains'>, RegExp[]>;
  relayDomains: string[];
}

const cache = new WeakMap<object, CompiledEmailRules>();

/** Compiles the lines once per rules object; a line that does not compile is skipped (the parser must never throw). */
export function compileEmailRules(rules: EmailRules): CompiledEmailRules {
  const known = cache.get(rules);
  if (known) return known;
  const patterns = {} as CompiledEmailRules['patterns'];
  for (const category of EMAIL_RULE_CATEGORIES) {
    if (category === 'relay_domains') continue;
    patterns[category] = rules[category].flatMap((line) => {
      try {
        return [new RegExp(line, 'm')];
      } catch {
        return [];
      }
    });
  }
  const compiled = { patterns, relayDomains: rules.relay_domains.map((domain) => domain.trim().toLowerCase()).filter((domain) => domain !== '') };
  cache.set(rules, compiled);
  return compiled;
}

let defaultCompiled: CompiledEmailRules | undefined;

export function defaultCompiledEmailRules(): CompiledEmailRules {
  defaultCompiled ??= compileEmailRules(effectiveEmailRules(undefined));
  return defaultCompiled;
}

/** Whether an address belongs to a portal, an applicant system or a free mail service (its domain says nothing about the company). */
export function isRelayAddress(address: string, relayDomains: readonly string[]): boolean {
  const domain = address.split('@')[1]?.trim().toLowerCase() ?? '';
  return domain !== '' && relayDomains.some((relay) => domain === relay || domain.endsWith(`.${relay}`));
}
