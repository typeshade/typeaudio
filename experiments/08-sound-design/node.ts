// Experiment 8 on the CPU tier, in Node: `run.ts` bundles this file and runs it with Node. It runs
// the harness, which scores the one-layer render and the layered render on the eight dimensions of
// the checklist (`score.ts`), and writes the WAV files of the stems and the mix. It prints the result
// as JSON on stdout, and a line for each stage on stderr.

import { mkdir, writeFile } from 'node:fs/promises';
import { cpus, platform, release } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_RULES } from '../../src/analyze/index.ts';
import { LAYERS, validatePlan } from '../../src/plan/index.ts';
import { SAMPLE_RATE, type Rendered } from '../../src/render-plan.ts';
import plan from './plan.json';
import { runTier, type Options } from './harness.ts';
import { stemsOf } from './stems.ts';
import { wavBytes } from './wav.ts';

const options = JSON.parse(process.argv[2] ?? '{}') as Options & { outDir: string };
const log = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

let layered: Rendered | undefined;
let one: Rendered | undefined;
const result = await runTier({ ...options, tier: 'cpu' }, log, (r, o) => {
  layered = r;
  one = o;
});
const cpu = cpus();
const out: Record<string, unknown> = {
  environment: {
    node: process.version,
    cpu: cpu[0]?.model ?? 'unknown',
    cores: cpu.length,
    os: `${platform()} ${release()}`,
  },
  ...result,
  rules: DEFAULT_RULES,
};

if (layered !== undefined) {
  const sound = validatePlan(plan);
  const sr = SAMPLE_RATE;
  // The files: each layer's stem, the mix, the reverb's return and, on the whole clip, the one-layer mix.
  await mkdir(options.outDir, { recursive: true });
  const files: string[] = [];
  const write = async (name: string, channels: Float32Array[]): Promise<void> => {
    await writeFile(join(options.outDir, name), wavBytes(channels, sr));
    files.push(name);
  };
  for (const l of LAYERS) await write(`stem-${l}.wav`, layered.stems[l]);
  await write('wet.wav', layered.wet);
  await write('mix.wav', layered.mix);
  if (one !== undefined) await write('mix-one-layer.wav', one.mix);
  // The mix as raw f32 (left, then right) for the runner's comparison across tiers.
  await writeFile(
    join(options.outDir, 'cpu.mix.f32'),
    new Uint8Array(Float32Array.from([...layered.mix[0], ...layered.mix[1]]).buffer),
  );
  files.push('cpu.mix.f32');
  out['files'] = files;
  out['stems'] = Object.keys(stemsOf(sound, sr));
}
process.stdout.write(JSON.stringify(out));
