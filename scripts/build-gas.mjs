// Bundles packages/gas into dist/ for `clasp push` (rootDir "dist" in .clasp.json).
import { build } from 'esbuild';
import { appendFileSync, copyFileSync, mkdirSync, rmSync } from 'node:fs';

const OUT = 'dist';
// Apps Script only calls top-level functions, so each export of main.ts gets a global stub.
const EXPORTS = ['api', 'setup', 'doGet'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

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
console.log(`Built ${OUT}/ (${EXPORTS.join(', ')})`);
