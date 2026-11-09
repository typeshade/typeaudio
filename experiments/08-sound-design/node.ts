// Experiment 8 on the CPU tier, in Node: `run.ts` bundles this file and runs it with Node. It runs
// the harness, then the analysis that needs the stems: the one-layer render and the layered render
// scored on the eight dimensions of the checklist, and the WAV files of the stems and the mix. It
// prints the result as JSON on stdout, and a line for each stage on stderr.

import { mkdir, writeFile } from 'node:fs/promises';
import { cpus, platform, release } from 'node:os';
import { join } from 'node:path';
import { createDevice } from 'typeshade/runtime';
import {
  checklist,
  DEFAULT_RULES,
  DIMENSIONS,
  type ChecklistReport,
} from '../../src/analyze/index.ts';
import { LAYERS, validatePlan } from '../../src/plan/index.ts';
import { onePlan, renderPlan, SAMPLE_RATE, type Rendered } from '../../src/render-plan.ts';
import plan from './plan.json';
import { runTier, type Options } from './harness.ts';
import { stemsOf } from './stems.ts';
import { wavBytes } from './wav.ts';

const options = JSON.parse(process.argv[2] ?? '{}') as Options & { outDir: string };
const log = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

let layered: Rendered | undefined;
const result = await runTier({ ...options, tier: 'cpu' }, log, (r) => {
  layered = r;
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
  // The one-layer render: the same moments, one `impact` on `effects` at each, no spatial chain,
  // no guards. Its master is the raw sum.
  const dev = await createDevice({ prefer: ['cpu'] });
  const flat = onePlan(sound);
  const one = await renderPlan(dev, flat, { spatial: false, guards: false });
  await dev.dispose();
  log(`cpu one-layer render: ${flat.events.length} events`);

  const t0 = performance.now();
  const reports: Record<string, ChecklistReport> = {
    oneLayer: checklist({
      channels: one.mix,
      sampleRate: sr,
      plan: flat,
      stems: one.stems,
      dry: one.dry,
    }),
    layered: checklist({
      channels: layered.mix,
      sampleRate: sr,
      plan: sound,
      stems: layered.stems,
      dry: layered.dry,
    }),
  };
  log(`cpu checklists: ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  out['events'] = { oneLayer: flat.events.length, layered: sound.events.length };
  out['checklist'] = reports;
  out['oneLayerMaster'] = one.master;

  // Which rules the one-layer render fails and the layered render meets, and the rest.
  const verdicts: {
    dimension: string;
    measure: string;
    oneLayer: boolean | null;
    layered: boolean | null;
  }[] = [];
  for (const d of DIMENSIONS)
    for (const rule of reports['layered']![d].rules) {
      const other = reports['oneLayer']![d].rules.find((r) => r.measure === rule.measure);
      verdicts.push({
        dimension: d,
        measure: rule.measure,
        oneLayer: other?.met ?? null,
        layered: rule.met,
      });
    }
  out['verdicts'] = verdicts;

  // The files: each layer's stem, the mix, the reverb's return and the one-layer mix.
  await mkdir(options.outDir, { recursive: true });
  const files: string[] = [];
  const write = async (name: string, channels: Float32Array[]): Promise<void> => {
    await writeFile(join(options.outDir, name), wavBytes(channels, sr));
    files.push(name);
  };
  for (const l of LAYERS) await write(`stem-${l}.wav`, layered.stems[l]);
  await write('wet.wav', layered.wet);
  await write('mix.wav', layered.mix);
  await write('mix-one-layer.wav', one.mix);
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
