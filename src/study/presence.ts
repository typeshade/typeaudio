// The presence pass, the owner's go-ahead of 2026-11-11, shared by the scenes of experiments 12
// to 14 so that they join with equal weight. Not the study's. Measured against the reference video's
// sound over each scene (its level and its band shares; no sample of it enters a render), the
// scenes were 9 to 12 dB quieter, deep in their valleys, and short of body from 120 Hz to 2 kHz.
// Three parts, each set here once:
//
// - `body`: the main events of a scene (its bolts, stones, strikes, the hole's voice, the giant)
//   get more body from 120 Hz to 2 kHz, in the layer (its dry part and its hall), before the mix.
//   The low end and the top stay as they are.
// - `LIFT`: the master raises the quiet stretches of the scene, slowly, by up to `maxDb`: a level
//   over `windowS` seconds under `thresholdDb` (on the sum after the master's gain, before the
//   drive) is raised by `ratio` of its distance under it, but never so far that a peak reaches the
//   limiter's threshold, so the limiter does no more work. The loud stretches are not touched; the
//   valleys stay, less deep.
// - `CEILING_DBTP`: the highest true peak of the master, -1 dBTP (the owner's release ceiling).

import { SR, addAt, iir, lp, nsamp, rbj, type Stereo, type Vec3 } from './dsp.ts';
import type { Layer, Mix } from './mix.ts';
import * as S from './sources.ts';

/** The body of the main events: a broad bell from about 150 Hz to 1.7 kHz. */
export const BODY = { hz: 650, q: 0.55, gainDb: 3.0 } as const;

/** Give a layer the body of a main event (a layer step's work). */
export function body(l: Layer, gainDb: number = BODY.gainDb): void {
  for (const part of [l.dry, l.wet])
    for (const ch of part) {
      const y = iir(Float64Array.from(ch), [rbj('peak', BODY.hz, BODY.q, gainDb)]);
      for (let i = 0; i < ch.length; i++) ch[i] = y[i]!;
    }
}

export interface Lift {
  readonly thresholdDb: number;
  readonly ratio: number;
  readonly maxDb: number;
  readonly windowS: number;
  readonly smoothS: number;
}

/** The lift of the quiet stretches, for every scene. */
export const LIFT: Lift = { thresholdDb: -18, ratio: 0.7, maxDb: 8, windowS: 1.0, smoothS: 0.4 };

/** The ceiling of the master's true peak, for every scene. */
export const CEILING_DBTP = -1.0;

const BLOCK = 240;

/** A running mean over `w` values, centred. */
function centred(x: Float64Array, w: number): Float64Array {
  const n = x.length;
  const c = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) c[i + 1] = c[i]! + x[i]!;
  const h = Math.floor(w / 2);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - h);
    const b = Math.min(n, i + h + 1);
    y[i] = (c[b]! - c[a]!) / (b - a);
  }
  return y;
}

/**
 * The gain of the lift for each block of 5 ms, dB. The level over the window sets it; the headroom
 * under `ceiling` (linear) of the highest sample within twice the smoothing time caps it, so the lift
 * never raises a peak over the ceiling (the cap, smoothed, stays under the headroom of each sample).
 */
export function liftGainDb(y: Stereo, lift: Lift, ceiling: number): Float64Array {
  const nb = Math.ceil(y[0].length / BLOCK);
  const e = new Float64Array(nb);
  const pk = new Float64Array(nb);
  for (let k = 0; k < nb; k++) {
    let s = 0;
    let p = 0;
    const b = Math.min(y[0].length, (k + 1) * BLOCK);
    for (let i = k * BLOCK; i < b; i++) {
      const l = y[0][i]!;
      const r = y[1][i]!;
      s += 0.5 * (l * l + r * r);
      p = Math.max(p, Math.abs(l), Math.abs(r));
    }
    e[k] = s / (b - k * BLOCK);
    pk[k] = p;
  }
  const ms = centred(e, Math.round((lift.windowS * SR) / BLOCK));
  const g = new Float64Array(nb);
  for (let k = 0; k < nb; k++) {
    const db = 10 * Math.log10(ms[k]! + 1e-12);
    g[k] = Math.min(lift.maxDb, Math.max(0, lift.ratio * (lift.thresholdDb - db)));
  }
  const ks = Math.round((lift.smoothS * SR) / BLOCK);
  const cap = new Float64Array(nb);
  for (let k = 0; k < nb; k++) {
    let p = 1e-9;
    for (let j = Math.max(0, k - ks); j <= Math.min(nb - 1, k + ks); j++) p = Math.max(p, pk[j]!);
    cap[k] = Math.max(0, 20 * Math.log10(ceiling / p));
  }
  const gs = centred(g, ks);
  const cs = centred(cap, ks);
  return gs.map((v, k) => Math.min(v, cs[k]!));
}

/** Raise the quiet stretches of a sum, never over `ceiling` (the master's step). */
export function liftQuiet(y: Stereo, lift: Lift, ceiling: number): Stereo {
  const g = liftGainDb(y, lift, ceiling);
  const nb = g.length;
  const at = (i: number) => {
    const u = i / BLOCK - 0.5;
    const k = Math.max(0, Math.min(nb - 1, Math.floor(u)));
    const k1 = Math.min(nb - 1, k + 1);
    const f = Math.max(0, Math.min(1, u - k));
    return 10 ** (((1 - f) * g[k]! + f * g[k1]!) / 20);
  };
  return [y[0].map((v, i) => v * at(i)), y[1].map((v, i) => v * at(i))];
}

// ---- The bolder pass, the owner's go-ahead of 2026-11-12 ("the whole sound design is too restrained
// overall"), shared by the scenes: the key events hit harder and bigger, the continuous layers make
// room for them, and less drive into the soft clip keeps the attacks' punch.

/** The bolder pass: the drive into the limiter and the soft clip, and the level of the continuous layers. */
export const BOLD = { driveDb: 7.5, continuousDb: -3 } as const;

/** Scale a layer (its dry part and its hall) by `db` (a layer step's work). */
export function scaleLayer(l: Layer, db: number): void {
  const g = 10 ** (db / 20);
  for (const part of [l.dry, l.wet])
    for (const ch of part) for (let i = 0; i < ch.length; i++) ch[i] = ch[i]! * g;
}

export interface Size {
  /** Seconds the low body holds, and seconds it rolls away over. */
  readonly hold: number;
  readonly decay: number;
  /** dB on every part (0: a large key event). */
  readonly db: number;
  /** Where the event is. */
  readonly pos: Vec3;
  /** The size in metres of a crack of the floor under it (0: none). */
  readonly crack?: number;
}

/**
 * The size of a key event, in animation style: a sub-pressure pulse at its onset, a body of 30 to 80
 * Hz that holds and rolls away, a deep crack of the floor, and the hall that answers from both
 * walls 0.17 and 0.26 s later. Each part is a layer named after `p`; under 10 kHz.
 */
export function impactSize(m: Mix, p: string, t0: number, seed: number, z: Size): void {
  const [front, low] = S.whump(seed, 0.03, 1.2);
  const sub = new Float64Array(nsamp(1.2));
  addAt(sub, front, 0, 1.0);
  addAt(sub, low, 0, 0.8);
  addAt(sub, S.boom(seed + 1, { f: 32.0, tau: 0.25, dur: 1.2 }), 0, 1.0);
  m.add(`${p}-sub`, S.saturate(sub, 1.3), t0, [z.pos[0], 0.0, z.pos[2]], {
    target: -10 + z.db,
    kind: 'i',
    focusDb: 3,
  });
  const dur = z.hold + z.decay;
  const body = S.billow(dur, seed + 2, 30.0, 80.0, 3.0);
  const be = new Float64Array(body[0].length).map((_, i) => {
    const t = i / SR;
    return t < 0.02 ? t / 0.02 : t < z.hold ? 1 : Math.exp(-(t - z.hold) / (z.decay / 3));
  });
  m.addWide(
    `${p}-body`,
    [body[0].map((v, i) => v * be[i]!), body[1].map((v, i) => v * be[i]!)],
    t0,
    {
      target: -12 + z.db,
      kind: 'i',
      sendDb: -6,
    },
  );
  let crack: Float64Array | undefined;
  if (z.crack) {
    crack = lp(
      lp(S.heavyCrack(seed + 3, { size: z.crack, dur: 0.7, kRate: 4, bright: 0.35 }), 10000),
      10000,
    );
    m.add(`${p}-crack`, crack, t0 + 0.005, [z.pos[0], 0.0, z.pos[2]], {
      target: -12 + z.db,
      kind: 'i',
      focusDb: 2,
      sendDb: -6,
    });
  }
  const src = new Float64Array(sub.length);
  addAt(src, S.norm(sub), 0, 1.0);
  if (crack) addAt(src, S.norm(crack).subarray(0, src.length), 0, 0.6);
  (
    [
      [0.17, [-9.0, 2.5, -7.0]],
      [0.26, [9.0, 2.5, -11.0]],
    ] as const
  ).forEach(([d, pos], j) =>
    m.add(`${p}-room${j}`, S.slap(src, 1500), t0 + d, pos as Vec3, {
      target: -17 + z.db - 2 * j,
      kind: 'i',
      sendDb: 0,
    }),
  );
}
