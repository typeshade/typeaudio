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
  bandGain,
  linspace,
  lp,
  spectral,
  white,
  nsamp,
  rng,
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
  // review 1: hair as a fast flutter of noise (`gravel`), not cloth's pitched grains
  m.add(
    'hair-flutter',
    fade(
      S.gravel(3.1, 2002, 1000, 6000).map((v, i) => v * (0.6 + 0.4 * irr[i]!)),
      0.2,
      0.25,
    ),
    30.4,
    [0.2, 1.5, -0.8],
    { target: -28, kind: 'm', sendDb: -10 },
  );
  barrier(m);
}

// ---- Review 1, 2026-11-11: the barrier. The frames (12 a second) show a field of blue hexagons that
// blooms in front of her face at 31.85 s and holds to 32.25 s, and again from 32.70 to 32.98 s; it
// stops what the blast throws at her. Each bloom is a low whoomp of displaced air and a short glassy
// shimmer that blooms and settles: bright noise with a fast irregular flutter and a few fixed,
// inharmonic partials, no glide. Each stone it stops is a thud with its attack taken by the field
// (the stone's impact, dulled and softened), the field's own low-mid "thoom", a crackle of its
// surface and a chip that flies off: not stone on stone.

/** The glassy shimmer of the field: bright fluttering noise and fixed inharmonic partials. */
function shimmer(dur: number, seed: number): Float64Array {
  const n = nsamp(dur);
  const nz = S.tiltedBurst(seed, 2500.0, 11000.0, 0.22, { tilt: 0.5, dur, rise: 0.025 });
  const fl = S.irregular(n, seed + 1, 20, 90);
  const r = rng(seed + 2);
  const y = new Float64Array(n);
  for (const f of [3150.0, 4410.0, 5230.0, 6870.0, 8120.0]) {
    const tau = r.uniform(0.12, 0.3);
    const ph = r.uniform(0, 6.28);
    const a = r.uniform(0.3, 1.0);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      y[i] =
        y[i]! +
        a * Math.sin(2 * Math.PI * f * t + ph) * Math.exp(-t / tau) * Math.min(1, t / 0.025);
    }
  }
  const yn = S.norm(y);
  return S.norm(nz.map((v, i) => v * (0.65 + 0.35 * fl[i]!) + 0.3 * yn[i]!));
}

function barrier(m: Mix): void {
  const FIELD: Vec3 = [0.0, 1.6, -1.2];
  [31.85, 32.7].forEach((t, k) => {
    const bloom = new Float64Array(nsamp(0.8));
    addAt(bloom, S.burst(2200 + k, 50, 260, 0.14, { rise: 0.018 }), 0, 1.0);
    addAt(bloom, shimmer(0.7, 2210 + 3 * k), 0, 0.55);
    m.add(`barrier-bloom${k}`, S.norm(bloom), t, FIELD, { target: -17, kind: 'i', sendDb: -4 });
  });
  const r = rng(2230);
  (
    [
      [31.93, [-0.5, 1.7, -1.3]],
      [32.08, [0.6, 1.4, -1.2]],
      [32.77, [0.4, 1.8, -1.3]],
      [32.89, [-0.6, 1.5, -1.2]],
    ] as [number, Vec3][]
  ).forEach(([t, pos], k) => {
    const n = nsamp(0.6);
    const hit = new Float64Array(n);
    // the stone's thud, its attack taken by the field: dulled and softened
    const st = lp(S.norm(S.stoneImpact(0.3, 10.0, r)), 1400);
    const soft = nsamp(0.008);
    for (let i = 0; i < Math.min(soft, st.length); i++) st[i] = st[i]! * (i / soft);
    addAt(hit, S.norm(st).subarray(0, n), 0, 1.0);
    // the field's own resonance, low-mid, and the crackle of its surface
    addAt(hit, S.burst(2240 + k, 120, 420, 0.16, { rise: 0.008 }).subarray(0, n), 0, 0.9);
    addAt(hit, S.sizzle(0.18, 2250 + k, 0.05, 2500, 2500, 9000), 0, 0.3);
    // a chip that flies off
    addAt(hit, S.stoneCrack(r, 0.12, 0.4), nsamp(0.03), 0.25);
    m.add(`barrier-block${k}`, S.norm(hit), t, pos, { target: -16, kind: 'i', sendDb: -5 });
  });
}
/** 33.58 to 36.45: the stones on the floor stir and lift; she runs across. */
function floor(m: Mix): void {
  m.add(
    'stir',
    S.tumble(2.9, 2010, (t) => 1.0 + 1.5 * t, [0.2, 0.6], [2.0, 4.0]),
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
}

// ---- Review 1, 2026-11-11: the giant's assembly. The owner found the forming of the giant strange:
// it was one wash of roll, groan and grind. Now it is built as huge stone is built: blocks that
// slide and slam into place one after another (a scrape, then the seat in the timbre of the accepted
// landing, then a deep clunk), some overlapping; deep groans of the body; a low rumble that grows
// as the body completes, one source across the cuts; and its first shift of weight when it stands.

function assembly(m: Mix): void {
  const seats: [number, number, Vec3][] = [
    [37.9, 1.6, [-1.0, 1.0, -2.0]],
    [38.16, 1.4, [1.2, 1.5, -2.5]],
    [38.42, 1.8, [0.0, 0.5, -2.0]],
    [38.72, 1.5, [-2.5, -1.2, -3.0]],
    [38.93, 1.2, [2.0, -1.5, -4.0]],
    [39.1, 1.7, [-1.5, -1.5, -5.0]],
    [39.34, 1.3, [3.0, -1.0, -3.5]],
    [39.52, 1.9, [0.0, -2.0, -2.5]],
    [39.78, 1.4, [-3.0, -1.2, -4.5]],
    [39.97, 1.6, [2.5, -1.8, -3.0]],
    [40.2, 2.0, [0.0, -2.0, -4.0]],
  ];
  const r = rng(2300);
  seats.forEach(([t, size, pos], k) => {
    // the scrape as it slides in, louder until it seats
    const d = r.uniform(0.3, 0.6);
    const g = S.grind(d, 2310 + 7 * k, { rLo: 30, rHi: 120, scrape: 0.6 });
    const sc = g.map((v, i) => v * (i / g.length) ** 1.5);
    const cut = nsamp(0.006);
    for (let i = 0; i < cut; i++)
      sc[sc.length - cut + i] = sc[sc.length - cut + i]! * (1 - i / cut);
    const from: Vec3 = [pos[0] * 1.8, pos[1] + 1.5, pos[2] - 2.0];
    m.add(`seat${k}-scrape`, sc, t - d, line(from, pos, sc.length), {
      target: -26 + 2 * size,
      kind: 'm',
      sendDb: -6,
    });
    // the seat: the accepted landing's timbre, with a deep clunk
    const seat = S.slabFall(2320 + 7 * k, size, 0.35);
    addAt(
      seat,
      S.boom(2321 + 7 * k, { f: 60.0 / size ** 0.3, tau: 0.2 }).subarray(0, seat.length),
      0,
      0.8,
    );
    m.add(`seat${k}`, S.norm(seat), t, pos, {
      target: landing(size),
      kind: 'i',
      focusDb: 2,
      sendDb: -5,
    });
  });
  // the body groans as it takes the weight
  (
    [
      [38.7, 1.5],
      [39.55, 1.4],
    ] as const
  ).forEach(([t, d], k) =>
    m.add(
      `body-groan${k}`,
      S.groan(d, 2400 + k, { rLo: 28, rHi: 60, res: [45.0, 80.0, 140.0], q: 3.5 }),
      t,
      [0.0, -2.0, -3.0],
      {
        target: -22,
        kind: 'm',
        sendDb: -4,
      },
    ),
  );
  // a low rumble that grows as the body completes: one source from the floor shot, across the cuts
  const T0 = 33.58;
  const T1 = 41.4;
  const roll = S.billow(T1 - T0, 2410, 25.0, 150.0, 2.0);
  const grow = env(
    [
      [T0, 0.1],
      [37.85, 0.25],
      [40.2, 1.0],
      [41.18, 1.0],
      [41.4, 0.4],
    ],
    T0,
    nsamp(T1 - T0),
  );
  across(
    m,
    'body-rumble',
    roll[0].map((v, i) => v * grow[i]!),
    T0,
    [
      {
        from: T0,
        to: 38.6,
        pos: [0.0, 1.0, -3.0] as Vec3,
        opts: { target: -27, kind: 'm', sendDb: -4 },
      },
      {
        from: 38.6,
        to: 40.33,
        pos: [0.0, -1.5, -3.0] as Vec3,
        opts: { target: -24, kind: 'm', sendDb: -4 },
      },
      {
        from: 40.33,
        to: 41.4,
        pos: [3.0, 1.0, -14.0] as Vec3,
        opts: { target: -26, kind: 'm', sendDb: -4 },
      },
    ],
  );
  // its first shift of weight as it stands in the hall: slow, low, huge
  const shift = new Float64Array(nsamp(1.4));
  addAt(shift, S.boom(2420, { f: 36.0, tau: 1.0, dur: 1.4 }), 0, 1.0);
  const rise = nsamp(0.08);
  for (let i = 0; i < rise; i++) shift[i] = shift[i]! * (i / rise);
  addAt(
    shift,
    S.groan(0.9, 2421, { rLo: 25, rHi: 50, res: [40.0, 70.0, 120.0], q: 3.5 }),
    nsamp(0.05),
    0.5,
  );
  m.add('giant-stands', S.norm(shift), 40.42, [3.0, 0.0, -14.0], {
    target: -13,
    kind: 'i',
    focusDb: 3,
    sendDb: -3,
  });
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
  // as they close on the camera (37.9 s) the assembly begins: see `assembly`
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
  m.add('staff-cloth', fade(S.cloth(0.5, 2111, 220), 0.05, 0.1), 43.6, [0.4, 1.4, -1.0], {
    target: -34,
    kind: 'm',
    sendDb: -10,
  });
}

// ---- Review 3, 2026-11-11: the charge is lightning. The frames (12 a second) show purple electricity
// at her staff tip: small sparks at 44.03 and 44.20 s, a ball of crackle from 44.37 to 44.62 s, arcs
// that reach the floor from 44.70 to 45.12 s, large arcs at 45.28, 45.37 and 45.53 s, and no arcs at
// 45.20, 45.45 and 45.62 s. The bolt fires on the first frame of scene 3 (45.70 s). The owner: "a
// fast, powerful crackle for the preparation; the low hum, lower than you would expect, that ultra-
// high voltage gives; an occasional high tone; the attack only short and intense". So: bursts of
// crackle on the frames of the arcs (a snap, then a jittering train, saturated), a steady hum at 48
// Hz with strong low harmonics whose level and grit grow (its pitch does not move), and three faint
// whines of a coil at fixed pitches. It crests on the last arc and stops on the cut.

/** The bursts of the arcs: (picture seconds, strength 0..1, length in seconds). */
const ARCS: readonly (readonly [number, number, number])[] = [
  [44.03, 0.25, 0.05],
  [44.2, 0.3, 0.05],
  [44.37, 0.5, 0.26],
  [44.7, 0.65, 0.07],
  [44.78, 0.7, 0.07],
  [44.87, 0.75, 0.07],
  [44.95, 0.85, 0.2],
  [45.28, 0.95, 0.16],
  [45.53, 1.0, 0.13],
];

/** One burst of an arc: a snap, then a train of impulses gated on and off at random. */
function arc(seed: number, strength: number, len: number): Float64Array {
  const r = rng(seed);
  const n = nsamp(len + 0.02);
  const y = new Float64Array(n);
  addAt(y, S.tiltedBurst(seed + 1, 800.0, 9000.0, 0.003, { tilt: 0.3 }), 0, 1.5);
  let on = true;
  let next = r.exponential(0.008) * SR;
  const rate = 4000 + 4000 * strength;
  for (let i = 0; i < nsamp(len); i++) {
    if (i >= next) {
      on = !on;
      next = i + r.exponential(on ? 0.008 : 0.004) * SR;
    }
    if (on && r.random() < rate / SR)
      y[i] =
        y[i]! + r.uniform(0.3, 1.0) * (r.random() < 0.5 ? -1 : 1) * (1 - 0.5 * (i / nsamp(len)));
  }
  return y.map((v) => v * strength);
}

function charge(m: Mix): void {
  const T0 = 43.96;
  const T1 = SCENE2_END;
  const dur = T1 - T0;
  const n = nsamp(dur);
  const TIP: Vec3 = [-1.2, 1.6, -6.5];
  // the crackle: bursts on the frames of the arcs, band from 1 to 12 kHz, saturated
  const raw = new Float64Array(n);
  ARCS.forEach(([t, strength, len], k) =>
    addAt(raw, arc(2500 + 7 * k, strength, len), nsamp(t - T0)),
  );
  const shaped = spectral(raw, (f) => bandGain(f, 1000, 12000, 2));
  const pk = Math.max(...shaped.map(Math.abs)) + 1e-12;
  const crackle = shaped.map((v) => Math.tanh((2.5 * v) / pk) / Math.tanh(2.5));
  const stop = nsamp(0.004);
  for (let i = 0; i < stop; i++) crackle[n - stop + i] = crackle[n - stop + i]! * (1 - i / stop);
  m.add('charge-crackle', crackle, T0, TIP, { target: -12.5, kind: 'i', sendDb: -5 });
  // the hum of the voltage (review 4: deeper, bigger, a "wooo-woong"): 36 Hz with a strong body from
  // 72 to 144 Hz, steady in pitch; its level and its grit swell in a few slow, irregular surges, as
  // a line of extra-high voltage throbs; a faint corona buzz rides on its waveform
  const B = env(
    [
      [T0, 0.0],
      [44.37, 0.2],
      [44.95, 0.55],
      [45.53, 1.0],
      [45.665, 1.0],
      [45.67, 0.0],
    ],
    T0,
    n,
  );
  const surge = env(
    [
      [T0, 0.0],
      [44.18, 0.0],
      [44.42, 0.8],
      [44.62, 0.15],
      [44.78, 0.2],
      [45.0, 1.0],
      [45.16, 0.3],
      [45.24, 0.35],
      [45.42, 1.0],
      [45.5, 0.7],
      [45.62, 1.0],
      [45.67, 1.0],
    ],
    T0,
    n,
  );
  const walk = S.levelWalk(n, 2520, 1.5, 0.4, 2.0);
  const amps = [1.0, 0.95, 0.8, 0.6, 0.4, 0.25, 0.15];
  const ph = amps.map((_, k) => 0.7 * k);
  const hum = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let x = 0;
    amps.forEach((a, k) => (x += a * Math.sin(2 * Math.PI * 36.0 * (k + 1) * t + ph[k]!)));
    const sw = 0.55 + 0.45 * surge[i]!;
    const g = 1 + 3.5 * B[i]! * sw;
    hum[i] = (Math.tanh((g * x) / 2.5) / Math.tanh(g)) * B[i]! * sw * walk[i]!;
  }
  const corona = S.norm(spectral(white(n, 2521), (f) => bandGain(f, 2000, 7000, 2)));
  const hp = Math.max(...hum.map(Math.abs)) + 1e-12;
  const body = hum.map((v, i) => v + 0.06 * corona[i]! * Math.abs(v / hp) * B[i]!);
  m.addWide('charge-hum', [fade(body, 0.05, 0.004), fade(body, 0.05, 0.004)], T0, {
    target: -16,
    kind: 'm',
    sendDb: -6,
  });
  // the coil sings now and then: faint, short, at a fixed pitch
  (
    [
      [44.5, 7200.0, 0.18],
      [45.0, 8600.0, 0.22],
      [45.33, 9400.0, 0.15],
    ] as const
  ).forEach(([t, f, d], k) => {
    const w = new Float64Array(nsamp(d)).map((_, i) => {
      const tt = i / SR;
      return Math.sin(2 * Math.PI * f * tt) * Math.min(1, tt / 0.01) * Math.exp(-tt / (d / 3));
    });
    m.add(`charge-whine${k}`, w, t, TIP, { target: -31, kind: 'i', sendDb: -8 });
  });
}

/** Leave layers out of a mix. */
function drop(m: Mix, names: readonly string[]): void {
  for (const name of names) {
    m.layers.delete(name);
    for (let i = m.order.length - 1; i >= 0; i--) if (m.order[i] === name) m.order.splice(i, 1);
  }
}

/** Scene 2, the stone giant: from scene 1's tail to the cut before scene 3. */
export function scene2(): Mix {
  const m = new Mix('scene2', SCENE2_FROM, SCENE2_END, 1.5);
  m.until = SCENE2_END;
  beds(m);
  redLayers(m, { bed: false });
  // review 1: the two settling stones of the study's coda (a trickle of 1 to 3 cm pieces) and its
  // cloth (pitched grains) were heard as a pebble that rolls; the face is wind, hair and the barrier
  drop(m, ['settle0', 'settle1', 'hair-cloth']);
  // the owner's rule of review 1: small stones that nobody would miss are cut. The study's patter of
  // small debris under the smoke (scene 1 holds it to 29.5 s) fades out over 0.3 s after the join
  for (const name of ['debris-rain0', 'debris-rain1'])
    shapeLayer(m, name, [
      [SCENE2_JOIN, 1],
      [SCENE2_JOIN + 0.3, 0],
    ]);
  face(m);
  floor(m);
  assembly(m);
  blocks(m);
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
