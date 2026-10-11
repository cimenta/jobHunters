import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(svelte|ts)$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

it('never renders raw HTML', () => {
  const root = __dirname;
  const offenders = sources(root).filter((file) => readFileSync(file, 'utf8').includes('{@html'));
  expect(offenders).toEqual([]);
});
