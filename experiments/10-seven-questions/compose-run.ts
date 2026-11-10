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
import { compose, type Composition } from './compose.ts';
import { nodeSource } from './store.ts';
import { SAMPLE_RATE } from './definitions.ts';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name: string): string | undefined => {
  const at = process.argv.indexOf(`--${name}`);
  return at < 0 ? undefined : process.argv[at + 1];
};
type Variant = {
  /** The effect nodes it keeps; all when it names none. */
  readonly effects?: readonly string[];
  readonly part?: 'dry' | 'mix';
  /** Store entries it takes in place of others, by name. */
  readonly use?: Readonly<Record<string, string>>;
  /** The sounds it leaves out, by id. */
  readonly drop?: readonly string[];
};
type File = Composition & { readonly variants: Record<string, Variant> };
const c = JSON.parse(await readFile(join(here, arg('module') ?? 'module-2.json'), 'utf8')) as File;
const out = arg('out') ?? join(here, 'out');
await mkdir(out, { recursive: true });
for (const [name, variant] of Object.entries(c.variants)) {
  // A variant keeps the effect nodes it names, in the order of the sound, and the part it names.
  const sounds = c.sounds
    .filter((s) => !variant.drop?.includes(s.id))
    .map((s) => ({
      ...s,
      from: {
        ...s.from,
        store: variant.use?.[s.from.store] ?? s.from.store,
        part: variant.part ?? s.from.part,
      },
      effects: variant.effects
        ? s.effects.filter((e) => variant.effects!.includes(Object.keys(e)[0]!))
        : s.effects,
    }));
  const [l, r] = await compose({ ...c, sounds }, nodeSource);
  await writeFile(join(out, `${c.module}-${name}.wav`), wavBytes([l, r], SAMPLE_RATE));
  console.log(`${c.module}-${name}: ${(l.length / SAMPLE_RATE).toFixed(2)} s`);
}
