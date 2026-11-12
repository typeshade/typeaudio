// Renders scene 4, the battle of attrition, with the study's models in the engine.
//
//   bun experiments/15-scene4-attrition/run.ts [--out dir] [--join scene3.wav] [--workers N]
//        [--cache dir | --no-cache | --plain]
//
// The layers are built from their parts (`src/study/build.ts`): a part whose code and settings did
// not change is read from the cache (`.cache/scene-parts/`), the others are made on worker threads.
// `--plain` runs the scene's code as written, with no builder; the samples are the same.
//
// It writes `scene4.wav` (24-bit, 48 kHz, from 61.27 s) and `scene4.json`. With `--join` and scene
// 3's render (experiment 14, from 44.67 s), it compares the two over 61.37 to 62.22 s, where they hold
// the same sounds, and writes `scene3-4-join.wav`: scene 3 to 62.27 s, then scene 4.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, integratedLufs, truePeakDb, wav24, type Stereo } from '../../src/study/dsp.ts';
import { build, renderMaster, type BuildReport } from '../../src/study/build.ts';
import type { Mix } from '../../src/study/mix.ts';
import { readWav } from '../12-scene1-red-seal/measure.ts';
import { SCENE3_FROM as PREV_FROM } from '../14-scene3-lightning/scene3.ts';
import { SCENE4_FROM, SCENE4_JOIN, scene4 } from './scene4.ts';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name: string): string | undefined => {
  const at = process.argv.indexOf(`--${name}`);
  return at < 0 ? undefined : process.argv[at + 1];
};
const out = arg('out') ?? join(here, 'out');
mkdirSync(out, { recursive: true });

const workers = arg('workers');
const t0 = performance.now();
let m: Mix;
let built: BuildReport | undefined;
if (process.argv.includes('--plain')) m = scene4();
else {
  const r = await build(join(here, 'scene4.ts'), {
    exportName: 'scene4',
    cacheDir: process.argv.includes('--no-cache') ? null : arg('cache'),
    workers: workers === undefined ? undefined : Number(workers),
  });
  m = r.mix;
  built = r.report;
}
const t1 = performance.now();
const master = built ? await renderMaster(m) : null;
const y: Stereo = master ? master.y : m.render();
const t2 = performance.now();
writeFileSync(join(out, 'scene4.wav'), wav24(y));
writeFileSync(
  join(out, 'scene4.json'),
  JSON.stringify(
    {
      t0: m.t0,
      t1: m.t1,
      masterGainDb: m.masterGainDb,
      trimDb: m.trimDb,
      limitDb: m.limitDb,
      limitedShare: m.limitedShare,
      seconds: { build: (t1 - t0) / 1000, master: (t2 - t1) / 1000 },
      build: built,
      layers: Object.fromEntries(
        m.order.map((k) => {
          const l = m.layers.get(k)!;
          return [k, { t: l.t, target: l.target, meter: l.meter, gainDb: l.gainDb }];
        }),
      ),
    },
    null,
    1,
  ),
);
console.log(
  `scene4: ${m.order.length} layers, master ${m.masterGainDb.toFixed(2)} dB (scene 3's), trim ${m.trimDb.toFixed(2)} dB, limiter ${m.limitDb.toFixed(1)} dB deep, ${(100 * m.limitedShare).toFixed(1)} % of the time, integrated ${integratedLufs(y).toFixed(1)} LUFS, true peak ${(master ? master.peakDb : truePeakDb(y)).toFixed(2)} dBTP; layers ${((t1 - t0) / 1000).toFixed(1)} s, master ${((t2 - t1) / 1000).toFixed(1)} s`,
);

const prevPath = arg('join');
if (prevPath) {
  const s2 = readWav(prevPath);
  // the overlap: scene 3 from 44.67 s, scene 4 from 61.27 s
  const o2 = Math.round(PREV_FROM * SR);
  const o3 = Math.round(SCENE4_FROM * SR);
  let e2 = 0;
  let e3 = 0;
  let ed = 0;
  let x23 = 0;
  const a = Math.round(61.37 * SR);
  const b = Math.round(62.22 * SR);
  for (let c = 0; c < 2; c++)
    for (let i = a; i < b; i++) {
      const p = s2[c]![i - o2]!;
      const q = y[c]![i - o3]!;
      e2 += p * p;
      e3 += q * q;
      x23 += p * q;
    }
  const g = x23 / e3;
  for (let c = 0; c < 2; c++)
    for (let i = a; i < b; i++) {
      const d = s2[c]![i - o2]! - g * y[c]![i - o3]!;
      ed += d * d;
    }
  console.log(
    `overlap 61.37-62.22 s: scene 3 against scene 4, best gain ${(20 * Math.log10(g)).toFixed(3)} dB, levels ${(10 * Math.log10(e2 / e3)).toFixed(3)} dB apart, the difference ${(10 * Math.log10(ed / e2)).toFixed(1)} dB under scene 2`,
  );
  // the join: scene 3 to 62.27 s, scene 4 after, with a crossfade of 20 ms (from scene 3's start)
  const j = Math.round(SCENE4_JOIN * SR) - o2;
  const xf = Math.round(0.02 * SR);
  const off = o3 - o2;
  const n = off + y[0].length;
  const joined: Stereo = [new Float64Array(n), new Float64Array(n)];
  for (let c = 0; c < 2; c++)
    for (let i = 0; i < n; i++) {
      const p = i < s2[c]!.length ? s2[c]![i]! : 0;
      const q = i >= off ? (y[c]![i - off] ?? 0) : 0;
      const u = Math.min(1, Math.max(0, (i - (j - xf)) / xf));
      joined[c]![i] = p * (1 - u) + q * u;
    }
  writeFileSync(join(out, 'scene3-4-join.wav'), wav24(joined));
}
