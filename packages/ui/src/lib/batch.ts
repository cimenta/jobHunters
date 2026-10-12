export const MAX_LINKS = 30;

export interface SkippedLine {
  line: string;
  reason: 'invalid' | 'duplicate';
}

export interface ParsedLinks {
  links: string[];
  skipped: SkippedLine[];
  tooMany: boolean;
}

const LINK = /^https?:\/\/\S+$/i;

/** One link per line: trims, drops empty lines, flags non-links and repeats, keeps at most 30 links in order. */
export function parseLinks(text: string): ParsedLinks {
  const links: string[] = [];
  const skipped: SkippedLine[] = [];
  const seen = new Set<string>();
  let tooMany = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '') continue;
    if (!LINK.test(line)) {
      skipped.push({ line, reason: 'invalid' });
      continue;
    }
    const key = line.toLowerCase();
    if (seen.has(key)) {
      skipped.push({ line, reason: 'duplicate' });
      continue;
    }
    if (links.length >= MAX_LINKS) {
      tooMany = true;
      continue;
    }
    seen.add(key);
    links.push(line);
  }
  return { links, skipped, tooMany };
}
