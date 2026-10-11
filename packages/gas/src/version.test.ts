import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const versionText = readFileSync(fileURLToPath(new URL('./Version.gs', import.meta.url)), 'utf8');
const changelogText = readFileSync(fileURLToPath(new URL('../../../CHANGELOG.md', import.meta.url)), 'utf8');

const VERSION_LINE = /^const APP_VERSION = '(\d+\.\d+\.\d+)';\r?$/m;

describe('Version.gs', () => {
  it('has exactly one line starting with "const APP_VERSION"', () => {
    const lines = versionText.split(/\r?\n/).filter((line) => line.startsWith('const APP_VERSION'));
    expect(lines).toHaveLength(1);
  });

  it('declares a SemVer version in the exact format the publish script parses', () => {
    expect(versionText).toMatch(VERSION_LINE);
  });

  it('has a matching section in CHANGELOG.md for release notes', () => {
    const version = VERSION_LINE.exec(versionText)?.[1];
    expect(version).toBeDefined();
    expect(changelogText).toMatch(new RegExp(`^## \\[${version!.replace(/\./g, '\\.')}\\]`, 'm'));
  });
});
