// Renders a composition of the store (module-2.json) to WAV files, one for each variant.
//
//   bun experiments/10-seven-questions/compose-run.ts [--module module-2.json] [--out dir]
//
// A variant names the effect nodes it keeps. The variant `3b` keeps only `pitch`: it is prototype 3b
// of experiment 9.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wavBytes } from '../08-sound-design/wav.ts';
import { compose, withVariant, type Composition, type Variant } from './compose.ts';
import { nodeSource } from './store.ts';
import { SAMPLE_RATE } from './definitions.ts';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name: string): string | undefined => {
  const at = process.argv.indexOf(`--${name}`);
  return at < 0 ? undefined : process.argv[at + 1];
};
type File = Composition & { readonly variants: Record<string, Variant> };
const c = JSON.parse(await readFile(join(here, arg('module') ?? 'module-2.json'), 'utf8')) as File;
const out = arg('out') ?? join(here, 'out');
await mkdir(out, { recursive: true });
for (const [name, variant] of Object.entries(c.variants)) {
  const [l, r] = await compose(withVariant(c, variant), nodeSource);
  await writeFile(join(out, `${c.module}-${name}.wav`), wavBytes([l, r], SAMPLE_RATE));
  console.log(`${c.module}-${name}: ${(l.length / SAMPLE_RATE).toFixed(2)} s`);
}
