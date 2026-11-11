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
  iir,
  rbj,
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
import { Mix, type AddOptions, type Layer, type Where } from '../../src/study/mix.ts';
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
import { CEILING_DBTP, LIFT, body } from '../../src/study/presence.ts';
import { MAIN, redTail } from '../12-scene1-red-seal/tail.ts';

export const SCENE2_FROM = 28.5;
export const SCENE2_JOIN = 29.5;
export const SCENE2_END = 45.67;

/** Scene 1's master (the presence pass, `13d669e`): its gain, and the trim after its clip, measured as the gain that matches scene 2 to scene 1 over 29.2 to 29.45 s (`run.ts --join`). */
export const SCENE1_MASTER = { gainDb: -7.886529581389624, trimDb: 0.844 };

type Points = readonly (readonly [number, number])[];
export const env = (points: Points, t0: number, n: number) => curve(points, t0, n);

/** The level of a stone that lands, from the accepted landing: -11 for 1.6 m, lower by its size. */
export const landing = (size: number) => -11 + 10 * Math.log10(size / 1.6);

export interface Part {
  readonly from: number;
  readonly to: number;
  readonly pos: Where;
  readonly opts: AddOptions;
}

/** One continuous signal (from `t0`), laid shot by shot with an equal-power crossfade of `xf` s at each cut. */
export function across(
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
export function pass(
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
export function shapeLayer(m: Mix, name: string, points: Points): void {
  const l = m.layers.get(name)!;
  const ts = points.map((p) => p[0]);
  const vs = points.map((p) => p[1]);
  for (const part of [l.dry, l.wet])
    for (const ch of part)
      for (let i = 0; i < ch.length; i++)
        ch[i] = ch[i]! * interp(m.t0 + (l.start + i) / SR, ts, vs);
}

/** Equal-power gain points from 1 to 0 (or 0 to 1) between a and b. */
export const xfade = (a: number, b: number, out: boolean): Points =>
  Array.from({ length: 9 }, (_, k) => {
    const u = k / 8;
    const g = out ? Math.cos((Math.PI / 2) * u) : Math.sin((Math.PI / 2) * u);
    return [a + (b - a) * u, g] as const;
  });

/** The hall's bed: scene 1's own bed to 31 s, crossed over 30.0 to 31.0 s to a bed of its own. */
export function beds(m: Mix): void {
  m.part('bed', () =>
    fullBed(m, 0.0, 31.0, 101, -41.0, [
      [0, -30],
      [1.0, 0],
      [24.7, 0],
      [25.3, -4],
      [25.7, -4],
      [26.6, 0],
      [31.0, 0],
    ]),
  );
  m.part('bed2', () => {
    const t0 = 29.9;
    const dur = SCENE2_END + 1.5 - t0;
    m.addWide('bed2', S.hallAir(dur, 201), t0, { target: -41.0, kind: 'a' });
    m.addWide('bed2-low', S.wideNoise(dur, 204, 28, 90, 3), t0, { target: -47.0, kind: 'r' });
    // review 9: the hall's thin high air ends at 8 kHz (it is read by `tidy`, so the low pass of the
    // layers cannot take it)
    m.addWide('bed2-high', S.wideNoise(dur, 206, 5000, 8000), t0, { target: -51.0, kind: 'a' });
  });
}

/**
 * The steps over the whole mix after its parts: scene 1's bed crosses to scene 2's over 30.0 to 31.0
 * s; the study coda's settling stones and its cloth are left out (review 1: heard as a pebble that
 * rolls; small stones that nobody would miss are cut). Scene 1 leaves out the study's patter of
 * small debris under the smoke, so scene 2 does too (`redTail`).
 */
function tidy(m: Mix): void {
  for (const name of ['bed', 'bed-low', 'bed-high']) shapeLayer(m, name, xfade(30.0, 31.0, true));
  for (const name of ['bed2', 'bed2-low', 'bed2-high'])
    shapeLayer(m, name, xfade(30.0, 31.0, false));
  drop(m, ['settle0', 'settle1', 'hair-cloth']);
}

/** 30.32 to 33.58: her face; the wind of scene 1 goes on in her hair. */
function face(m: Mix): void {
  m.part('face', () => {
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
        spectral(white(nsamp(3.1), 2002), (f) => bandGain(f, 1000, 5000, 2)).map(
          (v, i) => v * (0.6 + 0.4 * irr[i]!),
        ),
        0.2,
        0.25,
      ),
      30.4,
      [0.2, 1.5, -0.8],
      { target: -31, kind: 'm', sendDb: -10 },
    );
  });
}

// ---- Review 1, 2026-11-11: the barrier. The frames (12 a second) show a field of blue hexagons that
// blooms in front of her face at 31.85 s and holds to 32.25 s, and again from 32.70 to 32.98 s; it
// stops what the blast throws at her. Each bloom is a low whoomp of displaced air and a short glassy
// shimmer that blooms and settles: bright noise with a fast irregular flutter and a few fixed,
// inharmonic partials, no glide. Each stone it stops is a thud with its attack taken by the field
// (the stone's impact, dulled and softened), the field's own low-mid "thoom", a crackle of its
// surface and a chip that flies off: not stone on stone.

/** The glassy shimmer of the field: bright fluttering noise and fixed inharmonic partials. */
export function shimmer(dur: number, seed: number): Float64Array {
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
  m.part('barrier', () => {
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
  });
}
/** 33.58 to 36.45: the stones on the floor stir and lift; she runs across. */
function floor(m: Mix): void {
  m.part('floor', () => {
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
  });
}

// ---- The giant's assembly (review 1, refined in review 5, 2026-11-11). The owner: refine the part
// where the stones gather and become the golem. The frames at 12 a second give every contact:
//
//   36.57, 36.98, 37.15, 37.40, 37.73, 37.95  blocks pass close to the camera
//   37.15 to 37.68                            blocks crowd round her and touch
//   38.10                                     they slam shut over the camera (the frame is covered)
//   38.52                                     the covering blocks shift
//   38.72, 38.82                              blocks slide into the body on the right
//   39.10 to 39.45                            the head block slides up and seats: the body is complete
//   39.5 to 40.33                             the camera draws back; nothing moves; the body takes the weight
//   40.42                                     in the hall, the giant shifts its weight as it stands
//
// One body grows: few, near, distinct contacts first; then deeper and heavier ones; the head, the
// largest and deepest seat, completes it; then the weight shift, the largest low moment before the
// fist. Every seat has its own size, ring, body pitch, scrape and place. The groans of the body run
// across the cut at 38.60 s, so the moment does not sag where one seat dies before the next.

/** A contact of stone made soft by the magic that moves it: low passed at 1.8 kHz, a 15 ms attack. */
function softened(x: Float64Array): Float64Array {
  const y = lp(S.norm(x), 1800);
  const ramp = nsamp(0.015);
  for (let i = 0; i < Math.min(ramp, y.length); i++) y[i] = y[i]! * (i / ramp);
  return S.norm(y);
}

/**
 * Review 6, 2026-11-11. The owner: because it is very advanced magic, the stones gather more quietly
 * than you would expect, but densely. Under the seats: many soft contacts of large stones that
 * press into one another, faster as the mass closes (6 to 22 a second), a grinding mass of stone
 * that thickens, and a faint, steady low pressure of the magic that holds them (20 to 55 Hz, no tone).
 */
function packing(m: Mix): void {
  m.part('packing', () => {
    const r = rng(2600);
    const shots: [number, number, Vec3][] = [
      [37.85, 38.6, [0.0, 1.0, -2.0]],
      [38.6, 39.6, [0.0, -1.5, -3.0]],
    ];
    shots.forEach(([a, b, pos], k) => {
      const times: number[] = [];
      let t = a;
      for (;;) {
        t += r.exponential(1 / (6.0 + (16.0 * (t - 37.85)) / (39.6 - 37.85)));
        if (t >= b) break;
        times.push(t - a);
      }
      const presses = ticks(
        times,
        (i) =>
          softened(S.blockHit(2610 + 31 * k + i, r.uniform(0.8, 1.4), 3.0)).map(
            (v) => v * r.uniform(0.4, 1.0),
          ),
        b - a + 0.8,
      );
      m.add(`pack${k}`, presses, a, pos, { target: -20, kind: 'm', focusDb: 1, sendDb: -5 });
    });
    const grow = (n: number, t0: number) =>
      env(
        [
          [37.85, 0.2],
          [39.5, 1.0],
          [40.0, 0.8],
          [40.33, 0.0],
        ],
        t0,
        n,
      );
    (
      [
        [-2.0, 0.0, -3.0],
        [2.0, -1.0, -3.5],
        [0.0, -2.0, -2.5],
      ] as Vec3[]
    ).forEach((pos, k) => {
      const g = S.grind(2.5, 2650 + k, {
        rLo: 20 + 5 * k,
        rHi: 70 + 10 * k,
        res: [70.0, 150.0, 300.0],
        scrape: 0.5,
      });
      m.add(`pack-grind${k}`, fade(times(g, grow(g.length, 37.85)), 0.2, 0.1), 37.85, pos, {
        target: -24,
        kind: 'm',
        sendDb: -5,
      });
    });
    const hold = S.wideNoise(2.8, 2660, 20, 55, 3, false);
    const he = env(
      [
        [37.85, 0],
        [38.4, 0.6],
        [39.5, 1.0],
        [40.2, 1.0],
        [40.6, 0],
      ],
      37.85,
      hold[0].length,
    );
    m.addWide('magic-hold', shapeSt(hold, he), 37.85, { target: -27, kind: 'm' });
  });
}

/** 36.45 to 37.95: blocks fly at her and pass; a few touch where they crowd round her. */
function blocks(m: Mix): void {
  m.part('blocks', () => {
    (
      [
        [36.57, -1, 1.2],
        [36.98, 1, 1.8],
        [37.15, -1, 1.4],
        [37.4, 1, 2.2],
        [37.73, -1, 1.1],
        [37.95, 1, 1.5],
      ] as const
    ).forEach(([t, side, near], i) =>
      pass(m, `block-pass${i}`, t, side, near, 2030 + i, -22 - (near > 1.5 ? 2 : 0)),
    );
    (
      [
        [37.15, 0.7, [2.5, 2.0, -5.0]],
        [37.4, 0.8, [-2.0, 1.0, -4.5]],
        [37.57, 0.9, [1.5, 2.5, -4.0]],
        [37.68, 1.0, [-1.0, 1.5, -3.5]],
      ] as [number, number, Vec3][]
    ).forEach(([t, size, pos], i) =>
      m.add(`block-hit${i}`, softened(S.blockHit(2041 + 7 * i, size, 7.0 + i)), t, pos, {
        target: landing(size) - 9,
        kind: 'i',
        focusDb: 2,
        sendDb: -6,
      }),
    );
  });
}

interface Seat {
  readonly t: number;
  readonly size: number;
  readonly pos: Vec3;
  /** How long it slides before it seats, seconds. */
  readonly slide: number;
  /** The pitch of its body against the size's own, and its ring (0 dull to 1 bright). */
  readonly pitch: number;
  readonly ring: number;
  /** dB against the accepted landing's level for its size. */
  readonly level: number;
}

const SEATS: readonly Seat[] = [
  { t: 38.1, size: 1.6, pos: [0.0, 1.0, -1.5], slide: 0.15, pitch: 1.0, ring: 0.5, level: 0 },
  { t: 38.52, size: 1.1, pos: [-1.2, 1.5, -1.8], slide: 0.12, pitch: 1.12, ring: 0.3, level: -4 },
  { t: 38.72, size: 1.4, pos: [3.0, -0.5, -3.5], slide: 0.1, pitch: 0.93, ring: 0.45, level: -2 },
  { t: 38.82, size: 1.7, pos: [2.2, -1.5, -3.0], slide: 0.1, pitch: 0.88, ring: 0.25, level: -1 },
  { t: 39.45, size: 2.3, pos: [0.0, 1.5, -6.0], slide: 0.35, pitch: 0.8, ring: 0.6, level: -1 },
];

function assembly(m: Mix): void {
  m.part('assembly', () => {
    SEATS.forEach((s, k) => {
      // the slide into place: a scrape that grows and stops on the seat
      const g = S.grind(s.slide + 0.05, 2310 + 7 * k, {
        rLo: 25 + 5 * k,
        rHi: 90 + 15 * k,
        scrape: 0.4 + 0.15 * k,
      });
      const sc = g.map((v, i) => v * (i / g.length) ** 1.5);
      const cut = nsamp(0.006);
      for (let i = 0; i < cut; i++)
        sc[sc.length - cut + i] = sc[sc.length - cut + i]! * (1 - i / cut);
      const from: Vec3 = [s.pos[0] * 1.6 + (k % 2 ? 1.5 : -1.5), s.pos[1] - 1.5, s.pos[2] - 1.5];
      m.add(`seat${k}-scrape`, sc, s.t - s.slide - 0.05, line(from, s.pos, sc.length), {
        target: -27 + 2 * s.size,
        kind: 'm',
        sendDb: -6,
      });
      // the seat: the accepted landing's timbre, its own body pitch and length, its own ring
      const seat = S.slabFall(2320 + 7 * k, s.size, 0.3 + 0.08 * k);
      addAt(
        seat,
        S.boom(2321 + 7 * k, {
          f: (60.0 / s.size ** 0.3) * s.pitch,
          tau: 0.16 + 0.06 * k,
        }).subarray(0, seat.length),
        0,
        0.8,
      );
      addAt(
        seat,
        S.heavyCrack(2323 + 7 * k, {
          size: s.size,
          dur: 0.3,
          kRate: 4 + k,
          bright: s.ring,
        }).subarray(0, seat.length),
        0,
        0.1 + 0.1 * s.ring,
      );
      // review 6: precise magic, not a crash: the attack softened (12 ms, low passed at 2.5 kHz) and
      // the level 8 dB under the accepted landing's
      const soft = lp(S.norm(seat), 2500);
      const ramp = nsamp(0.012);
      for (let i = 0; i < ramp; i++) soft[i] = soft[i]! * (i / ramp);
      m.add(`seat${k}`, S.norm(soft), s.t, s.pos, {
        target: landing(s.size) + s.level - 8,
        kind: 'i',
        focusDb: 2,
        sendDb: -5,
      });
    });
    // stone under stress: groans of the body from before the cut at 38.60 s, and creaks as the
    // completed body takes the weight
    (
      [
        [38.4, 1.5, 30, 65, [45.0, 80.0, 140.0], -22],
        [39.45, 1.0, 24, 55, [38.0, 70.0, 125.0], -21],
      ] as const
    ).forEach(([t, d, lo, hi, res, tg], k) =>
      m.add(
        `body-groan${k}`,
        S.groan(d, 2400 + k, { rLo: lo, rHi: hi, res, q: 3.5 }),
        t,
        [0.0, -2.0, -3.0],
        {
          target: tg,
          kind: 'm',
          sendDb: -4,
        },
      ),
    );
    const creak = S.grind(0.85, 2405, { rLo: 15, rHi: 60, res: [60.0, 130.0, 260.0], scrape: 0.3 });
    m.add('body-creak', fade(creak, 0.15, 0.1), 39.5, [1.5, -1.5, -4.0], {
      target: -26,
      kind: 'm',
      sendDb: -4,
    });
    // a low rumble that grows as the body completes: one source from the floor shot, across the cuts
    const T0 = 33.58;
    const T1 = 41.4;
    const roll = S.billow(T1 - T0, 2410, 25.0, 150.0, 2.0);
    const grow = env(
      [
        [T0, 0.1],
        [37.85, 0.25],
        [38.5, 0.55],
        [39.45, 1.0],
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
          to: 36.45,
          pos: [0.0, 0.0, -9.0] as Vec3,
          opts: { target: -30, kind: 'm', sendDb: -4 },
        },
        {
          from: 36.45,
          to: 38.6,
          pos: [0.0, 1.0, -3.0] as Vec3,
          opts: { target: -26, kind: 'm', sendDb: -4 },
        },
        {
          from: 38.6,
          to: 40.33,
          pos: [0.0, -1.5, -3.0] as Vec3,
          opts: { target: -25, kind: 'm', sendDb: -4 },
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
    addAt(shift, S.boom(2420, { f: 46.0, tau: 1.0, dur: 1.4 }), 0, 1.0);
    const rise = nsamp(0.08);
    for (let i = 0; i < rise; i++) shift[i] = shift[i]! * (i / rise);
    addAt(
      shift,
      S.groan(0.9, 2421, { rLo: 25, rHi: 50, res: [40.0, 70.0, 120.0], q: 3.5 }),
      nsamp(0.05),
      0.5,
    );
    m.add('giant-stands', S.norm(shift), 40.42, [3.0, 0.0, -14.0], {
      target: -14,
      kind: 'i',
      focusDb: 3,
      sendDb: -3,
    });
  });
}

/** 40.33 to 41.18: the fist comes down: its air rises with its speed. 41.18: it strikes. */
function fist(m: Mix): void {
  m.part('fist', () => {
    // the contact: the giant is lowest at 41.18 s and the first dust shows at 41.22 s (24 a second)
    const HIT = 41.2;
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
      target: -10,
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
        target: -15,
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
  });
}

/**
 * Review 10, 2026-11-11: the owner did not feel the wind pressure as the giant comes down. The
 * frames at 24 a second: it stands and shifts to 40.80 s, goes down from 40.84 s, fastest from 41.05
 * to 41.18 s, and touches at 41.20 s. The air the mass pushes: a low body (30 to 200 Hz) and broad air
 * above it (to 8 kHz) that grow with the speed and the nearness, to the contact; there a short gust
 * out; at 41.43 s, when the dust wall reaches the camera, a low push and a rush of air.
 */
function descentAir(m: Mix): void {
  m.part('descent-air', () => {
    const T0 = 40.84;
    const HIT = 41.2;
    const d = HIT - T0;
    const n = nsamp(d + 0.04);
    const grow = new Float64Array(n).map((_, i) => {
      const u = Math.min(1, i / nsamp(d));
      return i <= nsamp(d) ? u ** 3 : 1 - (i - nsamp(d)) / (n - nsamp(d));
    });
    const walk = S.levelWalk(n, 2900, 1.0, 0.3, 3.0);
    const low = spectral(white(n, 2901), (f) => bandGain(f, 30, 200, 2));
    const air = spectral(
      white(n, 2902),
      (f) => bandGain(f, 200, 8000, 2) * (200 / Math.max(f, 200)) ** 0.5,
    );
    const ln = S.norm(low);
    const an = S.norm(air);
    const push = ln.map((v, i) => (1.6 * v + 0.6 * an[i]!) * grow[i]! * walk[i]!);
    m.add('descent-push', push, T0, line([3.0, 5.0, -10.0], [1.0, 1.0, -4.0], n), {
      target: -10,
      kind: 'm',
      sendDb: -6,
    });
    const gust = new Float64Array(nsamp(0.4));
    addAt(gust, S.burst(2903, 30, 160, 0.15, { rise: 0.006 }), 0, 1.0);
    addAt(gust, S.burst(2904, 150, 8000, 0.1, { rise: 0.01 }), 0, 0.7);
    m.add('descent-gust', S.norm(gust), HIT, [1.0, 0.5, -4.0], {
      target: -11,
      kind: 'i',
      sendDb: -6,
    });
    const rush = S.puff(0.9, 2905, 150.0, 8000.0, 0.06, 0.35);
    const pushLow = S.burst(2906, 30, 150, 0.25, { rise: 0.03, dur: 0.9 }).map((v) => 1.6 * v);
    m.addWide(
      'wave-air',
      [rush[0].map((v, i) => v + pushLow[i]!), rush[1].map((v, i) => v + pushLow[i]!)],
      41.4,
      {
        target: -10,
        kind: 'i',
        sendDb: -6,
      },
    );
  });
}

/** 41.2 to 44.4: the wave of dust and stones, across the cuts at 41.42 and 43.21; then it settles. */
function dustWave(m: Mix): void {
  m.part('dustWave', () => {
    // review 8: the wave arrives with the picture. Its dust wall fills the frame at 41.43 s: the burst
    // builds from the contact and peaks there, with a pressure that arrives with it. The ring of shock
    // lines crosses the foreground at 41.72 s. Stones fly at the camera at 42.26 and 42.65 s.
    m.addWide('dust-burst', S.puff(2.5, 2100, 150.0, 4000.0, 0.2, 0.9), 41.23, {
      target: -18,
      kind: 'i',
      sendDb: -4,
    });
    const [wf, wl] = S.whump(2106, 0.012, 0.6);
    const wave = new Float64Array(nsamp(0.6));
    addAt(wave, wf, 0, 0.7);
    addAt(wave, wl, 0, 1.0);
    m.add('wave-arrive', S.saturate(wave, 2.0), 41.43, [0.0, 1.0, -1.5], {
      target: -9,
      kind: 'i',
      sendDb: -6,
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
    m.addWide('dust-ring', S.bandSweepWide(0.4, 2103, 300.0, 1800.0, 1.0, 0.3), 41.6, {
      target: -21,
      kind: 'i',
      sendDb: -6,
    });
    m.add(
      'dust-debris',
      S.rubble(1.0, 2104, (t) => 10.0 * Math.exp(-t / 0.5), {
        sizes: [0.3, 0.9],
        bright: 0.25,
        body: 0.6,
      }),
      41.35,
      [0.0, 0.0, -8.0],
      { target: -21, kind: 'm', focusDb: 2, sendDb: -4 },
    );
    (
      [
        [42.26, -1, 1.0],
        [42.55, 1, 2.4],
        [42.65, -1, 1.4],
      ] as const
    ).forEach(([t, side, near], i) =>
      pass(m, `debris-pass${i}`, t, side, near, 2105 + i, -25, 0.36),
    );
    m.add('staff-cloth', fade(S.cloth(0.5, 2111, 220), 0.05, 0.1), 43.6, [0.4, 1.4, -1.0], {
      target: -34,
      kind: 'm',
      sendDb: -10,
    });
  });
}

// ---- The charge (reviews 2 to 7, 2026-11-11). The spell is lightning; the bolt fires on the first
// frame of scene 3 (45.70 s). The owner, review 7: the mage is skilled, so not a crackle; "the
// gathering quietly; the gathering is the ultra-high-voltage 'wooo-woong'; the firing is spat out at
// ultra-high output". So the gathering is only the hum of the voltage and a faint, smooth corona: no
// crackle, no arc, no whine. It stays restrained until the last 0.4 s, then its low body swells; 80 ms
// before the release it drops by 20 dB, a held breath.

/** The release: the first frame of scene 3. */
export const RELEASE = 45.7;

export function charge(m: Mix): void {
  m.part('charge', () => {
    const TIP: Vec3 = [-1.2, 1.6, -6.5];
    // the hum of the voltage: 36 Hz with a body from 72 to 144 Hz, steady in pitch; irregular surges of
    // level and grit (the "wooo-woong"), from 43.6 s across the cut into the wide shot
    const H0 = 43.6;
    const H1 = RELEASE;
    const hn = nsamp(H1 - H0);
    const level = env(
      [
        [H0, 0.0],
        [43.75, 0.22],
        [45.27, 0.35],
        [45.45, 0.65],
        [45.6, 1.0],
        [45.62, 0.1],
        [RELEASE - 0.002, 0.1],
        [RELEASE, 0.0],
      ],
      H0,
      hn,
    );
    const surge = env(
      [
        [H0, 0.3],
        [44.18, 0.3],
        [44.5, 0.9],
        [44.75, 0.3],
        [44.95, 0.4],
        [45.2, 1.0],
        [45.35, 0.5],
        [45.6, 1.0],
        [H1, 1.0],
      ],
      H0,
      hn,
    );
    const walk = S.levelWalk(hn, 2520, 1.5, 0.4, 2.0);
    const amps = [1.0, 0.95, 0.8, 0.6, 0.4, 0.25, 0.15];
    const ph = amps.map((_, k) => 0.7 * k);
    const hum = new Float64Array(hn);
    for (let i = 0; i < hn; i++) {
      const b = level[i]!;
      let x = 0;
      amps.forEach((a, k) => (x += a * Math.sin(2 * Math.PI * 36.0 * (k + 1) * (i / SR) + ph[k]!)));
      const sw = 0.6 + 0.4 * surge[i]!;
      const g = 1 + 3.5 * b * sw;
      hum[i] = (Math.tanh((g * x) / 2.5) / Math.tanh(g)) * b * sw * walk[i]!;
    }
    m.addWide('charge-hum', [fade(hum, 0.05, 0.002), fade(hum, 0.05, 0.002)], H0, {
      target: -16,
      kind: 'm',
      sendDb: -6,
    });
    // a very faint, smooth corona: hiss from 2 to 7 kHz that follows the hum's level, no transients
    const cor = S.wideNoise(H1 - H0, 2521, 2000, 7000, 2, false);
    const ce = level.map((v) => Math.sqrt(v));
    m.addWide(
      'charge-corona',
      [
        fade(
          cor[0].map((v, i) => v * ce[i]!),
          0.1,
          0.002,
        ),
        fade(
          cor[1].map((v, i) => v * ce[i]!),
          0.1,
          0.002,
        ),
      ],
      H0,
      {
        target: -36,
        kind: 'm',
      },
    );
    // review 8: a little of the lightning beside the hum, here and there: soft, short fizzes on the
    // frames of the arcs, from 1.5 to 6 kHz, a 5 ms attack, 12 to 18 dB under the hum; no first crackle
    const fz = rng(2530);
    const fizzT = [44.03, 44.2, 44.4, 44.53, 44.72, 44.87, 45.02, 45.28, 45.37, 45.53];
    const fizz = ticks(
      fizzT.map((t) => t - H0),
      (k) => {
        const d = fz.uniform(0.02, 0.05);
        const b = S.burst(2540 + k, 1500, 6000, d / 3, { dur: d, rise: 0.005 });
        // two fall in troughs of the hum's surges (44.87 and 45.02 s): lower, so each stays 12 to 18 dB under it
        const trough = k === 5 ? 0.5 : k === 6 ? 0.6 : 1.0;
        return b.map(
          (v) => v * (0.5 + (0.5 * k) / (fizzT.length - 1)) * trough * fz.uniform(0.7, 1.0),
        );
      },
      H1 - H0,
    );
    m.add('charge-fizz', fizz, H0, TIP, { target: -30, kind: 'i', sendDb: -8 });
  });
}

/**
 * The head of scene 3: the release of the bolt at 45.70 s, here until scene 3 is made, so the owner
 * hears the gathering and the release together. The owner's rule for lightning: short and intense.
 * One instant: a full-band tearing crack with a saturated body, a low pressure thump at the same
 * instant (the stored hum let go), a very short push of air; heard for no more than about 0.3 s.
 */
export function scene3Head(m: Mix): void {
  m.part('scene3Head', () => {
    const n = nsamp(0.45);
    const crack = new Float64Array(n);
    addAt(crack, S.tiltedBurst(2700, 300.0, 14000.0, 0.03, { tilt: 0.25, rise: 0.0003 }), 0, 1.0);
    addAt(
      crack,
      S.heavyCrack(2701, { size: 2.0, dur: 0.15, kRate: 14, bright: 1.0 }).subarray(0, n),
      0,
      0.8,
    );
    const snap = S.saturate(crack, 2.0);
    const [front, low] = S.whump(2702, 0.008, 0.45);
    const thump = new Float64Array(n);
    addAt(thump, front, 0, 0.8);
    addAt(thump, low, 0, 0.8);
    addAt(thump, S.boom(2703, { f: 40.0, tau: 0.1, dur: 0.45 }), 0, 1.0);
    const air = S.puff(0.25, 2704, 200.0, 6000.0, 0.004, 0.06);
    const cut = (x: Float64Array, keep: number) => {
      const k0 = nsamp(keep);
      const k1 = nsamp(keep + 0.08);
      return x.map((v, i) => (i < k0 ? v : i < k1 ? v * (1 - (i - k0) / (k1 - k0)) : 0));
    };
    const at = RELEASE;
    m.add('s3-bolt-crack', cut(S.norm(snap), 0.12), at, [-0.5, 1.8, -6.0], {
      target: -5,
      kind: 'i',
      focusDb: 3,
      sendDb: -14,
    });
    m.add('s3-bolt-thump', cut(S.saturate(thump, 2.0), 0.12), at, [0.0, 0.5, -4.0], {
      target: -9,
      kind: 'i',
      focusDb: 3,
      sendDb: -16,
    });
    m.addWide('s3-bolt-air', [cut(air[0], 0.1), cut(air[1], 0.1)], at, { target: -14, kind: 'i' });
  });
}

/**
 * Review 8: the bolt sounds for as long as it is seen. The frames at 12 a second: it streams from
 * the staff from 45.70 s; at 46.05 s the picture cuts to the giant's side, where a barrier of blue
 * hexagons forms (46.18 s); at 46.35 s the bolt strikes the barrier in a white flash (46.40 s) and
 * presses on it until 47.43 s; at 47.46 s the barrier shatters. One discharge from the release to
 * the shattering, laid shot by shot: a torrent of noise on a deep spectrum (the study's turbulence),
 * a dense saturated crackle and a heavy low body, all at levels that wander with no period; the
 * strike on the barrier (the field's resonance and a harsh splash of electricity); the strain of the
 * field while the bolt presses; the barrier that shatters.
 */
export function bolt(m: Mix): void {
  m.part('bolt', () => {
    const T0 = RELEASE;
    const T1 = 47.6;
    const dur = T1 - T0;
    const n = nsamp(dur);
    const level = env(
      [
        [T0, 1.0],
        [45.95, 0.9],
        [46.05, 0.6],
        [46.35, 0.75],
        [46.4, 1.0],
        [46.6, 0.85],
        [47.4, 0.85],
        [47.46, 0.5],
        [T1, 0.0],
      ],
      T0,
      n,
    );
    const bands = S.turbulence(dur, 2800, S.BEAM_CURVE, S.TURBULENCE_BANDS, 0.4);
    const torrent = new Float64Array(n);
    for (const b of bands)
      for (let i = 0; i < n; i++) torrent[i] = torrent[i]! + 0.5 * (b[0][i]! + b[1][i]!);
    const rc = rng(2810);
    const u = rc.randomN(n);
    const amp = rc.uniformN(0.3, 1.0, n);
    const sg = rc.signN(n);
    const imp = new Float64Array(n);
    for (let i = 0; i < n; i++) imp[i] = u[i]! < 4500 / SR ? amp[i]! * sg[i]! : 0;
    const crack = spectral(imp, (f) => bandGain(f, 1500, 9000, 2));
    const body = S.billow(dur, 2811, 35.0, 160.0, 2.5)[0];
    const walk = S.levelWalk(n, 2812, 2.0, 0.5, 6.0);
    const tn = S.norm(torrent);
    const cn = S.norm(crack);
    const bn = S.norm(body);
    const mixed = new Float64Array(n);
    for (let i = 0; i < n; i++) mixed[i] = (0.8 * tn[i]! + 0.45 * cn[i]! + 0.9 * bn[i]!) * walk[i]!;
    const pk = Math.max(...mixed.map(Math.abs)) + 1e-12;
    const plasma = mixed.map((v, i) => (Math.tanh((1.2 * v) / pk) / Math.tanh(1.2)) * level[i]!);
    across(
      m,
      's3-bolt-plasma',
      plasma,
      T0,
      [
        {
          from: T0,
          to: 46.05,
          pos: [0.5, 1.8, -5.0] as Vec3,
          opts: { target: -14, kind: 'm', sendDb: -8 },
        },
        {
          from: 46.05,
          to: 46.35,
          pos: [-2.0, 2.0, -7.0] as Vec3,
          opts: { target: -15, kind: 'm', sendDb: -6 },
        },
        {
          from: 46.35,
          to: 47.46,
          pos: [0.0, 1.5, -3.5] as Vec3,
          opts: { target: -14, kind: 'm', sendDb: -6 },
        },
        {
          from: 47.46,
          to: 47.6,
          pos: [0.0, 1.5, -3.5] as Vec3,
          opts: { target: -18, kind: 'm', sendDb: -6 },
        },
      ],
      0.12,
      0.15,
    );
    // the strike on the barrier: the field's resonance, a harsh splash of electricity, a crack
    const hit = new Float64Array(nsamp(0.6));
    addAt(hit, S.burst(2820, 120, 420, 0.22, { rise: 0.004 }), 0, 1.0);
    addAt(hit, S.sizzle(0.4, 2821, 0.12, 6000, 2000, 12000), 0, 0.6);
    addAt(hit, S.tiltedBurst(2822, 800.0, 12000.0, 0.02, { tilt: 0.3 }), 0, 0.8);
    m.add('s3-barrier-strike', S.saturate(hit, 2.0), 46.4, [0.0, 1.8, -3.0], {
      target: -9,
      kind: 'i',
      focusDb: 2,
      sendDb: -6,
    });
    // the strain of the field while the bolt presses on it: low-mid noise with a fast flutter
    const strain = S.gravel(1.1, 2830, 150, 500);
    const se = env(
      [
        [46.4, 0],
        [46.5, 1],
        [47.4, 1],
        [47.46, 0],
      ],
      46.4,
      strain.length,
    );
    m.add(
      's3-barrier-strain',
      strain.map((v, i) => v * se[i]!),
      46.4,
      [0.0, 1.8, -3.0],
      { target: -19, kind: 'm', sendDb: -6 },
    );
    // the barrier shatters: crushed brightness, a crack, the glassy shimmer of the field
    const brk = new Float64Array(nsamp(0.6));
    addAt(brk, S.crush(0.6, 2840, 0.12, 900, 9000), 0, 1.0);
    addAt(
      brk,
      S.heavyCrack(2841, { size: 1.0, dur: 0.3, kRate: 12, bright: 1.0 }).subarray(0, brk.length),
      0,
      0.8,
    );
    addAt(brk, shimmer(0.5, 2842), 0, 0.4);
    m.add('s3-barrier-shatter', S.norm(brk), 47.46, [0.0, 2.0, -3.0], {
      target: -10,
      kind: 'i',
      focusDb: 2,
      sendDb: -6,
    });
  });
}

/**
 * Review 9, 2026-11-11: the owner heard junk noise, a tearing, like wind on a microphone with no
 * windscreen. Measured: the master adds little (the soft clip at most 1.2 dB above 8 kHz); the noise
 * layers carried it, the bolt above all. Each layer named here passes two low-pass sections at `fc`
 * (24 dB an octave), its dry part and its hall together: the noise layers at 9 kHz, the cracks at
 * 12 kHz.
 */
export const LOW_9K =
  /^(hair-|gust2|face-wind|stir|pack|seat\d+-scrape|dust-|wave-arrive|charge-corona|barrier-bloom|barrier-block|s3-bolt-plasma|s3-bolt-air|s3-barrier-strain|block-pass|debris-pass)/;
export const LOW_12K =
  /^(s3-bolt-crack|s3-barrier-strike|s3-barrier-shatter|fist-hit|seat\d+$|block-hit)/;

export function lowPass(_m: Mix, name: string, l: Layer): void {
  const fc = LOW_9K.test(name) ? 9000 : LOW_12K.test(name) ? 12000 : 0;
  if (!fc) return;
  for (const part of [l.dry, l.wet])
    for (const ch of part) {
      const y = iir(Float64Array.from(ch), [rbj('lp', fc, 0.7071), rbj('lp', fc, 0.7071)]);
      for (let i = 0; i < ch.length; i++) ch[i] = y[i]!;
    }
}

/** Leave layers out of a mix. */
export function drop(m: Mix, names: readonly string[]): void {
  for (const name of names) {
    m.layers.delete(name);
    for (let i = m.order.length - 1; i >= 0; i--) if (m.order[i] === name) m.order.splice(i, 1);
  }
}

/**
 * The presence pass (`src/study/presence.ts`): the main events get the body of 120 Hz to 2 kHz:
 * scene 1's (its red passage's layers that sound here) and the giant's (its blocks, seats, body,
 * fist, the wave that arrives, the barrier) and the lightning's (the hum, the bolt, the strike).
 */
const MAIN2 =
  /^(barrier-(block|bloom)|block-hit|body-(creak|groan|rumble)|fist-(hit|pressure|slap)|giant-stands|pack-grind|seat\d+$|wave-arrive|charge-hum|s3-(bolt-(crack|thump|plasma)|barrier-(strike|strain|shatter)))/;
function presence2(_m: Mix, name: string, l: Layer): void {
  if (MAIN.test(name) || MAIN2.test(name)) body(l);
}

/** Scene 2, the stone giant: from scene 1's tail to the cut before scene 3. */
export function scene2(): Mix {
  const m = new Mix('scene2', SCENE2_FROM, SCENE2_END, 2.6);
  // the head of scene 3 (the release at 45.70 s and the bolt to the barrier that shatters at 47.46 s)
  m.until = 47.47;
  beds(m);
  redTail(m);
  face(m);
  barrier(m);
  floor(m);
  assembly(m);
  packing(m);
  blocks(m);
  fist(m);
  descentAir(m);
  dustWave(m);
  charge(m);
  scene3Head(m);
  bolt(m);
  m.finish(tidy);
  // review 9: the noise layers lose their harsh top; the cracks keep their snap below 12 kHz
  m.eachLayer('low-pass', lowPass);
  m.eachLayer('scene2-presence', presence2);
  m.driveDb = 8.8;
  // the presence pass: the quiet stretches lifted, the true peak at -1 dBTP
  m.lift = LIFT;
  m.ceilingDb = CEILING_DBTP;
  m.fixedMaster = SCENE1_MASTER;
  m.afterDb = [
    [SCENE2_FROM, 0],
    [47.6, 0],
    [48.2, -60],
  ];
  return m;
}
