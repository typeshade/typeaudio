// The study's models in the engine (`src/study/`) against the study's own scripts. The fixture
// `test/fixtures/study-parity.json` is written by
// `experiments/12-scene1-red-seal/parity/fixtures.py` from the study's scripts at commit `07670c9`,
// with the random numbers of `src/study/rng.ts` in place of numpy's. The calls here are the calls
// there, one for one, so each model must give the study's samples: every sample of the signature
// within 1e-9 of the channel's peak, and the energy within 1e-9 of itself.

import { describe, expect, it } from 'vitest';
import * as D from '../src/study/dsp.ts';
import { irfft, rfft, transform } from '../src/study/fft.ts';
import { limiter, meter } from '../src/study/mix.ts';
import * as S from '../src/study/sources.ts';
import fixture from './fixtures/study-parity.json';

interface Row {
  n: number;
  energy: number;
  peak: number;
  idx: number[];
  v: number[];
}
const rows = fixture as unknown as Record<string, Row[]>;

function same(name: string, x: Float64Array | D.Stereo | number[]): void {
  const want = rows[name];
  expect(want, `no fixture "${name}"`).toBeDefined();
  const chans: ArrayLike<number>[] =
    Array.isArray(x) && !(x[0] instanceof Float64Array)
      ? [x as number[]]
      : x instanceof Float64Array
        ? [x]
        : (x as D.Stereo);
  expect(chans.length, name).toBe(want!.length);
  chans.forEach((c, k) => {
    const w = want![k]!;
    expect(c.length, `${name}: length`).toBe(w.n);
    let e = 0;
    for (let i = 0; i < c.length; i++) e += c[i]! * c[i]!;
    expect(Math.abs(e - w.energy), `${name}: energy`).toBeLessThanOrEqual(
      1e-9 * Math.max(w.energy, 1e-30) + 1e-24,
    );
    w.idx.forEach((i, j) => {
      expect(Math.abs(c[i]! - w.v[j]!), `${name}[${k}][${i}]`).toBeLessThanOrEqual(
        1e-9 * Math.max(w.peak, 1e-12),
      );
    });
  });
}

const seconds = 60_000;

describe('the transform of any length', () => {
  it('equals the plain DFT for lengths of small and of large prime factors', () => {
    for (const n of [1, 2, 3, 12, 30, 97, 346, 2400]) {
      const re = new Float64Array(n).map((_, i) => Math.sin(i * 0.37) + (i % 5) * 0.1);
      const im = new Float64Array(n).map((_, i) => Math.cos(i * 0.11));
      const [fr, fi] = transform(re, im, false);
      for (const k of [0, Math.floor(n / 3), n - 1]) {
        let sr = 0;
        let si = 0;
        for (let t = 0; t < n; t++) {
          const a = (-2 * Math.PI * k * t) / n;
          sr += re[t]! * Math.cos(a) - im[t]! * Math.sin(a);
          si += re[t]! * Math.sin(a) + im[t]! * Math.cos(a);
        }
        expect(Math.abs(fr[k]! - sr)).toBeLessThan(1e-9 * n);
        expect(Math.abs(fi[k]! - si)).toBeLessThan(1e-9 * n);
      }
      const x = re.slice();
      const [hr, hi] = rfft(x);
      const back = irfft(hr, hi, n);
      for (let i = 0; i < n; i++) expect(Math.abs(back[i]! - x[i]!)).toBeLessThan(1e-12 * n);
    }
  });
});

describe("the study's models, as the study computes them", () => {
  const ramp = D.linspace(0.6, 1.0, D.nsamp(0.5));

  it('the generator', () => {
    same('rng', [
      D.rng(7).random(),
      ...D.rng(8).normalN(5),
      D.rng(9).poisson(12.5),
      D.rng(9).poisson(400.0),
    ]);
  });

  it(
    'beds, air and wind',
    () => {
      same('hall_air', S.hallAir(0.5, 101));
      same('wide_noise', S.wideNoise(0.4, 104, 28, 90, 3));
      same('wind', S.wind(0.5, 114, 150, 1500));
      same('dust', S.dust(0.5, 186, { lo: 3500.0, hi: 11000.0, sd: 2.0, grain: 0.5, tilt: 0.2 }));
      same('billow', S.billow(0.6, 580, 60.0, 600.0));
      same('puff', S.puff(0.4, 730));
      same('sand', S.sand(0.3, 750));
      same('aero', S.aero(D.linspace(2.0, 30.0, D.nsamp(0.4)), 740));
      S.turbulence(0.3, 700).forEach((b, i) => same(`turbulence.${i}`, b));
      same('howl', S.howl(0.4, 710, [300.0, 450.0]));
    },
    seconds,
  );

  it(
    'the red material',
    () => {
      const [rumble, roar, crackle] = S.redMaterial(D.nsamp(0.5), ramp, 133);
      same('red_material.rumble', rumble);
      same('red_material.roar', roar);
      same('red_material.crackle', crackle);
      same('irregular', S.irregular(24000, 170, 20, 110));
    },
    seconds,
  );

  it(
    'stone: impacts, cracks, blocks, falls',
    () => {
      same('stone_impact', S.stoneImpact(0.35, 14.0, D.rng(120)));
      same('heavy_crack', S.heavyCrack(122, { size: 0.5, dur: 0.3, kRate: 8 }));
      same('rock_fall', S.rockFall(0.35, 1.5, 124));
      same('gravel', S.gravel(0.48, 116));
      same('block_hit', S.blockHit(530, 0.9, 5.0));
      same('grind', S.grind(0.52, 526));
      same('stone_crack', S.stoneCrack(D.rng(130), 0.3));
      same('groan', S.groan(0.3, 136));
      same('slab_fall', S.slabFall(566, 0.5));
      same(
        'tumble',
        S.tumble(0.8, 572, (t) => 6.0 * Math.exp(-t / 0.9) + 0.8, [0.15, 0.5], [4.0, 9.0]),
      );
      same(
        'rubble',
        S.rubble(0.6, 720, () => 20.0, { sizes: [0.3, 1.0], body: 0.5 }),
      );
      same('fracture', S.fracture(760, 300.0, 5000.0, 0.03, { dur: 0.3 }));
    },
    seconds,
  );

  it(
    'bursts, pressure, bodies, rays, ice',
    () => {
      const b = S.burst(129, 35, 140, 0.08, { rise: 0.004 });
      same('burst', b);
      same('slap', S.slap(b, 800));
      same('tilted_burst', S.tiltedBurst(193, 500.0, 9000.0, 0.045, { tilt: 0.4, rise: 0.002 }));
      const [front, low, slap] = S.whump(141, 0.0035, 0.6);
      same('whump.front', front);
      same('whump.low', low);
      same('whump.slap', slap);
      same('boom', S.boom(160, { f: 88.0, tau: 0.16 }));
      same('saturate', S.saturate(S.boom(160, { f: 88.0, tau: 0.16 })));
      same('sear', S.sear(0.36, 190, 280.0, 1300.0, 5.0));
      same('crush', S.crush(0.9, 187, 0.14));
      same('lance', S.lance(195, 0.13, 5200.0, 600.0));
      same('band_sweep', S.bandSweepWide(0.22, 117, 400, 3000));
      same('sizzle', S.sizzle(0.6, 121, 0.12));
    },
    seconds,
  );

  it(
    'tones, sparks, cloth',
    () => {
      same('voice', S.voice(0.5, 401, [185.0, 311.0, 466.0]));
      same('glide', S.glide(0.5, 410, 220, 311, { ratios: [1.0, 1.5, 2.4, 3.2], shape: 1.3 }));
      same('pops', S.pops(0.5, 404, 16.0, 500, 4000, 0.005));
      same('cloth', S.cloth(0.5, 183, 260));
    },
    seconds,
  );

  it(
    'the hall, the limiter and the meters',
    () => {
      const room = new D.Room();
      const b = S.burst(129, 200, 2000, 0.05);
      const P = {
        x: D.linspace(-6, 6, b.length),
        y: new Float64Array(b.length).fill(1.5),
        z: new Float64Array(b.length).fill(-2.0),
      };
      const [d, er] = D.place(b, P, room, 3.0);
      same('place.direct', d);
      same('place.er', er);
      same('reverb_ir', D.reverbIr(room));
      const x: D.Stereo = [
        S.boom(160, { f: 88.0, tau: 0.16 }).map((v) => v * 3),
        S.boom(161, { f: 70.0, tau: 0.16 }).map((v) => v * 1.5),
      ];
      same('limiter', limiter(x, 0.7, 0.004, 0.06));
      same('hp27', D.iir(x[0], [D.rbj('hp', 27.0, 0.7071)]));
      const tiled: D.Stereo = [
        new Float64Array(x[0].length * 8),
        new Float64Array(x[1].length * 8),
      ];
      for (let k = 0; k < 8; k++) for (let c = 0; c < 2; c++) tiled[c].set(x[c]!, k * x[c]!.length);
      same('meters', [
        ...(['m', 'i', 's', 'a', 'r'] as const).map((k) => meter(x, k)),
        D.truePeakDb(x),
        D.integratedLufs(tiled),
      ]);
    },
    seconds,
  );
});
