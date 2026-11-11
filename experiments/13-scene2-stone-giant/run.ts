// Renders scene 2, the stone giant, with the study's models in the engine.
//
//   bun experiments/13-scene2-stone-giant/run.ts [--out dir] [--join scene1.wav] [--workers N]
//        [--cache dir | --no-cache | --plain]
//
// The layers are built from their parts (`src/study/build.ts`): a part whose code and settings did
// not change is read from the cache (`.cache/scene-parts/`), the others are made on worker threads.
// `--plain` runs the scene's code as written, with no builder; the samples are the same.
//
// It writes `scene2.wav` (24-bit, 48 kHz, from 28.5 s) and `scene2.json`. With `--join` and scene
// 1's render (experiment 12, from 0 s), it compares the two over 28.6 to 29.45 s, where they hold the
// same sounds, and writes `scene1-2-join.wav`: scene 1 to 29.5 s, then scene 2.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, integratedLufs, truePeakDb, wav24, type Stereo } from '../../src/study/dsp.ts';
import { build, renderMaster, type BuildReport } from '../../src/study/build.ts';
import type { Mix } from '../../src/study/mix.ts';
import { readWav } from '../12-scene1-red-seal/measure.ts';
import { SCENE2_FROM, SCENE2_JOIN, scene2 } from './scene2.ts';

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
if (process.argv.includes('--plain')) m = scene2();
else {
  const r = await build(join(here, 'scene2.ts'), {
    exportName: 'scene2',
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
writeFileSync(join(out, 'scene2.wav'), wav24(y));
writeFileSync(
  join(out, 'scene2.json'),
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
  `scene2: ${m.order.length} layers, master ${m.masterGainDb.toFixed(2)} dB (scene 1's), trim ${m.trimDb.toFixed(2)} dB, limiter ${m.limitDb.toFixed(1)} dB deep, ${(100 * m.limitedShare).toFixed(1)} % of the time, integrated ${integratedLufs(y).toFixed(1)} LUFS, true peak ${(master ? master.peakDb : truePeakDb(y)).toFixed(2)} dBTP; layers ${((t1 - t0) / 1000).toFixed(1)} s, master ${((t2 - t1) / 1000).toFixed(1)} s`,
);

const s1path = arg('join');
if (s1path) {
  const s1 = readWav(s1path);
  // the overlap: scene 1 from 0 s, scene 2 from 28.5 s
  let e1 = 0;
  let e2 = 0;
  let ed = 0;
  let x12 = 0;
  for (let c = 0; c < 2; c++)
    for (let i = Math.round(28.6 * SR); i < Math.round(29.45 * SR); i++) {
      const a = s1[c]![i]!;
      const b = y[c]![i - Math.round(SCENE2_FROM * SR)]!;
      e1 += a * a;
      e2 += b * b;
      x12 += a * b;
    }
  const g = x12 / e2;
  for (let c = 0; c < 2; c++)
    for (let i = Math.round(28.6 * SR); i < Math.round(29.45 * SR); i++) {
      const d = s1[c]![i]! - g * y[c]![i - Math.round(SCENE2_FROM * SR)]!;
      ed += d * d;
    }
  console.log(
    `overlap 28.6-29.45 s: scene 1 against scene 2, best gain ${(20 * Math.log10(g)).toFixed(3)} dB, levels ${(10 * Math.log10(e1 / e2)).toFixed(3)} dB apart, the difference ${(10 * Math.log10(ed / e1)).toFixed(1)} dB under scene 1`,
  );
  // the join: scene 1 to 29.5 s, scene 2 after, with a crossfade of 20 ms
  const j = Math.round(SCENE2_JOIN * SR);
  const xf = Math.round(0.02 * SR);
  const n = j + y[0].length - Math.round((SCENE2_JOIN - SCENE2_FROM) * SR);
  const joined: Stereo = [new Float64Array(n), new Float64Array(n)];
  const off = Math.round(SCENE2_FROM * SR);
  for (let c = 0; c < 2; c++)
    for (let i = 0; i < n; i++) {
      const a = i < s1[c]!.length ? s1[c]![i]! : 0;
      const b = i >= off ? (y[c]![i - off] ?? 0) : 0;
      const u = Math.min(1, Math.max(0, (i - (j - xf)) / xf));
      joined[c]![i] = a * (1 - u) + b * u;
    }
  writeFileSync(join(out, 'scene1-2-join.wav'), wav24(joined));
}
