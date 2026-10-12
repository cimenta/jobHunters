// Bundles packages/gas into dist/ for `clasp push` (rootDir "dist" in .clasp.json).
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { appendFileSync, copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const OUT = 'dist';
// Apps Script only calls top-level functions, so each export of main.ts gets a global stub.
const EXPORTS = ['api', 'setup', 'doGet', 'smokeTest', 'onHourlyTick'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// The UI is built first: Apps Script serves it from the single file ui.html.
const vitePackage = createRequire(import.meta.url).resolve('vite/package.json', { paths: ['packages/ui'] });
const viteBin = join(dirname(vitePackage), 'bin', 'vite.js');
// A production build whatever the caller's environment is (a test run sets NODE_ENV=test and VITEST, which would produce a development bundle).
const uiEnv = { ...process.env, NODE_ENV: 'production' };
for (const key of Object.keys(uiEnv)) if (key.startsWith('VITEST')) delete uiEnv[key];
execFileSync(process.execPath, [viteBin, 'build'], { cwd: 'packages/ui', stdio: 'pipe', env: uiEnv });
copyFileSync('packages/ui/dist/index.html', `${OUT}/ui.html`);

await build({
  entryPoints: ['packages/gas/src/main.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'JobHunters',
  // The Apps Script parser rejects class fields and newer syntax, so esbuild lowers them.
  target: 'es2019',
  outfile: `${OUT}/Code.js`,
  legalComments: 'none',
  logLevel: 'warning',
});

appendFileSync(
  `${OUT}/Code.js`,
  EXPORTS.map((name) => `\nfunction ${name}(...args) {\n  return JobHunters.${name}(...args);\n}\n`).join(''),
);
copyFileSync('packages/gas/src/Version.gs', `${OUT}/Version.gs`);
copyFileSync('packages/gas/appsscript.json', `${OUT}/appsscript.json`);
console.log(`Built ${OUT}/ (${EXPORTS.join(', ')}, ui.html)`);
