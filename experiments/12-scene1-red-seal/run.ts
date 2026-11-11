// Renders experiment 12 with the study's models in the engine (`src/study/`).
//
//   bun experiments/12-scene1-red-seal/run.ts red   [--out dir] [--against r11.wav]
//   bun experiments/12-scene1-red-seal/run.ts scene [--out dir]
//
// `red` is the study's red passage (20.0 to 30.0 s, 2.5 s of tail). `scene` is scene 1, the red
// seal, 0.0 to 29.5 s. Each writes a 24-bit stereo WAV at 48 kHz and a JSON of its layers. With
// `--against`, `red` is measured against another render of the passage (`measure.ts`).

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { integratedLufs, truePeakDb, wav24, type Stereo } from '../../src/study/dsp.ts';
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

const t0 = performance.now();
const m: Mix = what === 'red' ? red() : scene();
const t1 = performance.now();
const y: Stereo = m.render();
const t2 = performance.now();
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
  `${what}: ${m.order.length} layers, master ${m.masterGainDb.toFixed(2)} dB, drive ${m.driveDb} dB (limiter ${m.limitDb.toFixed(1)} dB deep, ${(100 * m.limitedShare).toFixed(1)} % of the time), integrated ${integratedLufs(y).toFixed(1)} LUFS, true peak ${truePeakDb(y).toFixed(2)} dBTP; layers ${((t1 - t0) / 1000).toFixed(1)} s, master ${((t2 - t1) / 1000).toFixed(1)} s -> ${file}`,
);
const against = arg('against');
if (against && what === 'red') console.log(report(compare(y, readWav(against)), 'engine', 'study'));
