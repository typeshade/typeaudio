// Writes the site's project of the force passage (`to-web.ts`) and prints its SHA-256.
//
//   bun experiments/10-seven-questions/to-web-run.ts [--out file] [--revision commit]
//
// The kinds are TypeShade modules, so `to-web.ts` is bundled for Node with the compiler's plugin
// first (`scripts/bundle.ts`). The revision defaults to the commit of HEAD; a tree with changes is refused, so the project
// names the commit it was made at.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { bundle } from '../../scripts/bundle.ts';
import type { forcePassageProject as Make } from './to-web.ts';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name: string): string | undefined => {
  const at = process.argv.indexOf(`--${name}`);
  return at < 0 ? undefined : process.argv[at + 1];
};
const git = (...a: string[]): string => execFileSync('git', a, { encoding: 'utf8' }).trim();
let revision = arg('revision');
if (revision === undefined) {
  if (git('status', '--porcelain', '--untracked-files=no') !== '')
    throw new Error('to-web: commit the changes first, or pass --revision.');
  revision = git('rev-parse', 'HEAD');
}
const out = arg('out') ?? join(here, 'out', 'web', 'unseen-force-wall-hit.json');
const main = await bundle({
  entry: 'experiments/10-seven-questions/to-web.ts',
  outDir: 'experiments/10-seven-questions/out/to-web',
  target: 'node',
});
const { forcePassageProject } = (await import(pathToFileURL(main).href)) as {
  forcePassageProject: typeof Make;
};
const { project, report } = forcePassageProject(revision);
const text = `${JSON.stringify(project, null, 2)}\n`;
await mkdir(dirname(out), { recursive: true });
await writeFile(out, text);
const sha256 = createHash('sha256').update(text).digest('hex');
console.log(JSON.stringify({ out, revision, bytes: Buffer.byteLength(text), sha256, ...report }, null, 2));
