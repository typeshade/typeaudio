// Scene 2 of the reference video, the stone giant, 29.5 to 45.67 s, made with the study's models in
// the engine (`src/study/`), as scene 1 (experiment 12) is. It starts from scene 1's tail: the mix
// begins at 28.5 s with the same hall's bed and the same layers of the red passage that sound there,
// and it is mastered at scene 1's gain, so the two join at 29.5 s with no step.
//
// The frames, read on 2026-11-11 at 6 and 24 frames a second, with a cut detector:
//
//   29.50-30.32  scene 1's last shot: the smoke rolls
//   30.32-33.58  her face, close; her hair blows hard; a blue barrier flashes twice (31.83, 32.66)
//   33.58-36.45  the emblem floor from above; scattered stones stir and lift; she runs across (35.3)
//   36.45-38.60  blocks fly at her from all sides; she slips between them; at 37.9 they close on the camera
//   38.60-40.33  the blocks are one giant body; she runs on top of it
//   40.33-41.42  the giant stands in the hall; its fist comes down and strikes at 41.18
//   41.42-43.21  a wave of dust and stones spreads through the hall
//   43.21-43.96  her silhouette; the dust settles
//   43.96-45.67  wide: a purple circle at her staff, sparks and small arcs; scene 3's lightning follows
//
// The rules of scene 1 hold: one source for one event across the cuts, laid shot by shot with a
// crossfade; no fast glide of a pitch; stone that lands at the level of the landing the owner
// accepted (`block-land` of scene 1, a slab of 1.6 m at -11 LUFS over 0.1 s), lower for a smaller
// one; heavy things low; no hollow tube; no period.

import {
  SR,
  addAt,
  fade,
  interp,
  linspace,
  nsamp,
  rng,
  stftShape,
  white,
  type Stereo,
  type Vec3,
} from '../../src/study/dsp.ts';
import { Mix, type AddOptions, type Where } from '../../src/study/mix.ts';
import {
  concat,
  curve,
  fullBed,
  line,
  shapeSt,
  steady,
  sum,
  ticks,
  times,
} from '../../src/study/passage.ts';
import * as S from '../../src/study/sources.ts';
import { redLayers } from '../12-scene1-red-seal/red.ts';

export const SCENE2_FROM = 28.5;
export const SCENE2_JOIN = 29.5;
export const SCENE2_END = 45.67;

/** Scene 1's master (render r5 at `437fa7d`): its gain, and the trim after its clip, measured as the gain that matches scene 2 to scene 1 over 28.6 to 29.45 s (`run.ts --join`). */
export const SCENE1_MASTER = { gainDb: -8.454930856303939, trimDb: 0.98 };

type Points = readonly (readonly [number, number])[];
const env = (points: Points, t0: number, n: number) => curve(points, t0, n);

/** The level of a stone that lands, from the accepted landing: -11 for 1.6 m, lower by its size. */
const landing = (size: number) => -11 + 10 * Math.log10(size / 1.6);

interface Part {
  readonly from: number;
  readonly to: number;
  readonly pos: Where;
  readonly opts: AddOptions;
}

/** One continuous signal (from `t0`), laid shot by shot with an equal-power crossfade of `xf` s at each cut. */
function across(
  m: Mix,
  name: string,
  sig: Float64Array,
  t0: number,
  parts: readonly Part[],
  xf = 0.12,
  tail = 0.3,
): void {
  parts.forEach((p, k) => {
    const first = k === 0;
    const last = k === parts.length - 1;
    const a = Math.max(t0, p.from - (first ? 0 : xf / 2));
    const b = p.to + (last ? tail : xf / 2);
    const ia = nsamp(a - t0);
    const ib = Math.min(sig.length, nsamp(b - t0));
    if (ib - ia < 2) return;
    const x = sig.slice(ia, ib);
    const fin = first ? nsamp(0.05) : nsamp(xf);
    const fout = last ? nsamp(tail) : nsamp(xf);
    for (let i = 0; i < Math.min(fin, x.length); i++)
      x[i] = x[i]! * Math.sin((0.5 * Math.PI * (i + 0.5)) / fin);
    for (let i = 0; i < Math.min(fout, x.length); i++) {
      const j = x.length - fout + i;
      if (j >= 0) x[j] = x[j]! * Math.cos((0.5 * Math.PI * (i + 0.5)) / fout);
    }
    m.add(`${name}${k}`, x, a, p.pos, p.opts);
  });
}

/** A block that passes the camera: steady low noise on a path that comes in, passes and goes on. */
function pass(
  m: Mix,
  name: string,
  t: number,
  side: number,
  near: number,
  seed: number,
  target: number,
  dur = 0.5,
): void {
  const src = steady(dur, seed, 80, 1500);
  const h = Math.floor(src.length / 2);
  const P = concat(
    line([side * 1.0, 1.4, -9.0], [side * near, 1.5, 0.0], h),
    line([side * near, 1.5, 0.0], [side * (near + 1.0), 1.6, 8.0], src.length - h),
  );
  m.add(name, src, t - dur / 2, P, { target, kind: 'i', sendDb: -8 });
}

/** Air that is drawn in (the study's gathering of mana): noise whose band climbs with `draw` (0..1). */
function drawnAir(
  dur: number,
  seed: number,
  draw: Float64Array,
  lo: number,
  hi: number,
  width = 1.1,
): Stereo {
  const n = nsamp(dur);
  const tAxis = new Float64Array(n).map((_, i) => i / SR);
  return [0, 1].map((c) => {
    const x = stftShape(white(n, seed + c), (tf, fr, g) => {
      const d = interp(tf, tAxis, draw);
      const fc = lo * (hi / lo) ** d;
      for (let k = 0; k < fr.length; k++) {
        const f = Math.max(fr[k]!, 1);
        g[k] = Math.exp(-0.5 * (Math.log2(f / fc) / width) ** 2) * Math.min(1, (fc / f) ** 0.3);
      }
    });
    const walk = S.levelWalk(n, seed + 10 + c, 2.5, 0.4, 6.0);
    return x.map((v, i) => v * walk[i]! * draw[i]!);
  }) as Stereo;
}

/** Steps on stone: light impacts at a running pace, each interval drawn. */
function steps(
  from: number,
  to: number,
  seed: number,
  size: number,
): { times: number[]; sig: Float64Array } {
  const r = rng(seed);
  const t: number[] = [];
  for (let x = 0; x < to - from; x += 0.27 + 0.08 * r.random()) t.push(x);
  return {
    times: t,
    sig: ticks(
      t,
      () => S.stoneImpact(size * r.uniform(0.7, 1.2), r.uniform(2.0, 3.5), r),
      to - from + 0.3,
    ),
  };
}

/** Fade a stored layer by a gain that follows (picture seconds, gain) points. */
function shapeLayer(m: Mix, name: string, points: Points): void {
  const l = m.layers.get(name)!;
  const ts = points.map((p) => p[0]);
  const vs = points.map((p) => p[1]);
  for (const part of [l.dry, l.wet])
    for (const ch of part)
      for (let i = 0; i < ch.length; i++)
        ch[i] = ch[i]! * interp(m.t0 + (l.start + i) / SR, ts, vs);
}

/** Equal-power gain points from 1 to 0 (or 0 to 1) between a and b. */
const xfade = (a: number, b: number, out: boolean): Points =>
  Array.from({ length: 9 }, (_, k) => {
    const u = k / 8;
    const g = out ? Math.cos((Math.PI / 2) * u) : Math.sin((Math.PI / 2) * u);
    return [a + (b - a) * u, g] as const;
  });

/** The hall's bed: scene 1's own bed to 31 s, crossed over 30.0 to 31.0 s to a bed of its own. */
function beds(m: Mix): void {
  fullBed(m, 0.0, 31.0, 101, -41.0, [
    [0, -30],
    [1.0, 0],
    [24.7, 0],
    [25.3, -4],
    [25.7, -4],
    [26.6, 0],
    [31.0, 0],
  ]);
  for (const name of ['bed', 'bed-low', 'bed-high']) shapeLayer(m, name, xfade(30.0, 31.0, true));
  const t0 = 29.9;
  const dur = SCENE2_END + 1.5 - t0;
  m.addWide('bed2', S.hallAir(dur, 201), t0, { target: -41.0, kind: 'a' });
  m.addWide('bed2-low', S.wideNoise(dur, 204, 28, 90, 3), t0, { target: -47.0, kind: 'r' });
  m.addWide('bed2-high', S.wideNoise(dur, 206, 5000, 12000), t0, { target: -50.0, kind: 'a' });
  for (const name of ['bed2', 'bed2-low', 'bed2-high'])
    shapeLayer(m, name, xfade(30.0, 31.0, false));
}

/** 30.32 to 33.58: her face; the wind of scene 1 goes on in her hair. */
function face(m: Mix): void {
  // the study's hair-wind, hair-cloth and wind-tone (30.25 to 32.5) come with the red passage, as
  // its soft coda; the picture blows her hair hard for the whole shot, so a strong wind lies under them
  const fw = S.wind(4.2, 2000, 250, 3500);
  m.addWide(
    'face-wind',
    shapeSt(
      fw,
      env(
        [
          [30.25, 0],
          [30.5, 1],
          [33.4, 0.85],
          [34.4, 0],
        ],
        30.25,
        fw[0].length,
      ),
    ),
    30.25,
    { target: -22, kind: 'm' },
  );
  const g = S.wind(1.7, 2001, 300, 3500);
  m.addWide(
    'gust2',
    shapeSt(
      g,
      env(
        [
          [32.0, 0],
          [32.4, 1],
          [33.35, 0.8],
          [33.7, 0],
        ],
        32.0,
        g[0].length,
      ),
    ),
    32.0,
    { target: -26, kind: 'm' },
  );
  const irr = S.irregular(nsamp(3.1), 2003, 2, 9);
  m.add(
    'hair2',
    fade(
      S.cloth(3.1, 2002, 300).map((v, i) => v * (0.6 + 0.4 * irr[i]!)),
      0.2,
      0.25,
    ),
    30.4,
    [0.2, 1.5, -0.8],
    { target: -28, kind: 'm', sendDb: -10 },
  );
  // the barrier flashes: a soft bright crush and a breath of low air, no pitch
  [31.83, 32.66].forEach((t, i) => {
    m.add(`hex${i}`, S.crush(0.3, 2004 + i, 0.05, 1500, 7000), t, [0.0, 1.8, -1.5], {
      target: -31,
      kind: 'i',
      sendDb: -6,
    });
    m.add(`hex${i}-air`, S.burst(2006 + i, 60, 300, 0.08, { rise: 0.01 }), t, [0.0, 1.0, -2.0], {
      target: -32,
      kind: 'i',
      sendDb: -8,
    });
  });
}

/** 33.58 to 36.45: the stones on the floor stir and lift; she runs across. */
function floor(m: Mix): void {
  m.add(
    'stir',
    S.tumble(2.9, 2010, (t) => 2.0 + 4.0 * t, [0.05, 0.25], [2.0, 5.0]),
    33.6,
    [0.0, 0.0, -8.0],
    { target: -25, kind: 'm', sendDb: -6 },
  );
  const sc = S.grind(2.4, 2011, { rLo: 40, rHi: 140 });
  m.add(
    'stir-scrape',
    times(
      sc,
      env(
        [
          [34.0, 0],
          [35.5, 0.6],
          [36.4, 1.0],
        ],
        34.0,
        sc.length,
      ),
    ),
    34.0,
    [-2.0, 0.0, -7.0],
    { target: -26, kind: 'm', sendDb: -6 },
  );
  const run = steps(35.3, 36.45, 2012, 0.02);
  m.add('run-steps', run.sig, 35.3, [2.0, 0.0, -9.0], { target: -33, kind: 'i', sendDb: -8 });
}

/** 33.58 to 41.4: the giant's mass, one source across the cuts: a low roll, a groan, a grind. */
function mass(m: Mix): void {
  const T0 = 33.58;
  const T1 = 41.5;
  const dur = T1 - T0;
  const n = nsamp(dur);
  const grow = env(
    [
      [T0, 0.15],
      [36.45, 0.55],
      [38.6, 1.0],
      [41.18, 1.0],
      [41.4, 0.4],
    ],
    T0,
    n,
  );
  const roll = S.billow(dur, 2020, 30.0, 220.0, 2.5);
  const groan = S.groan(dur, 2021, { rLo: 35, rHi: 80, res: [55.0, 95.0, 170.0], q: 3.0 });
  const grind = S.grind(dur, 2022, { rLo: 40, rHi: 120, scrape: 0.8 });
  const body = sum([1.0, roll[0]], [0.9, groan], [0.6, grind]).map((v, i) => v * grow[i]!);
  const shots: [number, number, Vec3, number][] = [
    [33.58, 36.45, [0.0, 0.0, -9.0], -25],
    [36.45, 38.6, [0.0, 1.0, -4.0], -21],
    [38.6, 40.33, [0.0, -0.5, -2.5], -19],
    [40.33, 41.42, [3.0, 2.0, -14.0], -22],
  ];
  across(
    m,
    'giant-mass',
    body,
    T0,
    shots.map(([from, to, pos, target]) => ({
      from,
      to,
      pos,
      opts: { target, kind: 'm', sendDb: -4 },
    })),
  );
}

/** 36.45 to 38.6: blocks fly at her from all sides and strike one another; at 37.9 they close. */
function blocks(m: Mix): void {
  (
    [
      [36.5, -1, 1.6],
      [36.68, 1, 1.2],
      [36.85, -1, 2.2],
      [37.05, 1, 1.0],
      [37.22, -1, 1.4],
      [37.45, 1, 1.8],
      [37.62, -1, 1.1],
      [37.8, 1, 1.5],
    ] as const
  ).forEach(([t, side, near], i) =>
    pass(m, `block-pass${i}`, t, side, near, 2030 + i, -22 - (near > 1.5 ? 2 : 0)),
  );
  const r = rng(2040);
  let t = 36.55;
  let i = 0;
  while (t < 37.85) {
    t += r.exponential(1 / 4.0);
    if (t >= 37.85) break;
    const size = r.uniform(0.6, 1.2);
    const pos: Vec3 = [r.uniform(-4, 4), r.uniform(0.5, 3.5), r.uniform(-7, -3)];
    m.add(`block-hit${i}`, S.blockHit(2041 + 7 * i, size, r.uniform(6, 10)), t, pos, {
      target: landing(size),
      kind: 'i',
      focusDb: 2,
      sendDb: -6,
    });
    i++;
  }
  // they close on the camera: three heavy seatings and the grind between them
  (
    [
      [37.9, 1.6, [-1.0, 1.0, -2.0]],
      [38.16, 1.4, [1.2, 1.5, -2.5]],
      [38.42, 1.8, [0.0, 0.5, -2.0]],
    ] as [number, number, Vec3][]
  ).forEach(([tl, size, pos], k) =>
    m.add(`block-lock${k}`, S.blockHit(2070 + k, size, 6.0), tl, pos, {
      target: landing(size),
      kind: 'i',
      focusDb: 2,
      sendDb: -5,
    }),
  );
}

/** 38.6 to 40.33: she runs on top of the giant; it settles and cracks under her. */
function onTop(m: Mix): void {
  const run = steps(38.7, 40.3, 2080, 0.03);
  m.add('top-steps', run.sig, 38.7, [0.0, 0.0, -1.5], { target: -30, kind: 'i', sendDb: -8 });
  [38.95, 39.55, 40.1].forEach((t, k) =>
    m.add(
      `top-crack${k}`,
      S.heavyCrack(2085 + k, { size: 1.5, dur: 0.4, kRate: 6, bright: 0.3 }),
      t,
      [(k - 1) * 2.0, -1.0, -3.0],
      {
        target: -17,
        kind: 'i',
        focusDb: 2,
        sendDb: -6,
      },
    ),
  );
}

/** 40.33 to 41.18: the fist comes down: its air rises with its speed. 41.18: it strikes. */
function fist(m: Mix): void {
  const HIT = 41.18;
  const d = HIT - 40.33;
  const speed = linspace(2.0, 40.0, nsamp(d)).map((v, i, a) => v * (i / a.length) ** 0.5 + 2.0);
  const air = fade(S.aero(speed, 2090, 10.0, 40.0, 100.0, 2500.0, 6.0), 0.1, 0.01);
  m.add('fist-air', air, 40.33, line([3.0, 7.0, -14.0], [3.0, 0.5, -13.0], air.length), {
    target: -22,
    kind: 'm',
    sendDb: -4,
  });
  const hit = S.slabFall(2091, 2.0);
  addAt(hit, S.boom(2092, { f: 48.0, tau: 0.9 }).subarray(0, hit.length), 0, 1.2);
  addAt(
    hit,
    S.heavyCrack(2093, { size: 2.0, dur: 0.5, kRate: 10, bright: 0.6 }).subarray(0, hit.length),
    0,
    0.8,
  );
  const hn = S.norm(hit);
  m.add('fist-hit', hn, HIT, [3.0, 0.0, -12.0], {
    target: -8.5,
    kind: 'i',
    focusDb: 4,
    sendDb: -3,
  });
  const [front, low, slp] = S.whump(2094, 0.006, 0.8);
  m.add(
    'fist-pressure',
    S.saturate(sum([0.6, front], [1.0, low], [0.5, slp])),
    HIT,
    [3.0, 0.5, -12.0],
    {
      target: -12,
      kind: 'i',
      focusDb: 4,
    },
  );
  m.add('fist-slap0', S.slap(hn, 900), HIT + 0.22, [-8.0, 3.0, -16.0], {
    target: -22,
    kind: 'i',
    focusDb: 6,
  });
  m.add('fist-slap1', S.slap(hn, 1200), HIT + 0.31, [8.0, 3.0, -14.0], {
    target: -24,
    kind: 'i',
    focusDb: 6,
  });
}

/** 41.2 to 44.4: the wave of dust and stones, across the cuts at 41.42 and 43.21; then it settles. */
function dustWave(m: Mix): void {
  m.addWide('dust-burst', S.puff(2.5, 2100, 150.0, 4000.0, 0.06, 0.9), 41.2, {
    target: -15,
    kind: 'i',
    sendDb: -4,
  });
  const roll = S.billow(3.4, 2101, 50.0, 500.0);
  m.addWide(
    'dust-roll',
    shapeSt(
      roll,
      env(
        [
          [41.2, 0],
          [41.45, 1],
          [42.5, 0.8],
          [43.21, 0.45],
          [43.96, 0.3],
          [44.6, 0],
        ],
        41.2,
        roll[0].length,
      ),
    ),
    41.2,
    { target: -18, kind: 'm', sendDb: -4 },
  );
  const hiss = S.dust(3.4, 2102, { lo: 700.0, hi: 6000.0, grain: 0.25, tilt: 0.6 });
  m.addWide(
    'dust-hiss',
    shapeSt(
      hiss,
      env(
        [
          [41.25, 0],
          [41.5, 1],
          [42.6, 0.7],
          [43.21, 0.4],
          [44.2, 0.15],
          [44.6, 0],
        ],
        41.25,
        hiss[0].length,
      ),
    ),
    41.25,
    { target: -23, kind: 'm' },
  );
  m.addWide('dust-ring', S.bandSweepWide(0.4, 2103, 300.0, 1800.0, 1.0, 0.3), 41.5, {
    target: -21,
    kind: 'i',
    sendDb: -6,
  });
  m.add(
    'dust-debris',
    S.rubble(2.0, 2104, (t) => 14.0 * Math.exp(-t / 0.6) + 2.0, {
      sizes: [0.1, 0.5],
      bright: 0.25,
      body: 0.3,
    }),
    41.35,
    [0.0, 0.0, -8.0],
    { target: -21, kind: 'm', focusDb: 2, sendDb: -4 },
  );
  (
    [
      [42.15, 1, 1.8],
      [42.3, -1, 2.4],
      [42.5, 1, 2.0],
    ] as const
  ).forEach(([t, side, near], i) => pass(m, `debris-pass${i}`, t, side, near, 2105 + i, -25, 0.36));
  m.add(
    'settle-ticks',
    S.tumble(1.6, 2110, (t) => 4.0 * Math.exp(-t / 0.8) + 0.5, [0.02, 0.08], [1.5, 4.0]),
    43.2,
    [-3.0, 0.0, -9.0],
    { target: -33, kind: 'm' },
  );
  m.add('staff-cloth', fade(S.cloth(0.5, 2111, 220), 0.05, 0.1), 43.6, [0.4, 1.4, -1.0], {
    target: -34,
    kind: 'm',
    sendDb: -10,
  });
}

/** 43.96 to 45.67: the purple circle at her staff: mana that gathers, sparks, small arcs. */
function charge(m: Mix): void {
  const T0 = 43.96;
  const dur = SCENE2_END + 0.3 - T0;
  const n = nsamp(dur);
  const draw = env(
    [
      [T0, 0],
      [44.3, 0.25],
      [45.6, 1.0],
      [SCENE2_END + 0.3, 1.0],
    ],
    T0,
    n,
  );
  m.addWide('charge-air', drawnAir(dur, 2120, draw, 260, 1100), T0, {
    target: -21,
    kind: 'm',
    sendDb: -6,
  });
  const breath = S.howl(dur, 2121, [300.0, 450.0, 610.0], 8.0, 0.05, 1.2);
  m.add(
    'charge-breath',
    breath.map((v, i) => v * draw[i]!),
    T0,
    [-1.5, 1.4, -7.0],
    { target: -25, kind: 'm', sendDb: -6 },
  );
  const sp = S.pops(dur, 2122, 18.0, 1500, 7000, 0.004);
  m.add(
    'charge-sparks',
    sp.map((v, i) => v * draw[i]!),
    T0,
    [-1.5, 1.4, -7.0],
    { target: -26, kind: 'm', sendDb: -8 },
  );
  const r = rng(2123);
  const at = [44.85, 45.05, 45.2, 45.38, 45.52];
  const arcs = ticks(
    at.map((t) => t - 44.8),
    (k) => {
      const z = S.sizzle(0.12, 2124 + k, 0.03, 4000);
      addAt(z, S.tiltedBurst(2130 + k, 1200.0, 9000.0, 0.006, { tilt: 0.4 }), 0, 0.8);
      return z.map((v) => v * r.uniform(0.6, 1.0));
    },
    1.0,
  );
  m.add('charge-arcs', arcs, 44.8, [-1.2, 1.6, -6.5], { target: -21, kind: 'i', sendDb: -6 });
}

/** Scene 2, the stone giant: from scene 1's tail to the cut before scene 3. */
export function scene2(): Mix {
  const m = new Mix('scene2', SCENE2_FROM, SCENE2_END, 1.5);
  m.until = SCENE2_END;
  beds(m);
  redLayers(m, { bed: false });
  face(m);
  floor(m);
  mass(m);
  blocks(m);
  onTop(m);
  fist(m);
  dustWave(m);
  charge(m);
  m.driveDb = 8.8;
  m.fixedMaster = SCENE1_MASTER;
  m.afterDb = [
    [SCENE2_FROM, 0],
    [SCENE2_END, 0],
    [SCENE2_END + 1.0, -60],
  ];
  return m;
}
