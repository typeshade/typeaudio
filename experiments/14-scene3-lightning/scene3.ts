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
  iir,
  lp,
  nsamp,
  rbj,
  rng,
  spectral,
  type Stereo,
  type Vec3,
} from '../../src/study/dsp.ts';
import { Mix, type Layer } from '../../src/study/mix.ts';
import { BOLD, CEILING_DBTP, LIFT, body, scaleLayer } from '../../src/study/presence.ts';
import { concat, line, steady } from '../../src/study/passage.ts';
import * as S from '../../src/study/sources.ts';
import {
  MAIN2,
  SCENE1_MASTER,
  across,
  beds,
  bolt,
  charge,
  drop,
  env,
  landing,
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
    m.addWide('bed3', S.hallAir(dur, 301), t0, { target: -43.0, kind: 'a' });
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

// ---- Review 1, 2026-11-11 (render r1). The owner: "I can tell it's attacking, but it feels too
// repetitive, and it's boring." Each attack now has its own colour and the three climb: the first
// bolt is the whip (scene 2's head); the second is a pillar from above with rolling, cracking
// thunder that changes with each shot; the third and the blast are the climax. Between them the
// level drops into valleys, and before the climax it holds its breath. What repeated with no new
// picture event is cut: two of five strikes from the vault, two of five snaps, one of three zips.

interface Shot {
  readonly from: number;
  readonly to: number;
  readonly sig: Float64Array;
  readonly pos: Vec3;
  readonly target: number;
  readonly sendDb: number;
}

/**
 * One event laid shot by shot, as `across` does, but each shot hears its own version of the same
 * signal (all start at `t0` and run together): the perspective changes, the source does not.
 */
function shots(m: Mix, name: string, t0: number, parts: readonly Shot[], xf = 0.12): void {
  parts.forEach((p, k) => {
    const first = k === 0;
    const last = k === parts.length - 1;
    const a = Math.max(t0, p.from - (first ? 0 : xf / 2));
    const b = p.to + (last ? 0.15 : xf / 2);
    const ia = nsamp(a - t0);
    const ib = Math.min(p.sig.length, nsamp(b - t0));
    if (ib - ia < 2) return;
    const x = p.sig.slice(ia, ib);
    const fin = first ? nsamp(0.01) : nsamp(xf);
    const fout = last ? nsamp(0.15) : nsamp(xf);
    for (let i = 0; i < Math.min(fin, x.length); i++)
      x[i] = x[i]! * Math.sin((0.5 * Math.PI * (i + 0.5)) / fin);
    for (let i = 0; i < Math.min(fout, x.length); i++) {
      const j = x.length - fout + i;
      if (j >= 0) x[j] = x[j]! * Math.cos((0.5 * Math.PI * (i + 0.5)) / fout);
    }
    m.add(`${name}${k}`, x, a, p.pos, { target: p.target, kind: 'm', sendDb: p.sendDb });
  });
}

// ---- 47.50 to 49.42: the valley after the first bolt. The giant's stone stays charged: a sparse
// tick of crackle and a low hum that rises a little toward the second bolt. One charged fragment
// streaks past (48.07); one arc snaps dry from below (48.40); one arc crawls down from above,
// bright and longer (48.98).
const GIANT: Vec3 = [1.0, 1.6, -4.0];
function crawl(m: Mix): void {
  m.part('crawl', () => {
    const t0 = 47.5;
    const t1 = 49.45;
    const n = nsamp(t1 - t0);
    const dw = S.levelWalk(n, 3410, 5.0, 1.0, 8.0);
    // the owner's rule (2026-11-11): sparse ticks read as pebbles; the charged stone is a faint,
    // smooth corona (2 to 7 kHz) at a level that wanders
    const cor = lp2(S.wideNoise(t1 - t0, 3400, 2000, 7000, 2, false)[0], 7500);
    const d = new Float64Array(n).map((_, i) => cor[i]! * Math.min(1.5, dw[i]!));
    m.add('arc-ticks', fade(d, 0.05, 0.05), t0, GIANT, {
      target: -27,
      kind: 'm',
      sendDb: -8,
    });
    // 48.40: a dry snap from below, small and to the right
    const [snap] = strike(3420, 0.4, 0.04);
    m.add('arc-snap', snap, 48.4, [2.0, 0.6, -4.5], { target: -17, kind: 'i', sendDb: -10 });
    // 48.98: an arc crawls down the stone from above: a crackle that runs for 0.35 s, a soft knock
    const cn = nsamp(0.38);
    const ce = new Float64Array(cn).map((_, i) => {
      const t = i / SR;
      return t < 0.01 ? t / 0.01 : Math.exp(-(t - 0.01) / 0.14);
    });
    const crawlArc = arcCrackle(0.38, 3425, ce).map((v, i) => v * Math.sqrt(ce[i]!));
    m.add('arc-crawl', crawlArc, 48.98, line([0.2, 2.6, -4.0], [0.8, 0.8, -4.0], cn), {
      target: -15,
      kind: 'i',
      sendDb: -8,
    });
    m.add('arc-crawl-knock', S.boom(3426, { f: 55.0, tau: 0.08, dur: 0.3 }), 48.98, GIANT, {
      target: -21,
      kind: 'i',
    });
    // 48.07: the largest charged fragment streaks past, at about 19 m/s
    const zn = nsamp(0.16);
    const bell = new Float64Array(zn).map((_, i) => Math.sin((Math.PI * i) / zn) ** 2);
    const h = Math.floor(zn / 2);
    m.add(
      'arc-zip',
      arcCrackle(0.16, 3441, bell),
      48.07 - 0.08,
      concat(
        line([1.5, 1.8, -1.8], [0.0, 1.7, -1.5], h),
        line([0.0, 1.7, -1.5], [-1.5, 1.6, -1.8], zn - h),
      ),
      { target: -20, kind: 'i', sendDb: -12 },
    );
    m.add(
      'arc-hum',
      hum(t0, t1, 3430, [
        [t0, 0.0],
        [47.8, 0.25],
        [49.0, 0.35],
        [49.35, 0.5],
        [t1, 0.0],
      ]),
      t0,
      GIANT,
      { target: -27, kind: 'm', sendDb: -8 },
    );
  });
}

// ---- 49.42 to 55.30: the second attack, doubled: a bolt from above and two beams, and their
// rolling thunder. Each shot hears its own version of each beam:
//   close (to 49.93)    the pillar itself, its crackle in front
//   wide (to 52.93)     big and roomy: the thunder rolls and cracks through the hall
//   above (to 53.60)    heavy weight downward: the low body, the top dulled
//   pillar (to 54.20)   behind the stone: occluded, lower, muffled
//   thinning (to 55.3)  it frays: the torrent falls away and the crackle breaks up and stops
// Two strikes from the vault, each its own: far left and roomy (50.59); near right, sharp (52.72).
const B2 = 49.42;
const B3 = 55.81;
function bolt2(m: Mix): void {
  m.part('bolt2', () => {
    // the pillar lands: a deep crack from above and a long low weight
    const pc = new Float64Array(nsamp(0.6));
    addAt(pc, S.tiltedBurst(3500, 150.0, 9000.0, 0.06, { tilt: 0.6, rise: 0.001 }), 0, 1.0);
    addAt(
      pc,
      S.heavyCrack(3501, { size: 3.0, dur: 0.4, kRate: 9, bright: 0.6 }).subarray(0, pc.length),
      0,
      0.9,
    );
    m.add('b2-pillar', lp2(cut(S.saturate(pc, 1.8), 0.3), 10000), B2, [0.3, 3.0, -4.0], {
      target: -7,
      kind: 'i',
      focusDb: 3,
      sendDb: -8,
    });
    // review 2: the attack goes out doubled (frames at 24 a second: at 49.425 s a bolt drops from
    // above and two thick beams strike the giant together, the upper from the left, the lower
    // curling up from below 40 ms later; dark pieces of its stone fly at 49.55 to 49.7 s). Two
    // sources, each its own impact: a long low weight under each, the second deeper and longer.
    const weight = (seed: number, f: number, tau: number, dur: number) => {
      const [front, low] = S.whump(seed, 0.012, dur);
      const w = new Float64Array(nsamp(dur));
      addAt(w, front, 0, 0.8);
      addAt(w, low, 0, 0.8);
      addAt(w, S.boom(seed + 1, { f, tau, dur }), 0, 1.0);
      return S.saturate(w, 1.8);
    };
    m.add('b2-weight', weight(3502, 32.0, 0.3, 0.7), B2, [-1.5, 1.5, -4.0], {
      target: -9,
      kind: 'i',
      focusDb: 3,
      sendDb: -8,
    });
    const BB = B2 + 0.04;
    m.add('b2-weight-b', weight(3504, 27.0, 0.4, 0.9), BB, [1.2, 0.5, -3.5], {
      target: -10,
      kind: 'i',
      focusDb: 3,
      sendDb: -6,
    });
    // the destruction: the giant's stone splits under the two beams, and large chunks break off
    // (49.55 to 49.7 s); two of them land far off in the wide shot
    m.add(
      'b2-stone-split',
      lp2(S.heavyCrack(3570, { size: 4.0, dur: 0.7, kRate: 5, bright: 0.35 }), 10000),
      49.48,
      [0.8, 1.6, -4.0],
      { target: -10, kind: 'i', focusDb: 2, sendDb: -6 },
    );
    (
      [
        [49.58, [1.8, 2.4, -4.5], 1.4],
        [49.7, [-0.6, 2.8, -5.0], 1.2],
      ] as [number, Vec3, number][]
    ).forEach(([tc, pos, size], k) => {
      const c = new Float64Array(nsamp(0.9));
      addAt(c, S.heavyCrack(3572 + k, { size, dur: 0.5, kRate: 4, bright: 0.3 }), 0, 1.0);
      addAt(c, S.boom(3574 + k, { f: 70.0 / size ** 0.3, tau: 0.25, dur: 0.9 }), 0, 0.8);
      m.add(`b2-chunk${k}`, lp2(S.norm(c), 9000), tc, pos, {
        target: landing(size) - 3,
        kind: 'i',
        sendDb: -6,
      });
    });
    const T1 = 55.4;
    const dur = T1 - B2;
    const n = nsamp(dur);
    const lv: Points = [
      [B2, 1.0],
      [49.9, 0.9],
      [52.9, 0.8],
      [54.2, 0.7],
      [54.7, 0.35],
      [55.1, 0.1],
      [T1, 0.0],
    ];
    // the two beams: the upper a brighter roar with more crackle, the lower a dark heavy roar
    // review 4: the upper beam brighter, 7 dB more above 2.5 kHz (still under 10 kHz)
    const dnA = S.norm(
      lp2(iir(plasma(B2, T1, 3510, lv, 5500), [rbj('hs', 2500, 0.7071, 7)]), 10000),
    );
    const rawB = plasma(B2, T1, 3515, lv, 2000);
    const bodyB = S.norm(S.billow(dur, 3516, 28.0, 110.0, 2.0)[0]);
    const lowB = S.norm(lp2(rawB, 3000));
    // the lower beam lands 40 ms after the upper
    const dB = new Float64Array(n).map((_, i) =>
      i < nsamp(0.04) ? 0 : lowB[i]! + 0.25 * bodyB[i]!,
    );
    // the thunder: a low roll with no period, and cracks at irregular times that grow fewer
    const roll = S.billow(dur, 3520, 25.0, 180.0, 4.0)[0];
    const r = rng(3521);
    const thunder = S.norm(roll).map((v) => 0.8 * v);
    let t = 0.25;
    let k = 0;
    while (t < dur - 0.6) {
      const c = S.heavyCrack(3530 + k, { size: 2.0, dur: 0.5, kRate: 7, bright: 0.25 });
      addAt(
        thunder,
        lp2(c, 2500).subarray(0, Math.min(c.length, n - nsamp(t))),
        nsamp(t),
        0.9 * Math.exp(-t / 4.0),
      );
      t += r.uniform(0.35, 0.9) * (1 + t / 3.0);
      k++;
    }
    const tn = S.norm(thunder);
    const level = env(
      [
        [B2, 1.0],
        [54.2, 0.8],
        [54.8, 0.3],
        [T1, 0.0],
      ],
      B2,
      n,
    );
    const dbn = S.norm(dB);
    const wideA = new Float64Array(n).map((_, i) => (dnA[i]! + 0.4 * tn[i]!) * level[i]!);
    const wideB = new Float64Array(n).map((_, i) => (0.6 * dbn[i]! + 1.0 * tn[i]!) * level[i]!);
    // the frayed end: the upper beam's crackle breaks into bursts that thin out; the lower fades
    const fd = S.levelWalk(n, 3540, 8.0, 2.0, 9.0);
    const fray = arcCrackle(
      dur,
      3541,
      new Float64Array(n).map((_, i) => {
        const tt = B2 + i / SR;
        const e = tt < 54.2 ? 0 : tt < 55.25 ? 0.5 * (1 - (tt - 54.2) / 1.05) : 0;
        return Math.min(1, e * fd[i]! ** 2);
      }),
    );
    const thinA = new Float64Array(n).map((_, i) => 0.5 * dnA[i]! + 0.8 * fray[i]!);
    // each beam laid shot by shot: close, wide (both to the giant at the right, apart), from above,
    // behind the pillar, thinning
    shots(m, 'b2a', B2, [
      { from: B2, to: 49.93, sig: dnA, pos: [-4.0, 2.0, -2.5], target: -13, sendDb: -10 },
      { from: 49.93, to: 52.93, sig: wideA, pos: [-5.0, 5.0, -9.0], target: -18, sendDb: -8 },
      {
        from: 52.93,
        to: 53.6,
        sig: lp2(wideA, 900),
        pos: [-1.5, -3.0, -5.0],
        target: -20,
        sendDb: -10,
      },
      {
        from: 53.6,
        to: 54.2,
        sig: lp2(wideA, 300),
        pos: [-1.5, -3.0, -9.0],
        target: -30,
        sendDb: -10,
      },
      { from: 54.2, to: T1, sig: thinA, pos: [-1.0, -3.0, -8.0], target: -22, sendDb: -10 },
    ]);
    shots(m, 'b2b', B2, [
      { from: B2, to: 49.93, sig: dbn, pos: [4.0, 0.8, -2.5], target: -12, sendDb: -10 },
      { from: 49.93, to: 52.93, sig: wideB, pos: [6.0, 4.0, -10.0], target: -17, sendDb: -8 },
      {
        from: 52.93,
        to: 53.6,
        sig: lp2(wideB, 600),
        pos: [1.5, -3.0, -5.0],
        target: -17,
        sendDb: -10,
      },
      {
        from: 53.6,
        to: 54.2,
        sig: lp2(wideB, 300),
        pos: [1.5, -3.0, -9.0],
        target: -27,
        sendDb: -10,
      },
      { from: 54.2, to: 55.0, sig: wideB, pos: [1.0, -3.0, -8.0], target: -24, sendDb: -10 },
    ]);
    // the two strikes from the vault
    const far = new Float64Array(nsamp(1.4));
    addAt(far, S.tiltedBurst(3550, 200.0, 8000.0, 0.05, { tilt: 0.7 }), 0, 1.0);
    addAt(far, S.heavyCrack(3551, { size: 2.5, dur: 0.5, kRate: 6, bright: 0.3 }), 0.0, 0.8);
    addAt(
      far,
      S.billow(1.2, 3552, 30.0, 150.0, 2.0)[0].map((v, i) => v * Math.exp(-i / SR / 0.35)),
      nsamp(0.06),
      0.25,
    );
    m.add('b2-vault-far', lp2(S.norm(far), 8000), 50.59, [-5.0, 7.0, -15.0], {
      target: -12,
      kind: 'i',
      focusDb: 2,
      sendDb: 0,
    });
    const near = new Float64Array(nsamp(0.4));
    addAt(near, S.tiltedBurst(3560, 600.0, 12000.0, 0.012, { tilt: 0.2, rise: 0.0002 }), 0, 1.0);
    addAt(near, S.sizzle(0.25, 3561, 0.05, 5000.0, 2500.0, 10000.0), 0, 0.5);
    m.add('b2-vault-near', lp2(cut(S.saturate(near, 2.2), 0.08), 12000), 52.72, [3.0, 4.0, -6.0], {
      target: -9,
      kind: 'i',
      focusDb: 2,
      sendDb: -10,
    });
  });
}

// ---- 55.30 to 55.81: near silence. Only the voltage gathers, low and close, and is held for the
// last 60 ms before the third release.
function gather2(m: Mix): void {
  m.part('gather2', () => {
    const t0 = 55.0;
    const h = hum(t0, B3, 3600, [
      [t0, 0.0],
      [55.3, 0.25],
      [55.62, 0.6],
      [55.74, 0.9],
      [55.75, 0.05],
      [B3 - 0.002, 0.05],
      [B3, 0.0],
    ]);
    m.addWide('g2-hum', [h, h] as Stereo, t0, { target: -22, kind: 'm', sendDb: -10 });
  });
}

// ---- 55.81 to 57.22: the climax. The third release is the widest crack yet, two tears apart left
// and right over a very low thump; the bolts converge, their crackle and a low pressure climbing
// together for a second; one jagged strike (56.62); 50 ms of suction; then the white blast.
const BLAST = 56.95;
function bolt3(m: Mix): void {
  m.part('bolt3', () => {
    ([-1, 1] as const).forEach((side, j) => {
      const c = new Float64Array(nsamp(0.5));
      addAt(c, S.tiltedBurst(3700 + j, 200.0, 12000.0, 0.04, { tilt: 0.35, rise: 0.0003 }), 0, 1.0);
      addAt(
        c,
        S.heavyCrack(3702 + j, { size: 3.0, dur: 0.3, kRate: 12, bright: 0.8 }).subarray(
          0,
          c.length,
        ),
        0,
        0.9,
      );
      m.add(
        `b3-release${j}`,
        lp2(cut(S.saturate(c, 2.0), 0.18), 12000),
        B3 + 0.018 * j,
        [side * 2.5, 2.0, -3.0],
        {
          target: -9,
          kind: 'i',
          focusDb: 3,
          sendDb: -10,
        },
      );
    });
    m.add('b3-thump', S.boom(3705, { f: 34.0, tau: 0.3, dur: 0.8 }), B3, [0.0, 0.0, -3.0], {
      target: -8,
      kind: 'i',
      focusDb: 3,
    });
    // the convergence: denser and louder toward the blast, then sucked in 50 ms before it
    const T1 = BLAST;
    const dur = T1 - B3;
    const n = nsamp(dur);
    const climb = env(
      [
        [B3, 0.55],
        [56.3, 0.6],
        [56.88, 1.0],
        [56.9, 0.08],
        [T1, 0.0],
      ],
      B3,
      n,
    );
    // review 2: the beams come from both sides at once (24 frames a second: from 55.87 s thick
    // beams from the left and the right converge on the barrier): one source for each side
    const press = S.norm(S.billow(dur, 3711, 28.0, 120.0, 1.5)[0]);
    ([-1, 1] as const).forEach((side, j) => {
      const ck = arcCrackle(
        dur,
        3710 + 10 * j,
        new Float64Array(n).map((_, i) => 0.3 + 0.7 * (i / n) ** 1.5),
      );
      const dis = S.norm(
        plasma(
          B3,
          T1,
          3712 + 10 * j,
          [
            [B3, 1.0],
            [T1, 1.0],
          ],
          6500,
        ),
      );
      const conv = new Float64Array(n).map(
        (_, i) => (0.6 * dis[i]! + 0.6 * ck[i]! + (0.6 + 1.2 * (i / n)) * press[i]!) * climb[i]!,
      );
      m.add(`b3-converge${j}`, fade(conv, 0.004, 0.003), B3, [side * 3.0, 1.5, -3.0], {
        target: -14,
        kind: 'm',
        sendDb: -8,
      });
    });
    // 56.62 s: walls of jagged lightning rise on both sides, the right 25 ms after the left
    ([-1, 1] as const).forEach((side, j) => {
      const jag = new Float64Array(nsamp(0.4));
      addAt(
        jag,
        S.tiltedBurst(3720 + 5 * j, 400.0, 12000.0, 0.02, { tilt: 0.25, rise: 0.0002 }),
        0,
        1.0,
      );
      addAt(
        jag,
        S.heavyCrack(3721 + 5 * j, { size: 1.0, dur: 0.2, kRate: 16, bright: 1.0 }).subarray(
          0,
          jag.length,
        ),
        0,
        0.7,
      );
      m.add(
        `b3-jag${j}`,
        lp2(cut(S.saturate(jag, 2.0), 0.1), 12000),
        56.617 + 0.025 * j,
        [side * 2.5, 2.5, -2.5],
        {
          target: -14,
          kind: 'i',
          sendDb: -10,
        },
      );
    });
    const strain = S.gravel(0.95, 3750, 150, 500);
    const se = env(
      [
        [55.95, 0],
        [56.1, 0.7],
        [56.88, 1],
        [56.9, 0],
      ],
      55.95,
      strain.length,
    );
    m.add(
      'b3-barrier-strain',
      strain.map((v, i) => v * se[i]!),
      55.95,
      [0.0, 1.5, -3.5],
      {
        target: -22,
        kind: 'm',
        sendDb: -6,
      },
    );
  });
}

// ---- 56.95: the white blast, the largest sound of the scene: a crack on both sides, the
// overpressure, a boom at 38 Hz that lasts, the giant's stone that breaks, the blast of air; then
// its roll goes away through the hall for four seconds.
function blast(m: Mix): void {
  m.part('blast', () => {
    ([-1, 1] as const).forEach((side, j) => {
      const [c] = strike(3800 + 10 * j, 2.5, 0.2);
      m.add(`blast-crack${j}`, c, BLAST + 0.006 * j, [side * 1.8, 1.5, -4.0], {
        target: -9,
        kind: 'i',
        focusDb: 3,
        sendDb: -8,
      });
    });
    const [front, low] = S.whump(3801, 0.025, 1.5);
    const press = new Float64Array(nsamp(1.5));
    addAt(press, front, 0, 1.0);
    addAt(press, low, 0, 0.8);
    m.add('blast-pressure', S.saturate(press, 2.0), BLAST, [0.0, 0.5, -4.0], {
      target: -10,
      kind: 'i',
      focusDb: 3,
      sendDb: -10,
    });
    m.add('blast-boom', S.boom(3802, { f: 38.0, tau: 0.7, dur: 2.5 }), BLAST, [0.0, 0.0, -5.0], {
      target: -9,
      kind: 'i',
      sendDb: -4,
    });
    const roll0 = S.billow(4.6, 3803, 25.0, 160.0, 3.0);
    // review 5 (clarity): mostly the same in both channels
    const roll: Stereo = [roll0[0], roll0[0].map((v, i) => 0.7 * v + 0.3 * roll0[1][i]!)];
    const re = env(
      [
        [BLAST, 0.0],
        [BLAST + 0.1, 1.0],
        [BLAST + 1.0, 0.55],
        [BLAST + 2.5, 0.2],
        [BLAST + 4.6, 0.0],
      ],
      BLAST,
      roll[0].length,
    );
    m.addWide(
      'blast-roll',
      [roll[0].map((v, i) => v * re[i]!), roll[1].map((v, i) => v * re[i]!)],
      BLAST,
      {
        target: -10,
        kind: 'm',
        sendDb: -6,
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

// ---- 57.22 to 62.27: the relief. The blast's roll goes away; a few dark arcs die on the floor;
// the dust settles, quiet; three streaks of wind sweep round her; in the close shot the wind in
// her hair.
function after(m: Mix): void {
  m.part('after', () => {
    const rn = nsamp(0.6);
    // the dark arcs die on the floor as a fizz (no isolated ticks, which read as pebbles): noise of
    // 1.5 to 6 kHz with a fast level that has no period
    const fz = S.wideNoise(0.6, 3900, 1500, 6000, 2, false)[0];
    const fm = S.irregular(rn, 3901, 20, 90);
    const rd = new Float64Array(rn).map(
      (_, i) => fz[i]! * (0.6 + 0.4 * fm[i]!) * Math.exp(-i / SR / 0.18),
    );
    m.add('residue-crackle', fade(lp2(rd, 6000), 0.01, 0.15), 57.25, [-1.0, 0.0, -4.0], {
      target: -27,
      kind: 'm',
      sendDb: -6,
    });
    const t0 = 57.8;
    const dur = SCENE3_END + 1.0 - t0;
    const ds = S.dust(dur, 4000, { lo: 800.0, hi: 6500.0, sd: 2.0, grain: 0.3 });
    const de = env(
      [
        [t0, 0.0],
        [58.4, 1.0],
        [59.5, 0.6],
        [60.3, 0.3],
        [SCENE3_END + 1.0, 0.2],
      ],
      t0,
      ds[0].length,
    );
    m.addWide(
      'settle-dust',
      [ds[0].map((v, i) => v * de[i]!), ds[1].map((v, i) => v * de[i]!)],
      t0,
      {
        target: -36,
        kind: 'm',
        sendDb: -4,
      },
    );
    (
      [
        [59.05, -1, 0.5],
        [59.57, 1, 0.45],
        [60.12, -1, 0.55],
      ] as const
    ).forEach(([t, side, d], k) => {
      const g = S.wind(d, 4010 + 2 * k, 300, 3500);
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
      m.add(`whirl${k}`, x, t - 0.45 * d, P, { target: -27 + 2 * k, kind: 'i', sendDb: -8 });
    });
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
        target: -26,
        kind: 'm',
      },
    );
    // the owner's rule (2026-11-11): the cloth model's flutter reads as pebbles; her hair is air
    const hair = steady(1.9, 4021, 700, 5000);
    const hi = S.irregular(hair.length, 4022, 2, 9);
    m.add(
      'hair-cloth',
      fade(
        hair.map((v, i) => v * (0.6 + 0.4 * hi[i]!)),
        0.3,
        0.4,
      ),
      60.35,
      [0.3, 1.5, -0.8],
      {
        target: -33,
        kind: 'm',
        sendDb: -10,
      },
    );
  });
}

/**
 * The presence pass (`src/study/presence.ts`): the main events get the body of 120 Hz to 2 kHz:
 * scene 2's that sound here (its charge and its bolt) and this scene's arcs, bolts, thunder, the
 * strikes from the vault, the gathering, the climax and the blast; not the air, the dust or the wind.
 */
const MAIN3 =
  /^(arc-(snap|crawl|hum)|b2-(pillar|weight|vault|stone|chunk)|b2[ab]\d+$|b[23]x-(sub|body|roll|crash|core)|g2-hum|b3-(release|thump|converge|jag|barrier)|blast-(crack|pressure|boom|roll|stone))/;
function presence3(_m: Mix, name: string, l: Layer): void {
  if (MAIN2.test(name) || MAIN3.test(name)) body(l);
}

type Crash = readonly [number, Vec3, number];

/**
 * Review 3, 2026-11-11: the owner asked for the doubled attack and the climax "as if four times as
 * strong". The limiter holds every peak at one ceiling, so the size comes from weight and length:
 * a sub-pressure pulse at the onset; a body of 30 to 80 Hz that holds `hold` s and rolls away over
 * `decay` s; thunder that rolls through the hall; large chunks of the giant that crash down one
 * after another (1.8 m and more, at the accepted landing's level for their size, with no scatter of small pieces).
 */
function enormity(
  m: Mix,
  p: string,
  t0: number,
  seed: number,
  hold: number,
  decay: number,
  crashes: readonly Crash[],
  db = 0,
): void {
  const [front, low] = S.whump(seed, 0.035, 1.0);
  const sub = new Float64Array(nsamp(1.0));
  addAt(sub, front, 0, 1.0);
  addAt(sub, low, 0, 0.8);
  addAt(sub, S.boom(seed + 1, { f: 30.0, tau: 0.2, dur: 1.0 }), 0, 1.0);
  m.add(`${p}-sub`, S.saturate(sub, 1.5), t0, [0.0, 0.0, -3.0], {
    target: -9 + db,
    kind: 'i',
    focusDb: 3,
  });
  const dur = hold + decay;
  const shape = (n: number, rise: number) =>
    new Float64Array(n).map((_, i) => {
      const t = i / SR;
      return t < rise ? t / rise : t < hold ? 1 : Math.exp(-(t - hold) / (decay / 3));
    });
  // review 5 (clarity): the low body mono, so it does not smear the image
  const b0 = S.billow(dur, seed + 2, 30.0, 80.0, 3.0)[0];
  const body: Stereo = [b0, b0];
  const be = shape(body[0].length, 0.03);
  m.addWide(
    `${p}-body`,
    [body[0].map((v, i) => v * be[i]!), body[1].map((v, i) => v * be[i]!)],
    t0,
    { target: -11 + db, kind: 'i', sendDb: -6 },
  );
  const roll = S.billow(dur + 0.6, seed + 3, 40.0, 300.0, 4.0);
  const n = roll[0].length;
  const r = rng(seed + 4);
  let t = 0.05;
  let k = 0;
  while (t < dur - 0.3) {
    const c = lp2(
      S.heavyCrack(seed + 10 + k, { size: 3.0, dur: 0.6, kRate: 5, bright: 0.2 }),
      2000,
    );
    const ch = k % 2;
    const g = 0.8 * Math.exp(-t / (dur / 2));
    addAt(roll[ch], c.subarray(0, Math.min(c.length, n - nsamp(t))), nsamp(t), g * 3.0);
    t += r.uniform(0.25, 0.7);
    k++;
  }
  const re = shape(n, 0.15);
  m.addWide(
    `${p}-roll`,
    [roll[0].map((v, i) => v * re[i]!), roll[1].map((v, i) => v * re[i]!)],
    t0 + 0.08,
    { target: -15 + db, kind: 'm', sendDb: -6 },
  );
  crashes.forEach(([tc, pos, size], j) =>
    m.add(`${p}-crash${j}`, lp2(S.slabFall(seed + 40 + j, size, 1.2, 0), 9000), tc, pos, {
      target: landing(size) + db - 4,
      kind: 'i',
      focusDb: 2,
      sendDb: -8,
    }),
  );
}

/**
 * Review 4, 2026-11-11: the owner on the doubled attack, "when they overlap, the wave grows - it
 * should go toward the high frequencies". Where the two beams overlap (from the second, 40 ms after
 * the first) a searing sizzle of 2 to 8 kHz, dense and irregular, laid shot by shot; two harsh
 * transients at the two onsets; a bright crack of thunder in the wide shot. Under 11 kHz.
 */
function overlap2(m: Mix): void {
  m.part('overlap2', () => {
    const t0 = B2 + 0.04;
    const dur = 3.6;
    const n = nsamp(dur);
    const dw = S.levelWalk(n, 3961, 4.0, 3.0, 14.0);
    const lv = env(
      [
        [t0, 0.0],
        [t0 + 0.01, 1.0],
        [50.9, 0.9],
        [52.9, 0.4],
        [t0 + dur, 0.0],
      ],
      t0,
      n,
    );
    const ck = arcCrackle(
      dur,
      3960,
      new Float64Array(n).map((_, i) => Math.min(1, 0.8 * dw[i]! * lv[i]!)),
    );
    const hiss = S.burst(3962, 2500.0, 8000.0, 1.6, { dur, rise: 0.003 });
    const sz = lp2(
      new Float64Array(n).map((_, i) => (0.8 * ck[i]! + 0.5 * hiss[i]!) * lv[i]!),
      9000,
    );
    shots(m, 'b2x-sizzle', t0, [
      { from: t0, to: 49.93, sig: sz, pos: [0.0, 1.6, -2.5], target: -8, sendDb: -10 },
      { from: 49.93, to: t0 + dur - 0.2, sig: sz, pos: [1.0, 4.5, -9.0], target: -12, sendDb: -10 },
    ]);
    (
      [
        [B2, -1],
        [B2 + 0.04, 1],
      ] as const
    ).forEach(([t, side], j) => {
      const o = new Float64Array(nsamp(0.2));
      addAt(
        o,
        S.tiltedBurst(3965 + j, 1200.0, 11000.0, 0.006, { tilt: 0.1, rise: 0.0002 }),
        0,
        1.0,
      );
      addAt(o, S.sizzle(0.12, 3967 + j, 0.03, 6000.0, 2500.0, 10000.0), 0, 0.6);
      m.add(
        `b2x-onset${j}`,
        lp2(cut(S.saturate(o, 2.5), 0.06), 11000),
        t,
        [side * 3.0, 2.0, -2.5],
        {
          target: -8,
          kind: 'i',
          sendDb: -12,
        },
      );
    });
    const tc = new Float64Array(nsamp(0.8));
    addAt(tc, S.tiltedBurst(3970, 800.0, 9000.0, 0.02, { tilt: 0.4, rise: 0.0005 }), 0, 1.0);
    addAt(
      tc,
      S.heavyCrack(3971, { size: 2.0, dur: 0.5, kRate: 10, bright: 0.9 }).subarray(0, tc.length),
      0,
      0.8,
    );
    m.add('b2x-thunder', lp2(S.saturate(tc, 1.8), 10000), 50.05, [2.0, 6.0, -12.0], {
      target: -12,
      kind: 'i',
      focusDb: 2,
      sendDb: -2,
    });
  });
}

/**
 * Review 4: the climax as bright as the doubled attack at least, so the arc holds: where the beams
 * from both sides converge (55.85 to 56.90 s), a sizzle of 2 to 8 kHz on each side that grows
 * denser toward the blast and is sucked in with the rest. Under 9 kHz.
 */
function overlap3(m: Mix): void {
  m.part('overlap3', () => {
    const t0 = 55.85;
    const t1 = 56.92;
    const dur = t1 - t0;
    const n = nsamp(dur);
    const lv = env(
      [
        [t0, 0.0],
        [t0 + 0.01, 0.7],
        [56.88, 1.0],
        [56.9, 0.05],
        [t1, 0.0],
      ],
      t0,
      n,
    );
    ([-1, 1] as const).forEach((side, j) => {
      const dw = S.levelWalk(n, 3981 + j, 4.0, 3.0, 14.0);
      const ck = arcCrackle(
        dur,
        3983 + j,
        new Float64Array(n).map((_, i) => Math.min(1, dw[i]! * lv[i]!)),
      );
      const hiss = S.burst(3985 + j, 2500.0, 8000.0, 3.0, { dur, rise: 0.003 });
      const sz = lp2(
        new Float64Array(n).map((_, i) => (0.8 * ck[i]! + 0.5 * hiss[i]!) * lv[i]!),
        9000,
      );
      m.add(`b3x-sizzle${j}`, fade(sz, 0.002, 0.003), t0, [side * 3.0, 1.8, -2.5], {
        target: -13,
        kind: 'm',
        sendDb: -8,
      });
    });
  });
}

/** The doubled attack's weight class, and a core between the two beams for its first two seconds. */
function size2(m: Mix): void {
  m.part('size2', () => {
    enormity(m, 'b2x', B2, 3900, 0.6, 1.3, [
      [50.15, [4.0, 0.0, -12.0], 2.0],
      [50.52, [-3.5, 0.0, -14.0], 1.8],
      [50.98, [6.0, 0.0, -15.0], 2.4],
    ]);
    const core = plasma(B2, B2 + 2.2, 3950, [
      [B2, 1.0],
      [B2 + 1.5, 0.9],
      [B2 + 2.2, 0.0],
    ]);
    m.add('b2x-core', fade(core, 0.004, 0.1), B2, [0.0, 1.5, -3.0], {
      target: -17,
      kind: 'm',
      sendDb: -8,
    });
  });
}

/** The climax's weight class: the largest, with the longest tail. */
function size3(m: Mix): void {
  m.part('size3', () => {
    enormity(
      m,
      'b3x',
      BLAST,
      3980,
      0.8,
      1.8,
      [
        [57.35, [-4.0, 0.0, -10.0], 2.5],
        [57.8, [5.0, 0.0, -12.0], 3.0],
        [58.3, [-2.0, 0.0, -14.0], 2.2],
      ],
      1,
    );
  });
}

/**
 * Reviews 2 and 3: the first attack (scene 2's head, accepted) 5 dB lower in this scene, so that the
 * doubled second attack and the climax rise above it. Scene 2 and its join are not touched: their
 * overlap ends before the release at 45.70 s.
 */
function headDown(_m: Mix, name: string, l: Layer): void {
  if (!name.startsWith('s3-')) return;
  const g = 10 ** (-5 / 20);
  for (const part of [l.dry, l.wet])
    for (const ch of part) for (let i = 0; i < ch.length; i++) ch[i] = ch[i]! * g;
}

/**
 * The bolder pass (`src/study/presence.ts`, the owner on 2026-11-12): the continuous layers 3 dB
 * less, to give the attacks room (scene 2's list, so the overlap with it stays exact, and this
 * scene's beds, hums between the attacks, the corona of the charged stone and the settling dust).
 */
const CONT3 =
  /^(bed|hole-roar|hole-inrush|hole-pressure|draw|far-draw|dark-draw|orbit|swirl|fly-air|flight-air|approach-air|orb-flight|dust-roll|dust-hiss|smoke|face-wind|hair-wind|gust|arc-hum|arc-ticks|g2-hum|settle-dust)/;
function boldLevels3(_m: Mix, name: string, l: Layer): void {
  if (CONT3.test(name)) scaleLayer(l, BOLD.continuousDb);
}

/**
 * Review 5, 2026-11-12: the owner, "from the golem attack scene on, it feels like the resolution
 * drops". From 49.4 s the scene was bottom-heavy, short of 1 to 6 kHz, smeared by the hall (its share
 * up to -1.4 dB) and by low bodies that differ left and right, flat (its onsets rose half as fast),
 * with up to 21 layers at once. Separation, not level: the roars, the thunder and the rolls lose 4 dB
 * at 350 Hz (the mud) and 5 dB under 150 Hz (the sized bodies carry the low end); the sustained layers duck 6 dB under each new transient (5 ms in, 0.25 s
 * out), so one event's tail does not bury the next.
 */
const MUD3 = /^(b2[ab]\d+$|b2x-(core|roll)|b3x-roll|blast-roll|b3-converge)/;
const SUSTAIN3 =
  /^(b2[ab]\d+$|b2x-(body|roll|core|sizzle)|b2-weight|b3-converge|b3x-(body|roll|sizzle)|blast-(boom|roll)|bed3)/;
const HITS3 = [
  49.42, 49.48, 49.58, 49.7, 50.05, 50.15, 50.52, 50.59, 50.98, 52.72, 55.81, 56.62, 56.95, 57.35,
  57.8, 58.3,
];
function clear3(m: Mix, name: string, l: Layer): void {
  const mud = MUD3.test(name);
  const duck = SUSTAIN3.test(name);
  if (!mud && !duck) return;
  // a layer is not ducked by its own onset
  const own = m.t0 + l.start / SR;
  const hits = HITS3.filter((h) => Math.abs(h - own) > 0.1);
  for (const part of [l.dry, l.wet])
    for (const ch of part) {
      if (mud) {
        const y = iir(Float64Array.from(ch), [
          rbj('peak', 350, 0.8, -4),
          rbj('ls', 150, 0.7071, -5),
        ]);
        for (let i = 0; i < ch.length; i++) ch[i] = y[i]!;
      }
      if (duck)
        for (let i = 0; i < ch.length; i++) {
          const t = m.t0 + (l.start + i) / SR;
          let g = 1;
          for (const h of hits) {
            const u = t - h;
            if (u < -0.005 || u > 1.2) continue;
            const e = u < 0 ? (u + 0.005) / 0.005 : Math.exp(-u / 0.25);
            g *= 1 - 0.5 * e;
          }
          ch[i] = ch[i]! * g;
        }
    }
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
  size2(m);
  overlap2(m);
  gather2(m);
  bolt3(m);
  blast(m);
  size3(m);
  overlap3(m);
  after(m);
  m.finish(tidy3);
  // scene 2's review 9: its noise layers and cracks lose their harsh top
  m.eachLayer('scene3-low-pass', lowPass);
  m.eachLayer('scene3-presence', presence3);
  m.eachLayer('scene3-head', headDown);
  m.eachLayer('scene3-bold', boldLevels3);
  m.eachLayer('scene3-clear', clear3);
  m.driveDb = BOLD.driveDb;
  // the presence pass: the quiet stretches lifted, the true peak at -1 dBTP
  // reviews 2 and 3: no lift over the first attack, so its contrast with the later ones stays
  m.lift = { ...LIFT, except: [[45.0, 47.6]] };
  m.ceilingDb = CEILING_DBTP;
  m.fixedMaster = SCENE1_MASTER;
  // review 3: a suck-back of 100 ms before each big attack, so it lands from quiet
  m.beforeDb = [
    [49.28, 0],
    [49.31, -18],
    [49.41, -18],
    [49.42, 0],
    [55.68, 0],
    [55.71, -18],
    [55.805, -18],
    [55.81, 0],
  ];
  m.afterDb = [
    [SCENE3_FROM, 0],
    [SCENE3_END, 0],
    [SCENE3_END + 0.7, -60],
  ];
  return m;
}
