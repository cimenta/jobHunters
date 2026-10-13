import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { beforeAll, describe, expect, it } from 'vitest';

const appRoot = fileURLToPath(new URL('../../../', import.meta.url));
const dist = (file: string) => `${appRoot}dist/${file}`;

beforeAll(() => {
  execFileSync(process.execPath, ['scripts/build-gas.mjs'], { cwd: appRoot, stdio: 'pipe' });
}, 180_000);

describe('build', () => {
  it('writes the files clasp pushes', () => {
    for (const file of ['Code.js', 'appsscript.json', 'Version.gs']) expect(existsSync(dist(file)), file).toBe(true);
  });

  it('exposes top-level functions Apps Script can call', () => {
    const code = readFileSync(dist('Code.js'), 'utf8');
    const stubs = [...code.matchAll(/^function (\w+)\(/gm)].map((m) => m[1]);
    // The Apps Script editor lists the functions in this order and preselects the first: setup.
    expect(stubs).toEqual(['setup', 'api', 'apiJson', 'doGet', 'smokeTest', 'testSetupColumns', 'testSetupStatus', 'testFormulaText', 'testSetupMark', 'testStartupTiming', 'onHourlyTick']);
  });

  it('ships the UI as one self-contained page', () => {
    const page = readFileSync(dist('ui.html'), 'utf8');
    expect(page).toContain('<div id="app">');
    expect(page.length).toBeGreaterThan(20_000);
    // Everything is inlined: no external script, stylesheet, font or image requests.
    expect(page).not.toMatch(/<script[^>]+\ssrc=/i);
    expect(page).not.toMatch(/<link[^>]+rel=["']stylesheet/i);
    expect(page).not.toMatch(/https?:\/\/(?!www\.w3\.org|svelte\.dev|example\.|docs\.google\.com|drive\.google\.com)[^"'\s)]*\.(js|css|woff2?|png|jpg)/i);
  });

  it('keeps the development backend and test helpers out of the UI page', () => {
    const page = readFileSync(dist('ui.html'), 'utf8');
    // String literals survive minification (function and class names do not).
    for (const banned of ['example.com/jobs/demo-engineer', 'Eva Example', 'seed-overdue', 'blocked.example']) {
      expect(page, banned).not.toContain(banned);
    }
  });

  it('serves the page from doGet', () => {
    const code = readFileSync(dist('Code.js'), 'utf8');
    const calls: string[] = [];
    const output = {
      setTitle(title: string) {
        calls.push(`title:${title}`);
        return output;
      },
      addMetaTag(name: string) {
        calls.push(`meta:${name}`);
        return output;
      },
    };
    const sandbox = {
      APP_VERSION: '0.0.0',
      HtmlService: {
        createHtmlOutputFromFile(name: string) {
          calls.push(`file:${name}`);
          return output;
        },
      },
    };
    vm.runInNewContext(`${code}\n;doGet()`, sandbox);
    expect(calls).toEqual(['file:ui', 'title:JobHunters', 'meta:viewport']);
  });

  it('keeps the web app private and on V8', () => {
    const manifest = JSON.parse(readFileSync(dist('appsscript.json'), 'utf8'));
    expect(manifest.runtimeVersion).toBe('V8');
    expect(manifest.webapp).toEqual({ executeAs: 'USER_DEPLOYING', access: 'MYSELF' });
  });

  it('does not ship test helpers or runtime features Apps Script may lack', () => {
    const code = readFileSync(dist('Code.js'), 'utf8');
    for (const banned of ['FakeGrid', 'FakeDrive', 'structuredClone', 'Object.hasOwn(', 'Intl.', '.replaceAll(']) {
      expect(code, banned).not.toContain(banned);
    }
  });

  it('contains no class field declarations, which the Apps Script parser rejects', () => {
    const code = readFileSync(dist('Code.js'), 'utf8');
    expect(code).not.toMatch(/^\s+(static\s+)?#?(?!continue\b|break\b|return\b|debugger\b)\w+;\s*$/m);
  });

  it('runs: api() answers with setup_required when setup has not been run', () => {
    const code = readFileSync(dist('Code.js'), 'utf8');
    const sandbox = { PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) }, APP_VERSION: '0.0.0' };
    const result = vm.runInNewContext(`${code}\n;api('getAppInfo', {})`, sandbox);
    expect(result).toMatchObject({ ok: false, error: { code: 'setup_required' } });
  });
});
