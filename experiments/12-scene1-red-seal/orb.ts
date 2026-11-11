// The share of the black hole in the mix of scene 1, where the orb is on screen and close.
//
//   bun experiments/12-scene1-red-seal/orb.ts [--out file.json] [--scene other-scene.ts]
//
// The orb's layers are those whose names begin with `hole`, `orb-`, `swirl`, `draw`, `gather-core` or
// `gather-voice`. For each window it gives the orb's share of the energy of the mix before the
// master (the master is one gain and a limiter for both), the level of the orb and of the rest, and
// five bands of each.

import { writeFileSync } from 'node:fs';
import type { Stereo } from '../../src/study/dsp.ts';
import { bandLevels, rmsDb, SR } from './measure.ts';
import { scene as current } from './scene.ts';

export const ORB_LAYER = /^(hole|orb-|swirl|draw|gather-core|gather-voice)/;

/** The four windows of the owner's review (reference seconds). */
export const ORB_WINDOWS: readonly (readonly [string, number, number])[] = [
  ['close overhead', 5.0, 7.0],
  ['streak over the camera', 9.5, 11.0],
  ['over the rock field', 11.5, 15.0],
  ['low pass overhead', 18.5, 21.0],
];

const other = process.argv.indexOf('--scene');
const scene: typeof current =
  other < 0
    ? current
    : ((await import(process.argv[other + 1]!)) as { scene: typeof current }).scene;
const m = scene();
const n = m.n;
const orb: Stereo = [new Float64Array(n), new Float64Array(n)];
const all: Stereo = [new Float64Array(n), new Float64Array(n)];
const names: string[] = [];
for (const name of m.order) {
  const l = m.layers.get(name)!;
  const isOrb = ORB_LAYER.test(name);
  if (isOrb && !names.includes(name)) names.push(name);
  for (let c = 0; c < 2; c++)
    for (let i = 0; i < l.dry[c]!.length; i++) {
      const v = l.dry[c]![i]! + l.wet[c]![i]!;
      all[c]![l.start + i] = all[c]![l.start + i]! + v;
      if (isOrb) orb[c]![l.start + i] = orb[c]![l.start + i]! + v;
    }
}
const rest: Stereo = [all[0].map((v, i) => v - orb[0][i]!), all[1].map((v, i) => v - orb[1][i]!)];
const rows = ORB_WINDOWS.map(([name, a, b]) => {
  const s = Math.round(a * SR);
  const e = Math.round(b * SR);
  const eo = 10 ** (rmsDb(orb, s, e) / 10);
  const ea = 10 ** (rmsDb(all, s, e) / 10);
  return {
    name,
    from: a,
    to: b,
    share: eo / ea,
    orbDb: rmsDb(orb, s, e),
    restDb: rmsDb(rest, s, e),
    orbBands: bandLevels(orb, s, e),
    restBands: bandLevels(rest, s, e),
  };
});
console.log(`orb layers: ${names.join(', ')}`);
console.log(
  'window                    share   orb dB  rest dB   orb - rest per band (30-120, 120-500, 500-2k, 2k-6k, 6k-16k)',
);
for (const r of rows)
  console.log(
    `${r.name.padEnd(24)} ${(100 * r.share).toFixed(1).padStart(5)} %  ${r.orbDb.toFixed(1).padStart(6)}  ${r.restDb.toFixed(1).padStart(6)}   ${r.orbBands.map((v, i) => (v - r.restBands[i]!).toFixed(1).padStart(5)).join(' ')}`,
  );

// ---- Review 2: what the orb is made of, the gestures that swallow, and the stones that gather.
/** The parts of the orb and of the gathering, by layer name. */
export const PARTS: readonly (readonly [string, RegExp])[] = [
  ['torrent', /^(hole-roar|hole-inrush|hole-pressure|hole-core|draw)/],
  ['swallow', /^hole-swallow/],
  ['tonal', /^(hole-mana|hole-growl|hole-glint|hole-ring|hole-voice|orb-.*voice|gather-voice)/],
  [
    'stones',
    /^(gather-clump|gather-grind|gather-rubble|orbit|drag-|fly-past|pile-|tear-hit|tear-pass)/,
  ],
];
const sumOf = (re: RegExp): Stereo => {
  const y: Stereo = [new Float64Array(n), new Float64Array(n)];
  for (const name of m.order) {
    if (!re.test(name)) continue;
    const l = m.layers.get(name)!;
    for (let c = 0; c < 2; c++)
      for (let i = 0; i < l.dry[c]!.length; i++)
        y[c]![l.start + i] = y[c]![l.start + i]! + l.dry[c]![i]! + l.wet[c]![i]!;
  }
  return y;
};
const parts = PARTS.map(([name, re]) => [name, sumOf(re)] as const);
const share = (x: Stereo, s: number, e: number) => 10 ** ((rmsDb(x, s, e) - rmsDb(all, s, e)) / 10);
console.log(
  'window                    ' +
    PARTS.map(([p]) => p.padStart(9)).join('') +
    '   (share of the mix)',
);
const partRows = ORB_WINDOWS.map(([name, a, b]) => {
  const s = Math.round(a * SR);
  const e = Math.round(b * SR);
  const v = Object.fromEntries(parts.map(([p, x]) => [p, share(x, s, e)]));
  console.log(
    `${name.padEnd(24)}  ${parts.map(([p]) => `${(100 * v[p]!).toFixed(1).padStart(7)} %`).join('')}`,
  );
  return { name, ...v };
});

/** Onsets a second: 10 ms frames that rise `rise` dB over the mean of the 50 ms before, 40 ms apart. */
function onsetRate(x: Stereo, a: number, b: number, rise = 6): number {
  const h = 480;
  const s0 = Math.round(a * SR);
  const fr: number[] = [];
  for (let s = s0; s + h <= Math.round(b * SR); s += h) {
    let q = 0;
    for (let i = s; i < s + h; i++) q += x[0][i]! ** 2 + x[1][i]! ** 2;
    fr.push(10 * Math.log10(q / h + 1e-14));
  }
  let count = 0;
  let last = -10;
  for (let j = 5; j < fr.length; j++) {
    const before = 10 * Math.log10(fr.slice(j - 5, j).reduce((p, q) => p + 10 ** (q / 10), 0) / 5);
    if (fr[j]! - before >= rise && j - last >= 4) {
      count++;
      last = j;
    }
  }
  return count / (b - a);
}
const stones = parts.find(([p]) => p === 'stones')![1];
const gather = {
  onsets6: onsetRate(stones, 11.5, 15.0, 6),
  onsets3: onsetRate(stones, 11.5, 15.0, 3),
  stonesDb: rmsDb(stones, 11.5 * SR, 15 * SR),
};
console.log(
  `stones 11.5-15 s: ${gather.onsets6.toFixed(1)} onsets a second over 6 dB, ${gather.onsets3.toFixed(1)} over 3 dB; ${gather.stonesDb.toFixed(1)} dB`,
);

/**
 * The shape of each swallow, heard with its late field: the level of its last third over its
 * first, and the fall from the 10 ms before its stop to the 10 ms that start 10 ms after it.
 */
const swallows = m.order
  .filter((name) => /^hole-swallow/.test(name))
  .map((name) => {
    const l = m.layers.get(name)!;
    // the dry part is padded to the length of its late field: the stop is its last sound
    let len = l.dry[0]!.length;
    while (len > 1 && l.dry[0]![len - 1] === 0 && l.dry[1]![len - 1] === 0) len--;
    const x = l.wet[0]!.map(
      (v, i) => v + l.wet[1]![i]! + (i < len ? l.dry[0]![i]! + l.dry[1]![i]! : 0),
    );
    const k = 480;
    const fr: number[] = [];
    for (let s = 0; s + k <= x.length; s += k) {
      let q = 0;
      for (let i = s; i < s + k; i++) q += x[i]! ** 2;
      fr.push(q / k);
    }
    const end = Math.floor(len / k) - 1;
    const third = Math.max(1, Math.floor((end + 1) / 3));
    const mean = (a: number, b: number) =>
      fr.slice(a, b).reduce((p, q) => p + q, 0) / Math.max(1, b - a);
    const rise = 10 * Math.log10(mean(end + 1 - third, end + 1) / (mean(0, third) + 1e-20));
    const fall = 10 * Math.log10(fr[end]! / (fr[Math.min(fr.length - 1, end + 2)]! + 1e-20));
    return { name, rise, fall };
  });
/** Each stone's arrival at the core: its share of the mix before the master in its first 100 ms. */
const arrivals = m.order
  .filter((name) => /^drag-\d+-arrive$/.test(name))
  .map((name) => {
    const l = m.layers.get(name)!;
    const s = l.start;
    const e = s + Math.round(0.1 * SR);
    let ea = 0;
    let em = 0;
    for (let c = 0; c < 2; c++)
      for (let i = s; i < e; i++) {
        const v = l.dry[c]![i - s]! + l.wet[c]![i - s]!;
        ea += v * v;
        em += all[c]![i]! ** 2;
      }
    return { name, t: l.t, share: ea / em };
  })
  .filter((a) => a.t >= 11.5 && a.t < 15);
const med = (v: number[]) => [...v].sort((p, q) => p - q)[Math.floor(v.length / 2)] ?? NaN;
if (swallows.length)
  console.log(
    `swallows: ${swallows.length}; last third over first third: median ${med(swallows.map((s) => s.rise)).toFixed(1)} dB; fall from the 10 ms before the stop to 10-20 ms after it, with the late field: median ${med(swallows.map((s) => s.fall)).toFixed(1)} dB`,
  );
if (arrivals.length)
  console.log(
    `arrivals 11.5-15 s: ${arrivals.length}; share of the mix in their first 100 ms: median ${(100 * med(arrivals.map((a) => a.share))).toFixed(1)} %`,
  );
const at = process.argv.indexOf('--out');
if (at >= 0)
  writeFileSync(
    process.argv[at + 1]!,
    JSON.stringify({ names, rows, partRows, gather, swallows, arrivals }, null, 1),
  );
