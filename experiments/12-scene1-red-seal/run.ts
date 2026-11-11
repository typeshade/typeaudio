// Renders experiment 12 with the study's models in the engine (`src/study/`).
//
//   bun experiments/12-scene1-red-seal/run.ts red   [--out dir] [--against r11.wav]
//   bun experiments/12-scene1-red-seal/run.ts scene [--out dir]
//   bun experiments/12-scene1-red-seal/run.ts red --parity study-red.f64
//
// The layers are built from their parts (`src/study/build.ts`): a part whose code and settings did
// not change since a render is read from the cache (`.cache/scene-parts/`), and the others are made
// on worker threads, one for each core. The samples are the same either way. `--workers N` sets
// the threads (0 makes the parts in this thread), `--cache <dir>` puts the cache elsewhere,
// `--no-cache` reads and writes no cache, and `--plain` runs the scene's code as written, with no
// builder.
//
// `red` is the study's red passage (20.0 to 30.0 s, 2.5 s of tail). `scene` is scene 1, the red
// seal, 0.0 to 29.5 s. Each writes a 24-bit stereo WAV at 48 kHz and a JSON of its layers. With
// `--against`, `red` is measured against another render of the passage (`measure.ts`). With
// `--parity`, it is compared sample by sample with the study's render of the same passage with the
// shared generator (`parity/render_shared.py`).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { integratedLufs, truePeakDb, wav24, type Stereo } from '../../src/study/dsp.ts';
import { build, renderMaster, type BuildReport } from '../../src/study/build.ts';
import type { Mix } from '../../src/study/mix.ts';
import { compare, readWav, report } from './measure.ts';
import { red } from './red.ts';
import { scene } from './scene.ts';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name: string): string | undefined => {
  const at = process.argv.indexOf(`--${name}`);
  return at < 0 ? undefined : process.argv[at + 1];
};
const what = process.argv[2] ?? 'scene';
const out = arg('out') ?? join(here, 'out');
mkdirSync(out, { recursive: true });

const workers = arg('workers');
const t0 = performance.now();
let m: Mix;
let built: BuildReport | undefined;
if (process.argv.includes('--plain')) m = what === 'red' ? red() : scene();
else {
  const r = await build(join(here, what === 'red' ? 'red.ts' : 'scene.ts'), {
    exportName: what === 'red' ? 'red' : 'scene',
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
const outPeak = master ? master.peakDb : truePeakDb(y);
const file = join(out, `${what}.wav`);
writeFileSync(file, wav24(y));
writeFileSync(
  join(out, `${what}.json`),
  JSON.stringify(
    {
      name: m.name,
      t0: m.t0,
      t1: m.t1,
      tail: m.tail,
      masterGainDb: m.masterGainDb,
      driveDb: m.driveDb,
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
if (built)
  console.log(
    `${what}: ${built.parts} parts, ${built.loaded} from the cache, ${built.made} made on ${built.workers} workers (collect ${built.seconds.collect.toFixed(1)} s, keys ${built.seconds.keys.toFixed(1)} s, parts ${built.seconds.parts.toFixed(1)} s, finish ${built.seconds.finish.toFixed(1)} s), cache ${(built.cacheBytes / 2 ** 20).toFixed(0)} MiB`,
  );
console.log(
  `${what}: ${m.order.length} layers, master ${m.masterGainDb.toFixed(2)} dB, drive ${m.driveDb} dB (limiter ${m.limitDb.toFixed(1)} dB deep, ${(100 * m.limitedShare).toFixed(1)} % of the time), integrated ${integratedLufs(y).toFixed(1)} LUFS, true peak ${outPeak.toFixed(2)} dBTP; layers ${((t1 - t0) / 1000).toFixed(1)} s, master ${((t2 - t1) / 1000).toFixed(1)} s -> ${file}`,
);
const against = arg('against');
if (against && what === 'red') console.log(report(compare(y, readWav(against)), 'engine', 'study'));
const parity = arg('parity');
if (parity) {
  const b = readFileSync(parity);
  const study = new Float64Array(b.buffer, b.byteOffset, b.byteLength / 8);
  const n = y[0].length;
  let worst = 0;
  let e = 0;
  let d = 0;
  for (let c = 0; c < 2; c++)
    for (let i = 0; i < n; i++) {
      const s = study[c * n + i]!;
      worst = Math.max(worst, Math.abs(y[c]![i]! - s));
      e += s * s;
      d += (y[c]![i]! - s) ** 2;
    }
  console.log(
    `parity with the study's render: largest difference ${worst.toExponential(2)}, the difference ${(10 * Math.log10(d / e)).toFixed(1)} dB under the signal`,
  );
}
