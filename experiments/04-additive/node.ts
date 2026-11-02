// Experiment 4 on the CPU tier, in Node: `run.ts` bundles this file and runs it with Node, with the
// options, the directory of the reference and `cpu` or `none`. With `cpu` it runs the harness on the
// CPU tier first. Then it runs the plain-JavaScript reference over the same blocks in the same
// process, so that both call one `Math.sin`, holds the CPU tier to it bit for bit, and writes the
// reference's blocks and bank to the directory, for the runner to hold the GPU tiers to. It prints
// the result as JSON on stdout, and its progress on stderr.

import { writeFile } from 'node:fs/promises';
import { cpus, platform, release } from 'node:os';
import { join } from 'node:path';
import { clockStep } from '../01-round-trip/clock.ts';
import { compare } from './compare.ts';
import { measure, sumCheck, tierProbe, type Result, type SumCheck } from './harness.ts';
import { designOf, refRender, refState, refSums, type Design, type RefPartial } from './reference.ts';
import { lanesInput, SR, spec, sweepAt, type Options } from './options.ts';

const options = JSON.parse(process.argv[2] ?? '{}') as Options;
const dir = process.argv[3]!;
const withCpu = process.argv[4] === 'cpu';
const total = options.warmup + options.blocks;
const every = Math.max(1, Math.round(total / 10));

let result: Result | undefined;
if (withCpu) {
  result = await measure({ ...options, tier: 'cpu' }, (variant, b, ms) => {
    if (b % every === 0 || b === total - 1) process.stderr.write(`cpu ${variant} block ${b}: ${ms.toFixed(1)} ms\n`);
  });
}

let sums: SumCheck | undefined;
let tiers: Record<string, string> | undefined;
if (withCpu && options.sums) {
  sums = await sumCheck({ tier: 'cpu', partials: options.partials, frames: options.frames });
  tiers = await tierProbe({ tier: 'cpu' });
}

const started = performance.now();
const { out: ref, partials } = refRender(spec(options.partials), SR, options.frames, total, sweepAt, options.variants, (b) => {
  if (b % every === 0 || b === total - 1) process.stderr.write(`reference block ${b}\n`);
});
const referenceMs = performance.now() - started;
const states: Partial<Record<Design, Float32Array>> = {};
for (const [design, refs] of Object.entries(partials) as [Design, RefPartial[]][]) {
  states[design] = new Float32Array(refs.flatMap(refState));
  await writeFile(join(dir, `reference-state-${design}.f32`), new Uint8Array(states[design].buffer));
}
for (const variant of options.variants) {
  await writeFile(join(dir, `reference-${variant}.f32`), new Uint8Array(ref[variant].buffer));
}

const variants: Record<string, unknown> = {};
if (result !== undefined) {
  for (const variant of options.variants) {
    const r = result.results[variant];
    if (r === undefined) {
      variants[variant] = { error: result.errors[variant] };
      continue;
    }
    const peaks = r.peaks.map((p, b) => {
      let m = 0;
      for (let n = 0; n < options.frames; n++) m = Math.max(m, Math.abs(ref[variant][b * options.frames + n]!));
      return p === m;
    });
    // The tier's blocks and bank beside the reference's, as the runner writes a page tier's.
    await writeFile(join(dir, `cpu-${variant}.f32`), new Uint8Array(r.out.buffer));
    await writeFile(join(dir, `cpu-${variant}-state.f32`), new Uint8Array(r.state.buffer));
    variants[variant] = {
      row: r.row,
      report: r.report,
      out: compare(r.out, ref[variant]),
      state: compare(r.state, states[designOf(variant)]!),
      peaksSame: peaks.filter(Boolean).length,
    };
  }
}
let sumsHeld: unknown;
if (sums !== undefined) {
  const want = refSums(lanesInput(options.partials, options.frames), options.partials, options.frames);
  sumsHeld = {
    gather: compare(sums.gather, want.gather),
    tree: compare(sums.tree, want.tree),
    scatter: compare(sums.scatter, want.tree),
    reports: sums.reports,
  };
}
const cpu = cpus();
process.stdout.write(
  JSON.stringify({
    environment: {
      node: process.version,
      cpu: cpu[0]?.model ?? 'unknown',
      cores: cpu.length,
      os: `${platform()} ${release()}`,
      clockStepMs: clockStep(),
    },
    ...(result === undefined ? {} : { info: result.info, skipped: result.skipped }),
    referenceMs,
    variants,
    ...(sumsHeld === undefined ? {} : { sums: sumsHeld }),
    ...(tiers === undefined ? {} : { tiers }),
  }),
);
