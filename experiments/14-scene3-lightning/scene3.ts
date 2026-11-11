// Scene 3 of the reference video, the lightning, 45.67 to 62.27 s, made with the study's models in
// the engine (`src/study/`), as scenes 1 and 2 are (experiments 12 and 13). It starts from scene 2's
// tail: the mix begins at 44.67 s with scene 2's hall and charge, it holds scene 2's head of this
// scene (the release at 45.70 s, the bolt, the barrier that shatters at 47.46 s), and it is mastered
// at scene 2's gain, so the two join at 45.67 s with no step.
//
// The frames, read on 2026-11-11 at 4 and 12 frames a second, with a cut detector:
//
//   45.67-46.05  wide: the bolt leaves her staff across the hall (45.70)
//   46.05-46.51  the giant's side; a barrier of blue hexagons forms (46.18); the strike (46.40)
//   46.51-47.46  the bolt presses on the barrier; it shatters (47.46)
//   47.55-48.40  the giant's shoulder; the barrier's shards and sparks fly
//   48.40-49.42  arcs crawl over the giant's stone (48.40, 48.72, 48.98, 49.22)
//   49.42-49.93  close: a thick bolt sweeps across the giant
//   49.93-52.93  wide, from the side: the torrent streams into the giant; branches strike from the
//                vault at 50.59, 51.18, 51.51, 52.39 and 52.72 (the flashes the cut detector reads)
//   52.93-53.60  from above: the cloud and the bolts; a streak passes close at 53.48
//   53.60-54.20  a pillar passes in front of the camera: near black
//   54.20-55.81  from above again; the bolts thin in the cloud
//   55.81-56.95  close: the bolts converge on a small barrier in the cloud; jagged strikes at 56.53,
//                56.62 and 56.78
//   56.95-57.22  the white blast
//   57.22-57.72  the blast clears: a burnt shape; dark arcs crawl over the floor
//   57.72-60.31  she stands in the settling dust; at 59.0 to 60.2 white streaks of wind whirl round her
//   60.31-62.27  her face, close; her hair blows; the next attack follows at 62.27
//
// The rules of scenes 1 and 2 hold: one source for one event across the cuts, laid shot by shot with
// a crossfade; no fast glide of a pitch; heavy things low; no hollow tube; no period; a sound earns
// its place. Lightning: the attack short and intense, and the bolt goes on for as long as it is seen.

import {
  SR,
  addAt,
  bandGain,
  fade,
  lp,
  nsamp,
  rng,
  spectral,
  type Stereo,
  type Vec3,
} from '../../src/study/dsp.ts';
import { Mix } from '../../src/study/mix.ts';
import { concat, line } from '../../src/study/passage.ts';
import * as S from '../../src/study/sources.ts';
import {
  SCENE1_MASTER,
  across,
  beds,
  bolt,
  charge,
  drop,
  env,
  lowPass,
  scene3Head,
  shapeLayer,
  xfade,
} from '../13-scene2-stone-giant/scene2.ts';

export const SCENE3_FROM = 44.67;
export const SCENE3_JOIN = 45.67;
export const SCENE3_END = 62.27;

type Points = readonly (readonly [number, number])[];

/** Two low-pass sections at `fc` (24 dB an octave): the cleanliness rule of scene 2's review 9. */
const lp2 = (x: Float64Array, fc: number) => lp(lp(x, fc), fc);

/** Keep `keep` s of a sound, then fade it out over 80 ms. */
function cut(x: Float64Array, keep: number): Float64Array {
  const k0 = nsamp(keep);
  const k1 = nsamp(keep + 0.08);
  return x.map((v, i) => (i < k0 ? v : i < k1 ? v * (1 - (i - k0) / (k1 - k0)) : 0));
}

/**
 * A bolt that strikes: one instant, as scene 2's release is. A full-band tearing crack with a
 * saturated body, and at the same instant a low pressure thump, each heard for about 0.12 s.
 */
function strike(seed: number, size = 1.0, keep = 0.12): [Float64Array, Float64Array] {
  const n = nsamp(0.45);
  const c = new Float64Array(n);
  addAt(c, S.tiltedBurst(seed, 300.0, 14000.0, 0.03, { tilt: 0.25, rise: 0.0003 }), 0, 1.0);
  addAt(
    c,
    S.heavyCrack(seed + 1, {
      size: 2.0 * size,
      dur: 0.15,
      kRate: 14,
      bright: 1.0,
    }).subarray(0, n),
    0,
    0.8,
  );
  const [front, low] = S.whump(seed + 2, 0.008, 0.45);
  const t = new Float64Array(n);
  addAt(t, front, 0, 0.8);
  addAt(t, low, 0, 0.8);
  addAt(
    t,
    S.boom(seed + 3, {
      f: 40.0 / Math.max(size, 0.5) ** 0.3,
      tau: 0.1,
      dur: 0.45,
    }),
    0,
    1.0,
  );
  return [lp2(cut(S.norm(S.saturate(c, 2.0)), keep), 12000), cut(S.saturate(t, 2.0), keep)];
}

/**
 * The discharge while a bolt is seen: scene 2's bolt (a torrent of noise on a deep spectrum, a dense
 * saturated crackle, a heavy low body, at levels that wander with no period), shaped by `points`.
 */
function plasma(t0: number, t1: number, seed: number, points: Points, rate = 4500): Float64Array {
  const dur = t1 - t0;
  const n = nsamp(dur);
  const level = env(points, t0, n);
  const bands = S.turbulence(dur, seed, S.BEAM_CURVE, S.TURBULENCE_BANDS, 0.4);
  const torrent = new Float64Array(n);
  for (const b of bands)
    for (let i = 0; i < n; i++) torrent[i] = torrent[i]! + 0.5 * (b[0][i]! + b[1][i]!);
  const r = rng(seed + 10);
  const u = r.randomN(n);
  const amp = r.uniformN(0.3, 1.0, n);
  const sg = r.signN(n);
  const imp = new Float64Array(n);
  for (let i = 0; i < n; i++) imp[i] = u[i]! < rate / SR ? amp[i]! * sg[i]! : 0;
  const crack = spectral(imp, (f) => bandGain(f, 1500, 9000, 2));
  const body = S.billow(dur, seed + 11, 35.0, 160.0, 2.5)[0];
  const walk = S.levelWalk(n, seed + 12, 2.0, 0.5, 6.0);
  const tn = S.norm(torrent);
  const cn = S.norm(crack);
  const bn = S.norm(body);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) y[i] = (0.8 * tn[i]! + 0.45 * cn[i]! + 0.9 * bn[i]!) * walk[i]!;
  let pk = 1e-12;
  for (const v of y) pk = Math.max(pk, Math.abs(v));
  return lp2(
    y.map((v, i) => (Math.tanh((1.2 * v) / pk) / Math.tanh(1.2)) * level[i]!),
    9000,
  );
}

/**
 * The hum of the voltage, as in scene 2's charge: 36 Hz with a body to 252 Hz, steady in pitch,
 * driven harder as its level rises, at a level that wanders with no period.
 */
function hum(t0: number, t1: number, seed: number, points: Points): Float64Array {
  const n = nsamp(t1 - t0);
  const level = env(points, t0, n);
  const walk = S.levelWalk(n, seed, 1.5, 0.4, 2.0);
  const amps = [1.0, 0.95, 0.8, 0.6, 0.4, 0.25, 0.15];
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const b = level[i]!;
    let x = 0;
    amps.forEach((a, k) => (x += a * Math.sin(2 * Math.PI * 36.0 * (k + 1) * (i / SR) + 0.7 * k)));
    const g = 1 + 3.5 * b;
    y[i] = (Math.tanh((g * x) / 2.5) / Math.tanh(g)) * b * walk[i]!;
  }
  return fade(y, 0.05, 0.01);
}

/** A crackle of arcs: dense saturated impulses from 1.5 to 7 kHz in bursts of irregular density. */
function arcCrackle(dur: number, seed: number, density: Float64Array): Float64Array {
  const n = nsamp(dur);
  const r = rng(seed);
  const u = r.randomN(n);
  const amp = r.uniformN(0.3, 1.0, n);
  const sg = r.signN(n);
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = u[i]! < (6000 * density[i]!) / SR ? amp[i]! * sg[i]! : 0;
  const band = spectral(x, (f) => bandGain(f, 1500, 7000, 2));
  return lp2(S.saturate(S.norm(band), 1.8), 7500);
}

// ---- The hall: scene 2's bed to 47.2 s, crossed under the bolt to a bed of this scene's own.
function bed3(m: Mix): void {
  m.part('bed3', () => {
    const t0 = 45.9;
    const dur = SCENE3_END + 2.0 - t0;
    m.addWide('bed3', S.hallAir(dur, 301), t0, { target: -41.0, kind: 'a' });
    m.addWide('bed3-low', S.wideNoise(dur, 304, 28, 90, 3), t0, {
      target: -47.0,
      kind: 'r',
    });
  });
}

function tidy3(m: Mix): void {
  drop(m, ['bed', 'bed-low', 'bed-high']);
  for (const name of ['bed2', 'bed2-low', 'bed2-high'])
    shapeLayer(m, name, xfade(46.1, 47.0, true));
  for (const name of ['bed3', 'bed3-low']) shapeLayer(m, name, xfade(46.1, 47.0, false));
}

// ---- 47.50 to 49.42: the giant's stone stays charged after the barrier shatters: it crackles low,
// a small arc at 47.65; from 48.40 arcs crawl over it. Each arc lands with a snap and crackles as
// it crawls; under them the hum of the voltage that stays in the stone.
const GIANT: Vec3 = [1.0, 1.6, -4.0];
function crawl(m: Mix): void {
  m.part('crawl', () => {
    const t0 = 47.5;
    const t1 = 49.5;
    const n = nsamp(t1 - t0);
    const snaps = [47.65, 48.4, 48.72, 48.98, 49.22];
    const d = new Float64Array(n);
    const dw = S.levelWalk(n, 3410, 4.0, 2.0, 12.0);
    for (let i = 0; i < n; i++) {
      const t = t0 + i / SR;
      let e = 0;
      for (const s of snaps) if (t >= s) e = Math.max(e, Math.exp(-(t - s) / 0.12));
      d[i] = Math.min(1, (0.15 + 0.85 * e) * dw[i]!);
    }
    const ck = arcCrackle(t1 - t0, 3400, d);
    m.add('arc-crackle', fade(ck, 0.01, 0.06), t0, GIANT, {
      target: -17,
      kind: 'm',
      sendDb: -10,
    });
    snaps.forEach((t, k) => {
      const [c, th] = strike(3420 + 10 * k, 0.5, 0.06);
      m.add(`arc-snap${k}`, c, t, [GIANT[0] + (k % 2 ? -0.8 : 0.6), 1.8, -4.0], {
        target: k === 3 ? -11 : k === 0 ? -17 : -14,
        kind: 'i',
        sendDb: -10,
      });
      m.add(`arc-snap${k}-thump`, th, t, GIANT, {
        target: k === 3 ? -15 : k === 0 ? -21 : -18,
        kind: 'i',
      });
    });
    // charged fragments of the field streak past the camera (47.98, 48.07, 48.15): a zip of
    // crackle on a short path (about 19 m/s, so its Doppler stays small)
    (
      [
        [47.98, -1],
        [48.07, 1],
        [48.15, -1],
      ] as const
    ).forEach(([t, side], k) => {
      const zn = nsamp(0.16);
      const bell = new Float64Array(zn).map((_, i) => Math.sin((Math.PI * i) / zn) ** 2);
      const z = arcCrackle(0.16, 3440 + k, bell);
      const h = Math.floor(zn / 2);
      const P = concat(
        line([side * 1.5, 1.8, -1.8], [0.0, 1.7, -1.5], h),
        line([0.0, 1.7, -1.5], [-side * 1.5, 1.6, -1.8], zn - h),
      );
      m.add(`arc-zip${k}`, z, t - 0.08, P, { target: -15, kind: 'i', sendDb: -12 });
    });
    m.add(
      'arc-hum',
      hum(t0, t1, 3430, [
        [t0, 0.0],
        [47.6, 0.3],
        [48.3, 0.3],
        [48.45, 0.5],
        [49.3, 0.7],
        [t1, 0.0],
      ]),
      t0,
      GIANT,
      { target: -21, kind: 'm', sendDb: -8 },
    );
  });
}

// ---- 49.42 to 55.81: the second bolt. One discharge, laid shot by shot: close on the giant, wide
// from the side, from above, behind the pillar, from above again as it thins. Branches strike
// from the vault while it streams.
const B2 = 49.42;
const B3 = 55.81;
function bolt2(m: Mix): void {
  m.part('bolt2', () => {
    const [c, th] = strike(3500, 1.0);
    m.add('b2-crack', c, B2, [0.4, 1.8, -3.5], {
      target: -6,
      kind: 'i',
      focusDb: 3,
      sendDb: -14,
    });
    m.add('b2-thump', th, B2, [0.0, 0.5, -3.5], {
      target: -10,
      kind: 'i',
      focusDb: 3,
      sendDb: -16,
    });
    const T1 = B3 + 0.05;
    const p = plasma(B2, T1, 3510, [
      [B2, 1.0],
      [49.9, 0.9],
      [52.9, 0.85],
      [54.6, 0.8],
      [55.4, 0.35],
      [55.75, 0.3],
      [T1, 0.0],
    ]);
    across(
      m,
      'b2-plasma',
      p,
      B2,
      [
        {
          from: B2,
          to: 49.93,
          pos: [0.3, 1.6, -3.5],
          opts: { target: -13, kind: 'm', sendDb: -8 },
        },
        {
          from: 49.93,
          to: 52.93,
          pos: [1.5, 1.5, -9.0],
          opts: { target: -16, kind: 'm', sendDb: -4 },
        },
        {
          from: 52.93,
          to: 53.6,
          pos: [0.5, -2.0, -8.0],
          opts: { target: -16, kind: 'm', sendDb: -4 },
        },
        {
          from: 53.6,
          to: 54.2,
          pos: [0.5, -2.0, -14.0],
          opts: { target: -24, kind: 'm', sendDb: 0 },
        },
        {
          from: 54.2,
          to: B3,
          pos: [0.5, -2.0, -9.0],
          opts: { target: -18, kind: 'm', sendDb: -4 },
        },
      ],
      0.12,
      0.08,
    );
    // the branches from the vault, in the wide shot, and the streak that passes close at 53.48
    (
      [
        [50.59, [2.5, 6.0, -10.0], -10],
        [51.18, [3.5, 6.0, -11.0], -11],
        [51.51, [-1.0, 6.0, -10.0], -12],
        [52.39, [2.0, 6.0, -9.0], -10],
        [52.72, [4.0, 6.0, -11.0], -9],
        [53.48, [2.0, 2.0, -2.5], -8],
      ] as [number, Vec3, number][]
    ).forEach(([t, pos, tg], k) => {
      const [bc, bt] = strike(3530 + 10 * k, 0.8);
      m.add(`b2-branch${k}`, bc, t, pos, {
        target: tg,
        kind: 'i',
        focusDb: 2,
        sendDb: -6,
      });
      m.add(`b2-branch${k}-thump`, bt, t, pos, {
        target: tg - 4,
        kind: 'i',
        sendDb: -6,
      });
    });
  });
}

// ---- 54.80 to 55.78: the voltage gathers again (scene 2's "wooo-woong"), held 30 ms before the
// third release, as the first release was held.
function gather2(m: Mix): void {
  m.part('gather2', () => {
    const t0 = 54.6;
    m.addWide(
      'g2-hum',
      (() => {
        const h = hum(t0, B3, 3600, [
          [t0, 0.0],
          [54.9, 0.3],
          [55.5, 0.7],
          [55.74, 1.0],
          [55.76, 0.1],
          [B3 - 0.002, 0.1],
          [B3, 0.0],
        ]);
        return [h, h] as Stereo;
      })(),
      t0,
      { target: -15, kind: 'm', sendDb: -6 },
    );
  });
}

// ---- 55.81 to 56.95: the third bolt, close, on the small barrier in the cloud; jagged strikes;
// the barrier strains under it.
const BLAST = 56.95;
function bolt3(m: Mix): void {
  m.part('bolt3', () => {
    const [c, th] = strike(3700, 1.2);
    m.add('b3-crack', c, B3, [0.0, 1.8, -3.0], {
      target: -5,
      kind: 'i',
      focusDb: 3,
      sendDb: -14,
    });
    m.add('b3-thump', th, B3, [0.0, 0.5, -3.0], {
      target: -9,
      kind: 'i',
      focusDb: 3,
      sendDb: -16,
    });
    const T1 = BLAST + 0.03;
    const p = plasma(
      B3,
      T1,
      3710,
      [
        [B3, 1.0],
        [56.5, 0.9],
        [56.9, 1.0],
        [T1, 0.0],
      ],
      6500,
    );
    m.add('b3-plasma', fade(p, 0.004, 0.02), B3, [0.0, 1.5, -3.0], {
      target: -12,
      kind: 'm',
      sendDb: -8,
    });
    [56.53, 56.62, 56.78].forEach((t, k) => {
      const [jc, jt] = strike(3720 + 10 * k, 0.9, 0.08);
      m.add(`b3-jag${k}`, jc, t, [k === 1 ? -1.5 : 1.5, 1.8, -3.0], {
        target: -9,
        kind: 'i',
        sendDb: -10,
      });
      m.add(`b3-jag${k}-thump`, jt, t, [0.0, 0.5, -3.0], {
        target: -14,
        kind: 'i',
      });
    });
    const strain = S.gravel(BLAST - 55.95, 3750, 150, 500);
    const se = env(
      [
        [55.95, 0],
        [56.1, 1],
        [56.9, 1],
        [BLAST, 0],
      ],
      55.95,
      strain.length,
    );
    m.add(
      'b3-barrier-strain',
      strain.map((v, i) => v * se[i]!),
      55.95,
      [0.0, 1.5, -3.5],
      { target: -20, kind: 'm', sendDb: -6 },
    );
  });
}

// ---- 56.95: the blast. The climax, low and heavy: a full-band crack, the overpressure, a deep
// boom that lasts, a roll of low rumble through the hall, the blast of air; the giant's stone
// breaks in it.
function blast(m: Mix): void {
  m.part('blast', () => {
    const [c] = strike(3800, 2.0, 0.15);
    m.add('blast-crack', c, BLAST, [0.0, 1.5, -4.0], {
      target: -5,
      kind: 'i',
      focusDb: 3,
      sendDb: -10,
    });
    const [front, low] = S.whump(3801, 0.02, 1.2);
    const press = new Float64Array(nsamp(1.2));
    addAt(press, front, 0, 1.0);
    addAt(press, low, 0, 0.8);
    m.add('blast-pressure', S.saturate(press, 2.0), BLAST, [0.0, 0.5, -4.0], {
      target: -8,
      kind: 'i',
      focusDb: 3,
      sendDb: -10,
    });
    m.add('blast-boom', S.boom(3802, { f: 34.0, tau: 0.9, dur: 3.0 }), BLAST, [0.0, 0.0, -5.0], {
      target: -9,
      kind: 'i',
      sendDb: -6,
    });
    const roll = S.billow(3.2, 3803, 30.0, 140.0, 3.0);
    const re = env(
      [
        [BLAST, 0.0],
        [BLAST + 0.08, 1.0],
        [BLAST + 0.8, 0.6],
        [BLAST + 3.2, 0.0],
      ],
      BLAST,
      roll[0].length,
    );
    m.addWide(
      'blast-roll',
      [roll[0].map((v, i) => v * re[i]!), roll[1].map((v, i) => v * re[i]!)],
      BLAST,
      {
        target: -16,
        kind: 'm',
        sendDb: -4,
      },
    );
    const air = S.puff(1.6, 3804, 150.0, 6000.0, 0.01, 0.45);
    m.addWide('blast-air', [lp2(air[0], 9000), lp2(air[1], 9000)], BLAST, {
      target: -16,
      kind: 'i',
    });
    m.add(
      'blast-stone',
      lp2(S.heavyCrack(3805, { size: 3.0, dur: 0.6, kRate: 6, bright: 0.4 }), 12000),
      BLAST + 0.02,
      [0.5, 1.0, -5.0],
      { target: -12, kind: 'i', sendDb: -6 },
    );
  });
}

// ---- 57.22 to 57.95: dark arcs crawl over the floor as the blast clears, and die.
function residue(m: Mix): void {
  m.part('residue', () => {
    const t0 = 57.2;
    const dur = 0.85;
    const n = nsamp(dur);
    const dw = S.levelWalk(n, 3901, 4.0, 2.0, 10.0);
    const d = new Float64Array(n).map((_, i) =>
      Math.min(1, 0.7 * Math.exp(-i / SR / 0.3) * dw[i]!),
    );
    const ck = arcCrackle(dur, 3900, d);
    m.add('residue-crackle', fade(lp2(ck, 6000), 0.01, 0.15), t0, [-1.0, 0.0, -4.0], {
      target: -22,
      kind: 'm',
      sendDb: -6,
    });
  });
}

// ---- 57.72 to 62.27: the dust settles round her; white streaks of wind whirl round her (59.0 to
// 60.2), and in the close shot her hair blows.
function after(m: Mix): void {
  m.part('after', () => {
    const t0 = 57.6;
    const dur = SCENE3_END + 1.0 - t0;
    const ds = S.dust(dur, 4000, {
      lo: 800.0,
      hi: 7000.0,
      sd: 2.0,
      grain: 0.3,
    });
    const de = env(
      [
        [t0, 0.0],
        [57.9, 1.0],
        [59.0, 0.6],
        [60.3, 0.35],
        [SCENE3_END + 1.0, 0.25],
      ],
      t0,
      ds[0].length,
    );
    m.addWide(
      'settle-dust',
      [ds[0].map((v, i) => v * de[i]!), ds[1].map((v, i) => v * de[i]!)],
      t0,
      {
        target: -31,
        kind: 'm',
        sendDb: -4,
      },
    );
    // the whirl: gusts that sweep round her at irregular times, each on its own path
    (
      [
        [59.02, -1, 0.45],
        [59.3, 1, 0.4],
        [59.57, -1, 0.5],
        [59.86, 1, 0.42],
        [60.12, -1, 0.5],
      ] as const
    ).forEach(([t, side, d], k) => {
      const g = S.wind(d, 4010 + k, 300, 3500);
      const sh = env(
        [
          [0, 0],
          [0.45 * d, 1],
          [d, 0],
        ],
        0,
        g[0].length,
      );
      const x = g[0].map((v, i) => v * sh[i]!);
      const h = Math.floor(x.length / 2);
      const P = concat(
        line([side * 3.0, 1.5, -3.0], [0.0, 1.6, -1.2], h),
        line([0.0, 1.6, -1.2], [-side * 3.0, 1.7, -2.5], x.length - h),
      );
      m.add(`whirl${k}`, x, t - 0.45 * d, P, {
        target: -24,
        kind: 'i',
        sendDb: -8,
      });
    });
    // her face: the wind in her hair, from the end of the whirl through the close shot
    const hw = S.wind(SCENE3_END + 1.0 - 59.9, 4020, 400, 4000);
    const he = env(
      [
        [59.9, 0.0],
        [60.3, 1.0],
        [61.5, 0.8],
        [SCENE3_END + 1.0, 0.7],
      ],
      59.9,
      hw[0].length,
    );
    m.addWide(
      'hair-wind',
      [hw[0].map((v, i) => v * he[i]!), hw[1].map((v, i) => v * he[i]!)],
      59.9,
      {
        target: -25,
        kind: 'm',
      },
    );
    m.add('hair-cloth', fade(S.cloth(1.9, 4021, 260), 0.3, 0.4), 60.35, [0.3, 1.5, -0.8], {
      target: -33,
      kind: 'm',
      sendDb: -10,
    });
  });
}

/** Scene 3, the lightning: from scene 2's tail to the cut before the next attack. */
export function scene3(): Mix {
  const m = new Mix('scene3', SCENE3_FROM, SCENE3_END, 2.0);
  m.until = SCENE3_END;
  beds(m);
  bed3(m);
  charge(m);
  scene3Head(m);
  bolt(m);
  crawl(m);
  bolt2(m);
  gather2(m);
  bolt3(m);
  blast(m);
  residue(m);
  after(m);
  m.finish(tidy3);
  // scene 2's review 9: its noise layers and cracks lose their harsh top
  m.eachLayer('scene3-low-pass', lowPass);
  m.driveDb = 8.8;
  m.fixedMaster = SCENE1_MASTER;
  m.afterDb = [
    [SCENE3_FROM, 0],
    [SCENE3_END, 0],
    [SCENE3_END + 0.7, -60],
  ];
  return m;
}
