// A cleanliness check of scene 2: where high-frequency noise and distortion come from.
//
//   bun experiments/13-scene2-stone-giant/clean.ts [--out file.json]
//
// For each section: the energy above 8 and 12 kHz before and after the master (the master's own
// share of high frequencies is the difference), the limiter's gain reduction, and how hard the soft
// clip works. For each layer: its share of the mix's energy above 8 kHz, its flatness above 2 kHz and
// its crest, so the largest sources of harsh noise can be named.

import { writeFileSync } from 'node:fs';
import { rfft } from '../../src/study/fft.ts';
import { SR, iir, lin, rbj, type Stereo } from '../../src/study/dsp.ts';
import { limiter } from '../../src/study/mix.ts';
import { scene2 } from './scene2.ts';

const SECTIONS: readonly (readonly [string, number, number])[] = [
  ['face', 29.5, 33.58],
  ['floor', 33.58, 36.45],
  ['blocks', 36.45, 38.6],
  ['giant', 38.6, 40.33],
  ['fist', 40.33, 41.42],
  ['dust', 41.42, 43.21],
  ['silhouette', 43.21, 43.96],
  ['charge', 43.96, 45.7],
  ['bolt', 45.7, 47.46],
];

const m = scene2();
const n = m.n;
const at = (t: number) => Math.round((t - m.t0) * SR);

/** Energy of a mono signal above `lo` Hz and in all, over [a, b). */
function hf(x: ArrayLike<number>, a: number, b: number, lo: number): { hi: number; all: number } {
  const seg = new Float64Array(Math.max(0, b - a));
  for (let i = 0; i < seg.length; i++) seg[i] = x[a + i] ?? 0;
  const [re, im] = rfft(seg);
  let hi = 0;
  let all = 0;
  for (let k = 1; k < re.length; k++) {
    const p = re[k]! ** 2 + im[k]! ** 2;
    all += p;
    if ((k * SR) / seg.length >= lo) hi += p;
  }
  return { hi, all };
}

/** Flatness of the spectrum above 2 kHz (1 is white noise, near 0 is tonal). */
function flatness(x: ArrayLike<number>, a: number, b: number): number {
  const seg = new Float64Array(Math.max(0, b - a));
  for (let i = 0; i < seg.length; i++) seg[i] = x[a + i] ?? 0;
  const [re, im] = rfft(seg);
  let lg = 0;
  let ar = 0;
  let c = 0;
  for (let k = 1; k < re.length; k++) {
    if ((k * SR) / seg.length < 2000) continue;
    const p = re[k]! ** 2 + im[k]! ** 2 + 1e-30;
    lg += Math.log(p);
    ar += p;
    c++;
  }
  return Math.exp(lg / c) / (ar / c);
}

// the mix before the master, and each layer as mono
const pre: Stereo = [new Float64Array(n), new Float64Array(n)];
const mono = new Map<string, Float64Array>();
for (const name of m.order) {
  const l = m.layers.get(name)!;
  const x = new Float64Array(n);
  for (let c = 0; c < 2; c++)
    for (let i = 0; i < l.dry[c]!.length; i++) {
      const v = l.dry[c]![i]! + l.wet[c]![i]!;
      pre[c]![l.start + i] = pre[c]![l.start + i]! + v;
      x[l.start + i] = x[l.start + i]! + v / 2;
    }
  mono.set(name, x);
}

// the master as `Mix.render` makes it, step by step, to see each step's share
const hpd: Stereo = [
  iir(pre[0], [rbj('hp', 27.0, 0.7071)], 0.5),
  iir(pre[1], [rbj('hp', 27.0, 0.7071)], 0.5),
];
const g = lin(m.fixedMaster ? m.fixedMaster.gainDb : 0) * lin(m.driveDb);
const driven: Stereo = [hpd[0].map((v) => v * g), hpd[1].map((v) => v * g)];
const c = lin(-2.0 - 0.3);
const gain = limiter(driven, c * lin(4.0), 0.004, 0.06);
const limited: Stereo = [
  driven[0].map((v, i) => v * gain[i]!),
  driven[1].map((v, i) => v * gain[i]!),
];
const clipped: Stereo = [
  limited[0].map((v) => c * Math.tanh(v / c)),
  limited[1].map((v) => c * Math.tanh(v / c)),
];
const monoOf = (x: Stereo) => x[0].map((v, i) => (v + x[1][i]!) / 2);
const preM = monoOf(driven);
const limM = monoOf(limited);
const outM = monoOf(clipped);

const rows = SECTIONS.map(([name, a, b]) => {
  const s = at(a);
  const e = at(b);
  const p8 = hf(preM, s, e, 8000);
  const p12 = hf(preM, s, e, 12000);
  const o8 = hf(outM, s, e, 8000);
  const o12 = hf(outM, s, e, 12000);
  const l8 = hf(limM, s, e, 8000);
  let gr = 0;
  let grMax = 0;
  let under = 0;
  let soft = 0;
  let jump = 0;
  for (let i = s; i < e; i++) {
    const d = -20 * Math.log10(gain[i]!);
    gr += d;
    grMax = Math.max(grMax, d);
    if (gain[i]! < 0.99) under++;
    // the soft clip takes more than 1 dB when |x / c| > 0.9
    if (Math.max(Math.abs(limited[0][i]!), Math.abs(limited[1][i]!)) > 0.9 * c) soft++;
    if (i > s) jump = Math.max(jump, Math.abs(outM[i]! - outM[i - 1]!));
  }
  let ex = 0;
  let pk = 0;
  for (let i = s; i < e; i++) {
    ex += outM[i]! ** 2;
    pk = Math.max(pk, Math.abs(outM[i]!));
  }
  return {
    name,
    from: a,
    to: b,
    over8: 10 * Math.log10(o8.hi / o8.all),
    over12: 10 * Math.log10(o12.hi / o12.all),
    preOver8: 10 * Math.log10(p8.hi / p8.all),
    preOver12: 10 * Math.log10(p12.hi / p12.all),
    // the clip's own high frequencies: the output's energy above 8 kHz over the limited input's
    clipAdds8: 10 * Math.log10(o8.hi / l8.hi),
    grMean: gr / (e - s),
    grMax,
    limited: under / (e - s),
    softClip: soft / (e - s),
    crestDb: 20 * Math.log10(pk / Math.sqrt(ex / (e - s))),
    maxJump: jump,
  };
});

// the layers that carry the most energy above 8 kHz, with their flatness and crest
const s0 = at(29.5);
const s1 = at(47.46);
const totalHf = hf(preM, s0, s1, 8000).hi / g ** 2;
const layers = [...mono.entries()]
  .map(([name, x]) => {
    let first = -1;
    let last = -1;
    for (let i = s0; i < s1; i++)
      if (x[i] !== 0) {
        if (first < 0) first = i;
        last = i;
      }
    if (first < 0) return undefined;
    const h8 = hf(x, s0, s1, 8000);
    const h12 = hf(x, s0, s1, 12000);
    let ex = 0;
    let pk = 0;
    for (let i = first; i <= last; i++) {
      ex += x[i]! ** 2;
      pk = Math.max(pk, Math.abs(x[i]!));
    }
    return {
      name,
      from: m.t0 + first / SR,
      to: m.t0 + last / SR,
      shareOfMixOver8: h8.hi / totalHf,
      ownOver8: 10 * Math.log10(h8.hi / (h8.all + 1e-30) + 1e-30),
      ownOver12: 10 * Math.log10(h12.hi / (h12.all + 1e-30) + 1e-30),
      flatness: flatness(x, first, last + 1),
      crestDb: 20 * Math.log10(pk / Math.sqrt(ex / (last - first + 1) + 1e-30)),
    };
  })
  .filter((r): r is NonNullable<typeof r> => r !== undefined)
  .sort((p, q) => q.shareOfMixOver8 - p.shareOfMixOver8);

console.log(
  'section     >8k out  >12k out  >8k pre  >12k pre  clip adds >8k  GR mean/max dB  limited  soft clip  crest  max jump',
);
for (const r of rows)
  console.log(
    `${r.name.padEnd(11)} ${r.over8.toFixed(1).padStart(7)} ${r.over12.toFixed(1).padStart(9)} ${r.preOver8.toFixed(1).padStart(8)} ${r.preOver12.toFixed(1).padStart(9)} ${r.clipAdds8.toFixed(1).padStart(13)} ${r.grMean.toFixed(1).padStart(8)}/${r.grMax.toFixed(1).padStart(4)} ${(100 * r.limited).toFixed(1).padStart(7)}% ${(100 * r.softClip).toFixed(2).padStart(8)}% ${r.crestDb.toFixed(1).padStart(6)} ${r.maxJump.toFixed(3).padStart(9)}`,
  );
console.log('layers by share of the energy above 8 kHz (29.5-47.46 s):');
for (const l of layers.slice(0, 15))
  console.log(
    `  ${l.name.padEnd(22)} ${(100 * l.shareOfMixOver8).toFixed(1).padStart(5)} %  own >8k ${l.ownOver8.toFixed(1).padStart(6)} dB  >12k ${l.ownOver12.toFixed(1).padStart(6)} dB  flatness ${l.flatness.toFixed(2)}  crest ${l.crestDb.toFixed(1)} dB  ${l.from.toFixed(2)}-${l.to.toFixed(2)} s`,
  );
const o = process.argv.indexOf('--out');
if (o >= 0) writeFileSync(process.argv[o + 1]!, JSON.stringify({ rows, layers }, null, 1));
