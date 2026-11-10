// Renders a composition of the store (module-2.json) to WAV files, one for each variant.
//
//   bun experiments/10-seven-questions/compose-run.ts [--module module-2.json] [--out dir]
//
// A variant with `front: false` leaves out every `front` node: it is prototype 3b of experiment 9.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wavBytes } from '../08-sound-design/wav.ts';
import { compose, type Composition } from './compose.ts';
import { SAMPLE_RATE } from './definitions.ts';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name: string): string | undefined => {
  const at = process.argv.indexOf(`--${name}`);
  return at < 0 ? undefined : process.argv[at + 1];
};
type File = Composition & { readonly variants: Record<string, { readonly front: boolean }> };
const c = JSON.parse(await readFile(join(here, arg('module') ?? 'module-2.json'), 'utf8')) as File;
const out = arg('out') ?? join(here, 'out');
await mkdir(out, { recursive: true });
for (const [name, variant] of Object.entries(c.variants)) {
  const sounds = c.sounds.map((s) => ({
    ...s,
    effects: s.effects.filter((e) => variant.front || !('front' in e)),
  }));
  const [l, r] = await compose({ ...c, sounds });
  await writeFile(join(out, `${c.module}-${name}.wav`), wavBytes([l, r], SAMPLE_RATE));
  console.log(`${c.module}-${name}: ${(l.length / SAMPLE_RATE).toFixed(2)} s`);
}
