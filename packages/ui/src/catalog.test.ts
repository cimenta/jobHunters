import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOGS } from '@jobhunters/core';
import { expect, it } from 'vitest';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(svelte|ts)$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

it('has a text in every language for each literal tr() key', () => {
  const root = __dirname;
  const missing: string[] = [];
  for (const file of sources(root)) {
    for (const match of readFileSync(file, 'utf8').matchAll(/\btr\(\s*['"]([\w.]+)['"]/g)) {
      const key = match[1]!;
      for (const locale of ['en', 'cs'] as const) {
        if (!(key in CATALOGS[locale])) missing.push(`${locale}:${key} (${file.slice(root.length)})`);
      }
    }
  }
  expect(missing).toEqual([]);
});
