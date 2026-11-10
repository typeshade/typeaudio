// Renders a module of experiment 10 to a WAV file and prints the numbers of each contact.
//
//   bun experiments/10-seven-questions/run.ts [--module module-1.json] [--size 2] [--out dir]

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wavBytes } from '../08-sound-design/wav.ts';
import { SAMPLE_RATE } from './definitions.ts';
import { renderModule, type Module } from './module.ts';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name: string): string | undefined => {
  const at = process.argv.indexOf(`--${name}`);
  return at < 0 ? undefined : process.argv[at + 1];
};

const file = join(here, arg('module') ?? 'module-1.json');
let module = JSON.parse(await readFile(file, 'utf8')) as Module;
const size = arg('size');
if (size) module = { ...module, style: { ...module.style, size: Number(size) } };
const out = arg('out') ?? join(here, 'out');
await mkdir(out, { recursive: true });

const started = performance.now();
const made = renderModule(module);
const seconds = (performance.now() - started) / 1000;
const name = `${module.module}-size-${module.style.size}`;
await writeFile(join(out, `${name}.wav`), wavBytes([made.left, made.right], SAMPLE_RATE));
await writeFile(
  join(out, `${name}.json`),
  JSON.stringify({ module, numbers: made.numbers, levels: made.levels }, null, 2),
);

console.log(`${name}: rendered in ${seconds.toFixed(1)} s`);
for (const [id, n] of Object.entries(made.numbers)) {
  console.log(
    `${id}: impulse ${n.impulse.toExponential(2)} N·s, energy ${n.energy.toExponential(2)} J, ` +
      `contact ${(n.physicalTime * 1000).toFixed(2)} ms by physics, ${(n.time * 1000).toFixed(2)} ms by the drawing, ` +
      `force ${n.force.toExponential(2)} N (${n.exaggeration.toFixed(1)} times physics), ` +
      `${n.pieces} pieces, level ${made.levels[id]!.toFixed(1)} dB`,
  );
}
