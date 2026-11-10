// Experiment 9, the measures of a render against the study's render (docs/experiments.md, section 9,
// method step 5).
//
//   bun experiments/09-force-passage/measure.ts [--tier webgpu] [--out <directory>]
//
// It reads `out/mix-<tier>.f32` and `out/result-<tier>.json`, which `run.ts` wrote, and `study.json`,
// the numbers of the study's round 11. It prints, for each phase of the passage, the level and five
// bands of the engine's mix beside the study's; the level each two frames while she flies; the level
// inside the silence; where each anchored event was placed against its picture time; and the
// integrated loudness and the true peak. It writes the same as `out/measure-<tier>.json`.

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { integratedLoudness, truePeak } from '../../src/analyze/index.ts';
import study from './study.json';

const ROOT = join(import.meta.dirname, '../..');
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i]!;
  const value = process.argv[i + 1];
  if (!key.startsWith('--') || value === undefined)
    throw new Error(`measure.ts: "${key}" is not an option with a value.`);
  args.set(key.slice(2), value);
}
const tier = args.get('tier') ?? 'webgpu';
const outDir = args.get('out') ?? join(ROOT, 'experiments/09-force-passage/out');

const raw = await readFile(join(outDir, `mix-${tier}.f32`));
const both = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
const frames = both.length / 2;
const left = both.subarray(0, frames);
const right = both.subarray(frames);
const result = JSON.parse(await readFile(join(outDir, `result-${tier}.json`), 'utf8')) as {
  commit: string;
  sampleRate: number;
  placed: { id: string; start: number; end: number }[];
};
const sr = result.sampleRate;
const mono = Float64Array.from(left, (v, i) => 0.5 * (v + right[i]!));

/** A second-order section of the RBJ cookbook: a highpass or a lowpass at `hz` with quality `q`. */
function section(kind: 'high' | 'low', hz: number, q: number): (x: Float64Array) => Float64Array {
  const w = (2 * Math.PI * hz) / sr;
  const alpha = Math.sin(w) / (2 * q);
  const cos = Math.cos(w);
  const a0 = 1 + alpha;
  const b1 = (kind === 'high' ? -(1 + cos) : 1 - cos) / a0;
  const b0 = (kind === 'high' ? (1 + cos) / 2 : (1 - cos) / 2) / a0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  return (x) => {
    const y = new Float64Array(x.length);
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = b0 * x[i]! + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x[i]!;
      y2 = y1;
      y1 = v;
      y[i] = v;
    }
    return y;
  };
}
/** A band from `lo` to `hi` hertz: a fourth-order Butterworth highpass and a fourth-order lowpass. */
function band(x: Float64Array, lo: number, hi: number): Float64Array {
  let y = x;
  for (const q of [0.5412, 1.3066]) y = section('high', lo, q)(y);
  for (const q of [0.5412, 1.3066]) y = section('low', hi, q)(y);
  return y;
}
const at = (picture: number): number => Math.round((picture - study.pictureStart) * sr);
const db = (x: ArrayLike<number>, from: number, to: number): number => {
  let sum = 0;
  for (let i = from; i < to; i++) sum += x[i]! * x[i]!;
  return 10 * Math.log10(sum / Math.max(1, to - from) + 1e-12);
};
/** The level of the stereo mix: the mean of the two channels' powers. */
const level = (from: number, to: number): number =>
  10 * Math.log10((10 ** (db(left, from, to) / 10) + 10 ** (db(right, from, to) / 10)) / 2 + 1e-12);

const banded = study.bandsHz.map(([lo, hi]) => band(mono, lo!, hi!));
const round = (v: number): number => Math.round(v * 10) / 10;
const phases = study.phases.map((p) => ({
  name: p.name,
  engine: {
    level: round(level(at(p.from), at(p.to))),
    bands: banded.map((b) => round(db(b, at(p.from), at(p.to)))),
  },
  study: { level: p.level, bands: p.bands },
}));
const twoFrames = 2002 / 24000;
const flight = study.flightEachTwoFrames.levels.map((_, i) => {
  const from = study.flightEachTwoFrames.from + i * twoFrames;
  return round(level(at(from), at(from + twoFrames)));
});
const silence = round(level(at(study.silence.from), at(study.silence.to)));
const anchors = study.anchors.map((a) => {
  const placed = result.placed.find((p) => p.id === a.id);
  return {
    id: a.id,
    picture: a.picture,
    ms:
      placed === undefined
        ? null
        : round((placed.start / sr - (a.picture - study.pictureStart)) * 1000 * 100) / 100,
  };
});
const out = {
  tier,
  commit: result.commit,
  integratedLufs: round(integratedLoudness([left, right], sr)),
  truePeakDbtp: round(truePeak([left, right])),
  phases,
  flightEachTwoFrames: { engine: flight, study: study.flightEachTwoFrames.levels },
  silence: { engine: silence, study: study.silence.level },
  anchors,
};
await writeFile(join(outDir, `measure-${tier}.json`), `${JSON.stringify(out, null, 2)}\n`);

const cell = (v: number): string => v.toFixed(1).padStart(6);
console.log(
  `\n${tier}, commit ${result.commit.slice(0, 7)}: level and bands in dBFS, the engine's mix and the study's round 11\n`,
);
console.log(
  '| Phase | Render | Level | 30-120 Hz | 120-500 Hz | 500-2k Hz | 2k-6k Hz | 6k-14k Hz |',
);
console.log('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const p of phases)
  for (const [name, r] of [
    ['engine', p.engine],
    ['study', p.study],
  ] as const)
    console.log(
      `| ${name === 'engine' ? p.name : ''} | ${name} | ${cell(r.level)} | ${r.bands.map(cell).join(' | ')} |`,
    );
console.log(
  `\nthe flight each two frames from ${study.flightEachTwoFrames.from} s: engine ${flight.join(', ')}; study ${study.flightEachTwoFrames.levels.join(', ')}`,
);
console.log(
  `the silence from ${study.silence.from} to ${study.silence.to} s: engine ${silence} dBFS; study ${study.silence.level} dBFS`,
);
console.log(
  `placed against the picture: ${anchors.map((a) => `${a.id} ${a.ms === null ? 'not placed' : `${a.ms >= 0 ? '+' : ''}${a.ms} ms`}`).join(', ')}`,
);
console.log(
  `integrated loudness ${out.integratedLufs} LUFS (study ${study.integratedLufs}); true peak ${out.truePeakDbtp} dBTP`,
);
console.log(`wrote measure-${tier}.json into ${outDir}`);
