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
const at = process.argv.indexOf('--out');
if (at >= 0) writeFileSync(process.argv[at + 1]!, JSON.stringify({ names, rows }, null, 1));
