// Scene 1 of the reference video, the red seal, 0.0 to 29.5 s, made with the study's models in the
// engine (`src/study/`). The owner, 2026-11-11: the red seal is like a black hole that rapidly sucks
// in the mana around it, so the wind and heavy things like stones are pulled and gather around it.
//
// 20.0 to 29.5 s is the study's red passage (`red.ts`), unchanged. 0.0 to 20.0 s is designed here
// with the same models, the same hall, the same loudness targets and the same master, from the
// frames (read on 2026-11-11 at 2 and 6 frames a second, with a cut detector):
//
//   0.00-3.29   the dark hall behind a curtain of dust; the picture fades in from black
//   3.29-3.87   close on the dark, cloaked figure
//   3.87-4.71   a red glow in its hand grows into an orb with a black core
//   4.71-4.85   white frames: the orb is let go
//   4.88-7.21   close on the orb: the black core, a red streak, blue lines of wind drawn round it
//   7.21-8.05   her face; the wind streams past her toward the orb
//   8.05-9.47   she flies through the white hall; lines of wind; the first small stones
//   9.47-11.55  the orb tears through the hall on a diagonal; stones fly past and at it
//   11.55-14.81 wide: a mass of stones turns round the orb and packs in; she is below
//   14.81-15.47 a face of stone, far; stones above it
//   15.47-16.40 a block falls onto the face and cracks it
//   16.30-17.73 quick cuts: stones fall, she leaps from stone to stone
//   17.73-18.60 dark: slabs pass
//   18.60-20.00 the orb comes back on a streak among flying stones; the red passage follows
//
// The air that is drawn in is the study's model of mana that gathers (noise whose band climbs), made
// continuous: it swells each time the orb is near. Every heavy thing is the study's stone: blocks
// that strike blocks (`blockHit`), stone that grinds (`grind`), a mass that falls (`rubble`), slabs
// that land (`slabFall`), all with the size the picture shows.

import {
  SR,
  addAt,
  fade,
  interp,
  lin,
  lp,
  nsamp,
  rng,
  stftShape,
  white,
  zeros,
  type Stereo,
  type Vec3,
} from '../../src/study/dsp.ts';
import { Mix } from '../../src/study/mix.ts';
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
import { redLayers } from './red.ts';

export const SCENE_END = 29.5;
const ORB = [185.0, 311.0, 466.0, 740.0, 1109.0];

type Points = readonly (readonly [number, number])[];

/**
 * Air that is drawn in: noise whose band climbs as the draw grows (the study's gathering, 260 Hz
 * to 1.1 kHz), a wandering level, a different noise in each ear. `draw` is 0..1 over the layer.
 */
function drawnAir(
  dur: number,
  seed: number,
  draw: Float64Array,
  lo = 260,
  hi = 1100,
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

/** A path that turns round `centre` and closes in on it: a stone that is drawn to the core. */
function spiral(
  n: number,
  centre: Vec3,
  r0: number,
  r1: number,
  turns: number,
  phase: number,
  rise = 0,
) {
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const z = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const u = i / Math.max(1, n - 1);
    const r = r0 + (r1 - r0) * u;
    const a = phase + 2 * Math.PI * turns * u;
    x[i] = centre[0] + r * Math.cos(a);
    y[i] = centre[1] + rise * (1 - u) + 0.3 * r * Math.sin(1.7 * a);
    z[i] = centre[2] + r * Math.sin(a);
  }
  return { x, y, z };
}

/** The red material at a tension that follows (picture seconds, tension) points. */
function material(
  t0: number,
  dur: number,
  seed: number,
  tension: Points,
  mixW: [number, number, number],
): Float64Array {
  const n = nsamp(dur);
  const ten = curve(tension, t0, n);
  const [rumble, roar, crackle] = S.redMaterial(n, ten, seed);
  return sum([mixW[0], rumble], [mixW[1], roar], [mixW[2], crackle]);
}

/** Times of impacts whose rate goes from r0 to r1 a second over `dur`, from a stream. */
function risingTimes(
  r: ReturnType<typeof rng>,
  dur: number,
  r0: number,
  r1: number,
  start = 0.02,
): number[] {
  const out: number[] = [];
  let t = start;
  while (t < dur) {
    out.push(t);
    t += r.exponential(1.0 / (r0 + ((r1 - r0) * t) / dur));
  }
  return out;
}

/** The black hole: 0.0 to 20.0 s. */
export function blackHole(m: Mix): void {
  // ---- 0.00 to 3.29: the dark hall behind a curtain of dust. Something far draws the air.
  const dustEnv = curve(
    [
      [0, 0],
      [0.9, 0.55],
      [2.6, 1],
      [3.29, 0.9],
      [3.4, 0.35],
      [3.9, 0],
    ],
    0,
    nsamp(3.9),
  );
  m.addWide('dust-roll', shapeSt(S.billow(3.9, 1001, 50.0, 500.0), dustEnv), 0.0, {
    target: -24,
    kind: 'm',
    sendDb: -6,
  });
  m.addWide(
    'dust-hiss',
    shapeSt(S.dust(3.9, 1003, { lo: 600.0, hi: 5000.0, grain: 0.2, tilt: 0.6 }), dustEnv),
    0.0,
    { target: -33, kind: 'm' },
  );
  const farDraw = material(
    0.4,
    3.5,
    1005,
    [
      [0.4, 0.05],
      [3.9, 0.25],
    ],
    [1.0, 0.5, 0.0],
  );
  m.add(
    'far-draw',
    times(
      fade(farDraw, 0.3, 0.2),
      curve(
        [
          [0.4, 0],
          [1.5, 0.4],
          [3.29, 1],
          [3.9, 1],
        ],
        0.4,
        farDraw.length,
      ),
    ),
    0.4,
    [0.0, 3.0, -14.0],
    { target: -27, kind: 'm', sendDb: -2 },
  );
  m.add(
    'far-debris',
    S.tumble(3.2, 1007, (t) => 1.2 + 0.8 * t, [0.05, 0.2], [2.0, 5.0]),
    0.3,
    [-6.0, 0.0, -13.0],
    { target: -36, kind: 'm' },
  );

  // ---- 3.29 to 4.71: close on the figure; a red glow in its hand grows into the orb.
  const breath = S.howl(1.5, 1010, [180.0, 270.0, 410.0], 8.0, 0.08, 1.2);
  m.add(
    'draw-breath',
    times(
      breath,
      curve(
        [
          [3.29, 0],
          [3.87, 0.5],
          [4.6, 1],
          [4.71, 0.4],
          [4.79, 0],
        ],
        3.29,
        breath.length,
      ),
    ),
    3.29,
    [0.0, 1.5, -2.0],
    { target: -30, kind: 'm', sendDb: -6 },
  );
  const form = material(
    3.85,
    0.88,
    1020,
    [
      [3.85, 0.0],
      [4.7, 0.65],
    ],
    [0.8, 1.0, 0.5],
  );
  m.add(
    'orb-form',
    times(
      form,
      curve(
        [
          [3.85, 0],
          [4.0, 0.25],
          [4.69, 1],
          [4.712, 0],
        ],
        3.85,
        form.length,
      ),
    ),
    3.85,
    [0.2, 1.3, -1.2],
    { target: -21, kind: 'm', sendDb: -10 },
  );
  const formDraw = curve(
    [
      [3.85, 0.0],
      [4.69, 1.0],
      [4.712, 0.0],
    ],
    3.85,
    nsamp(0.88),
  );
  m.addWide('orb-gather', drawnAir(0.88, 1023, formDraw), 3.85, {
    target: -24,
    kind: 'm',
    sendDb: -6,
  });
  m.add(
    'orb-form-sparks',
    fade(S.pops(0.85, 1022, 22.0, 800, 6000, 0.004), 0.2, 0.01),
    3.86,
    [0.3, 1.2, -1.2],
    {
      target: -31,
      kind: 'm',
      sendDb: -10,
    },
  );

  // ---- 4.71: white frames: the orb is let go. A pressure, a deep body, a tear that falls.
  const [front, low, slp] = S.whump(1030, 0.004, 0.6);
  m.add('launch', S.saturate(sum([0.55, front], [0.9, low], [0.6, slp])), 4.713, [0.0, 1.4, -2.5], {
    target: -13,
    kind: 'i',
    focusDb: 4,
  });
  m.add('launch-boom', S.boom(1031, { f: 70.0, tau: 0.6 }), 4.713, [0.0, 0.5, -3.0], {
    target: -15,
    kind: 'i',
    sendDb: -6,
  });
  m.addWide('launch-tear', S.lance(1032, 0.16, 3500.0, 400.0), 4.705, {
    target: -20,
    kind: 'i',
    sendDb: -6,
  });

  // ---- 4.88 to 7.21: close on the orb. The black core draws the air round it.
  const ORB_CLOSE: Vec3 = [0.0, 1.4, -2.2];
  const hole = material(
    4.86,
    2.36,
    1040,
    [
      [4.86, 0.45],
      [7.2, 0.62],
    ],
    [0.9, 1.0, 0.3],
  );
  m.add('hole-close', fade(hole, 0.02, 0.012), 4.86, ORB_CLOSE, {
    target: -19.5,
    kind: 'm',
    sendDb: -10,
  });
  m.add('hole-voice', fade(S.voice(2.36, 1041, ORB), 0.03, 0.012), 4.86, ORB_CLOSE, {
    target: -23.5,
    kind: 'm',
    sendDb: -12,
  });
  // the blue lines of wind turn round the camera toward the core, faster as they close in
  [0, 1, 2].forEach((i) => {
    const t = 5.75 + 0.22 * i;
    const src = steady(7.21 - t, 1043 + i, 300, 4000);
    const P = spiral(
      src.length,
      [0.0, 1.5, -1.5],
      3.2,
      1.2,
      1.2 + 0.3 * i,
      (2 * Math.PI * i) / 3,
      0.5,
    );
    m.add(`swirl${i}`, src, t, P, { target: -24, kind: 'm', sendDb: -8 });
  });

  // ---- 7.21 to 8.05: her face. The wind streams past her toward the orb.
  const fw = S.wind(0.9, 1050, 300, 3500);
  m.addWide(
    'face-wind',
    shapeSt(
      fw,
      curve(
        [
          [7.2, 0.6],
          [7.5, 1],
          [8.05, 0.8],
          [8.1, 0],
        ],
        7.2,
        fw[0].length,
      ),
    ),
    7.2,
    { target: -24, kind: 'm' },
  );
  const irr = S.irregular(nsamp(0.85), 1052, 2, 9);
  m.add(
    'face-hair',
    S.cloth(0.85, 1051, 300).map((v, i) => v * (0.6 + 0.4 * irr[i]!)),
    7.22,
    [0.2, 1.5, -0.8],
    { target: -29, kind: 'm', sendDb: -10 },
  );
  m.add(
    'hole-off',
    fade(
      material(
        7.21,
        0.86,
        1053,
        [
          [7.21, 0.55],
          [8.07, 0.5],
        ],
        [1.0, 1.0, 0.2],
      ),
      0.01,
      0.02,
    ),
    7.21,
    [1.5, 1.5, -6.0],
    { target: -26, kind: 'm', sendDb: -4 },
  );

  // ---- 8.05 to 9.47: she flies through the white hall; the first small stones drift in the draw.
  const fa = S.wind(1.45, 1060, 150, 1500);
  m.addWide(
    'fly-air',
    shapeSt(fa, fade(new Float64Array(fa[0].length).fill(1), 0.03, 0.03)),
    8.05,
    {
      target: -22,
      kind: 'm',
    },
  );
  m.add(
    'fly-whoosh',
    S.bandSweep(0.6, 1061, 300.0, 2000.0),
    8.1,
    line([-4.0, 1.5, -2.0], [4.0, 1.5, -1.0], nsamp(0.6)),
    {
      target: -26,
      kind: 'm',
      sendDb: -8,
    },
  );
  m.add(
    'pebbles',
    S.tumble(1.4, 1062, (t) => 3.0 + 6.0 * t, [0.03, 0.1], [2.0, 5.0]),
    8.1,
    [2.0, 1.0, -5.0],
    { target: -31, kind: 'm', sendDb: -6 },
  );

  // ---- 9.47 to 11.55: the orb tears through the hall; stones fly past and at it.
  const tear = material(
    9.47,
    2.08,
    1070,
    [
      [9.47, 0.25],
      [11.55, 0.35],
    ],
    [0.8, 1.0, 0.4],
  );
  const tearPath = line([-1.5, 2.0, -5.0], [0.8, 1.4, -3.0], tear.length);
  m.add('orb-tear', fade(tear, 0.015, 0.012), 9.47, tearPath, {
    target: -20.5,
    kind: 'm',
    sendDb: -10,
  });
  m.add('orb-tear-voice', fade(S.voice(2.08, 1071, ORB), 0.03, 0.012), 9.47, tearPath, {
    target: -21.5,
    kind: 'm',
    sendDb: -12,
  });
  m.add(
    'orb-tear-sparks',
    fade(S.pops(2.08, 1072, 16.0, 500, 4000, 0.005), 0.02, 0.01),
    9.47,
    [1.0, 1.5, -3.0],
    {
      target: -28,
      kind: 'm',
      sendDb: -10,
    },
  );
  const tearPasses: [number, number, number, number][] = [
    [9.62, 1, 2.4, -26],
    [9.86, -1, 1.9, -25],
    [10.05, 1, 1.5, -24],
    [10.38, -1, 2.2, -26],
    [10.66, 1, 1.3, -23],
    [10.98, -1, 1.6, -24],
    [11.3, 1, 2.0, -25],
  ];
  tearPasses.forEach(([t, side, near, tg], i) => {
    const src = steady(0.4, 1074 + i, 120, 2600);
    const k = src.length;
    const h = Math.floor(k / 2);
    const P = concat(
      line([side * 0.8, 1.6, -10.0], [side * near, 1.5, 0.0], h),
      line([side * near, 1.5, 0.0], [side * (near + 1.0), 1.4, 9.0], k - h),
    );
    m.add(`tear-pass${i}`, src, t - 0.2, P, { target: tg, kind: 'i', sendDb: -10 });
  });
  const rt = rng(1085);
  (
    [
      [10.17, 0.45, [0.6, 1.5, -3.2]],
      [10.86, 0.6, [-0.4, 1.6, -3.4]],
    ] as [number, number, Vec3][]
  ).forEach(([t, size, pos], i) => {
    const hit = zeros(nsamp(0.7));
    addAt(hit, S.norm(S.stoneImpact(size, 14.0, rt)), 0);
    addAt(
      hit,
      S.heavyCrack(1086 + i, { size, dur: 0.3, kRate: 8 }).subarray(0, hit.length),
      0,
      0.6,
    );
    addAt(hit, S.sizzle(0.7, 1088 + i, 0.14), 0, 0.3);
    m.add(`tear-hit${i}`, hit, t, pos, { target: -18 + i, kind: 'i', sendDb: -6 });
    m.add(`tear-hit${i}-slap`, S.slap(hit, 1200), t + 0.21, [8.5 * (i ? -1 : 1), 2.0, -8.0], {
      target: -27 + i,
      kind: 'i',
      sendDb: -6,
    });
  });

  // ---- 11.55 to 14.81: wide. A mass of stones turns round the orb and packs in.
  const CORE: Vec3 = [0.0, 3.0, -10.0];
  const gc = material(
    11.55,
    3.27,
    1090,
    [
      [11.55, 0.25],
      [14.8, 0.45],
    ],
    [1.0, 1.0, 0.3],
  );
  m.add('gather-core', fade(gc, 0.01, 0.015), 11.55, CORE, {
    target: -23,
    kind: 'm',
    focusDb: 3,
    sendDb: -4,
  });
  m.add('gather-voice', fade(S.voice(3.27, 1091, ORB.slice(0, 4)), 0.01, 0.015), 11.55, CORE, {
    target: -26,
    kind: 'm',
    sendDb: -4,
  });
  const grindEnv = (n: number) =>
    curve(
      [
        [11.55, 0.35],
        [13.2, 0.7],
        [14.75, 1.0],
        [14.82, 0.0],
      ],
      11.55,
      n,
    );
  (
    [
      [-3.0, 3.0, -10.0],
      [3.0, 3.5, -11.0],
    ] as Vec3[]
  ).forEach((pos, i) => {
    const g = S.grind(3.27, 1092 + i, { rLo: 50, rHi: 160 });
    m.add(`gather-grind${i}`, times(g, grindEnv(g.length)), 11.55, pos, {
      target: -21,
      kind: 'm',
      focusDb: 3,
      sendDb: -4,
    });
  });
  // blocks strike blocks, faster and faster, as they are pulled in from all sides
  const rg = rng(1095);
  const gt = risingTimes(rg, 3.2, 4.0, 15.0);
  (
    [
      ['l', -6.0],
      ['c', 0.0],
      ['r', 6.0],
    ] as const
  ).forEach(([side, x0], idx) => {
    const mine = gt.filter((_, k) => k % 3 === idx);
    const cl = ticks(
      mine,
      (i) => {
        const size = rg.uniform(0.45, 1.3);
        const v = rg.uniform(5.0, 10.0);
        return times(S.blockHit(1100 + 7 * i + idx, size, v), 0.55 + (0.45 * mine[i]!) / 3.2);
      },
      3.6,
    );
    const P = line([x0, 1.0 + Math.abs(x0) * 0.4, -7.0], CORE, cl.length);
    m.add(`gather-clump-${side}`, cl, 11.55, P, { target: -19, kind: 'i', focusDb: 3, sendDb: -4 });
  });
  m.add(
    'gather-rubble',
    S.rubble(3.2, 1097, (t) => 8.0 + 6.0 * t, { sizes: [0.15, 0.6], bright: 0.2, body: 0.6 }),
    11.6,
    [0.5, 2.5, -9.0],
    { target: -25, kind: 'm', focusDb: 2, sendDb: -4 },
  );
  [0, 1, 2, 3].forEach((i) => {
    const t = 11.6 + 0.35 * i;
    const src = steady(14.78 - t, 1098 + 13 * i, 100, 1800);
    const P = spiral(src.length, CORE, 6.0 - 0.5 * i, 2.0, 0.8 + 0.25 * i, (Math.PI * i) / 2, 1.5);
    m.add(`orbit${i}`, src, t, P, { target: -27, kind: 'm', sendDb: -6 });
  });
  const gl = S.billow(3.27, 1099, 35.0, 180.0, 2.0);
  m.addWide(
    'gather-low',
    shapeSt(
      gl,
      curve(
        [
          [11.55, 0.4],
          [14.7, 1],
          [14.82, 0.2],
          [14.82 + 3.26, 0],
        ],
        11.55,
        gl[0].length,
      ),
    ),
    11.55,
    { target: -25, kind: 'm', sendDb: -4 },
  );

  // ---- 14.81 to 15.47: a face of stone, far. The stone groans; the gathering goes on, far.
  m.add(
    'face-groan',
    S.groan(0.62, 1110, { rLo: 60, rHi: 130, res: [90.0, 170.0, 320.0] }),
    14.84,
    [1.0, 0.5, -6.0],
    {
      target: -26,
      kind: 'm',
      focusDb: 2,
    },
  );
  m.add(
    'face-grind',
    times(
      S.grind(0.66, 1111),
      curve(
        [
          [14.81, 1.0],
          [15.47, 0.6],
        ],
        14.81,
        nsamp(0.66),
      ),
    ),
    14.81,
    [-4.0, 4.0, -16.0],
    { target: -30, kind: 'm', sendDb: -2 },
  );

  // ---- 15.47 to 16.40: a block falls onto the face and cracks it.
  m.add('block-land', S.slabFall(1120, 1.6), 15.56, [0.5, 0.0, -6.0], {
    target: -11,
    kind: 'i',
    focusDb: 3,
    sendDb: -3,
  });
  m.add('block-land-body', S.boom(1121, { f: 62.0, tau: 0.7 }), 15.56, [0.5, 0.0, -6.0], {
    target: -14,
    kind: 'i',
    sendDb: -4,
  });
  const rc = rng(1122);
  const ct = risingTimes(rc, 0.5, 26.0, 10.0, 0.04);
  const cracks = ticks(
    ct,
    (i) => {
      const size = rc.uniform(0.2, 0.6);
      return times(S.stoneCrack(rc, size, 0.4), rc.uniform(0.5, 1.0) * Math.exp(-ct[i]! / 0.4));
    },
    0.9,
  );
  m.add('block-cracks', cracks, 15.58, [0.3, 0.3, -4.0], {
    target: -19,
    kind: 'i',
    focusDb: 2,
    sendDb: -6,
  });
  m.addWide('block-dust', S.puff(1.5, 1123, 150.0, 4000.0, 0.06, 0.5), 15.6, {
    target: -25,
    kind: 'i',
    sendDb: -4,
  });
  m.add('block-slap', S.slap(S.slabFall(1120, 1.6), 900), 15.56 + 0.22, [0.0, 3.0, -15.0], {
    target: -22,
    kind: 'i',
    focusDb: 6,
  });

  // ---- 16.30 to 17.73: quick cuts. Stones fall; she leaps from stone to stone.
  (
    [
      [16.33, 'block', 0.8, [-1.5, 0.5, -4.0], -17],
      [16.62, 'fall', 0.3, [2.0, 0.0, -5.0], -21],
      [16.9, 'block', 0.6, [1.0, 0.8, -3.5], -18],
      [17.07, 'crack', 1.0, [-2.0, 0.5, -6.0], -17],
      [17.24, 'fall', 0.25, [2.5, 0.0, -4.5], -22],
      [17.4, 'block', 0.5, [-0.5, 1.0, -3.0], -19],
      [17.57, 'fall', 0.2, [1.5, 0.0, -5.5], -23],
    ] as [number, string, number, Vec3, number][]
  ).forEach(([t, kind, size, pos, tg], i) => {
    const s =
      kind === 'block'
        ? S.blockHit(1130 + i, size, 7.0)
        : kind === 'crack'
          ? S.heavyCrack(1130 + i, { size, dur: 0.4, kRate: 8, bright: 0.5 })
          : S.rockFall(size, 2.0, 1130 + i);
    m.add(`leap-hit${i}`, s, t, pos, { target: tg, kind: 'i', focusDb: 2, sendDb: -6 });
  });
  [16.6, 17.18].forEach((t, i) =>
    m.add(
      `leap-whoosh${i}`,
      S.bandSweep(0.28, 1140 + i, 400.0, 2500.0),
      t,
      line([3.0 * (i ? 1 : -1), 1.5, -2.0], [-3.0 * (i ? 1 : -1), 1.6, -1.0], nsamp(0.28)),
      { target: -26, kind: 'i', sendDb: -8 },
    ),
  );
  m.add(
    'leap-debris',
    S.tumble(1.5, 1142, (t) => 10.0 - 4.0 * t, [0.05, 0.25], [3.0, 7.0]),
    16.3,
    [0.0, 0.0, -7.0],
    { target: -27, kind: 'm', focusDb: 2 },
  );

  // ---- 17.73 to 18.60: dark. Slabs pass; the draw rumbles far.
  (
    [
      [17.85, -1, 2.0],
      [18.12, 1, 1.6],
      [18.38, -1, 2.4],
    ] as const
  ).forEach(([t, side, near], i) => {
    const src = steady(0.5, 1150 + i, 80, 1500);
    const k = src.length;
    const h = Math.floor(k / 2);
    const P = concat(
      line([side * 1.0, 2.0, -9.0], [side * near, 1.8, 0.0], h),
      line([side * near, 1.8, 0.0], [side * (near + 1.0), 1.6, 8.0], k - h),
    );
    m.add(`slab-pass${i}`, src, t - 0.25, P, { target: -24, kind: 'i', sendDb: -8 });
  });
  m.add(
    'dark-draw',
    fade(
      material(
        17.7,
        1.0,
        1153,
        [
          [17.7, 0.1],
          [18.7, 0.15],
        ],
        [1.0, 0.6, 0.1],
      ),
      0.05,
      0.1,
    ),
    17.7,
    [0.0, 3.0, -14.0],
    { target: -27, kind: 'm', sendDb: -2 },
  );

  // ---- 18.60 to 20.00: the orb comes back on a streak among flying stones.
  const ap = material(
    18.6,
    1.45,
    1160,
    [
      [18.6, 0.1],
      [20.05, 0.15],
    ],
    [0.8, 1.0, 0.4],
  );
  const apPath = line([-6.0, 2.0, -24.0], [0.0, 1.5, -3.0], ap.length);
  const apEnv = curve(
    [
      [18.6, 0],
      [18.7, 0.5],
      [19.9, 1],
      [20.05, 0],
    ],
    18.6,
    ap.length,
  );
  m.add('orb-approach', times(ap, apEnv), 18.6, apPath, { target: -22, kind: 'm', sendDb: -8 });
  m.add('orb-approach-voice', times(S.voice(1.45, 1161, ORB), apEnv), 18.6, apPath, {
    target: -22,
    kind: 'm',
    sendDb: -10,
  });
  (
    [
      [18.75, 1, 2.6, -27],
      [19.05, -1, 2.0, -26],
      [19.3, 1, 1.7, -25],
      [19.55, -1, 1.4, -24],
      [19.82, 1, 2.2, -26],
    ] as [number, number, number, number][]
  ).forEach(([t, side, near, tg], i) => {
    const src = steady(0.36, 1162 + i, 150, 3000);
    const k = src.length;
    const h = Math.floor(k / 2);
    const P = concat(
      line([side * 0.6, 1.5, -9.0], [side * near, 1.5, 0.0], h),
      line([side * near, 1.5, 0.0], [side * (near + 0.8), 1.5, 9.0], k - h),
    );
    m.add(`approach-pass${i}`, src, t - 0.18, P, { target: tg, kind: 'i', sendDb: -10 });
  });
  const aa = S.wind(1.45, 1168, 150, 1500);
  m.addWide(
    'approach-air',
    shapeSt(
      aa,
      curve(
        [
          [18.6, 0],
          [19.95, 1],
          [20.05, 0],
        ],
        18.6,
        aa[0].length,
      ),
    ),
    18.6,
    { target: -26, kind: 'm' },
  );

  // ---- 3.87 to 20.05: the draw itself. Air that is pulled to the core, all the time the orb is
  // there; it swells when the orb is near and climbs as it grows, and hands over to the red passage.
  const DRAW: Points = [
    [3.87, 0.0],
    [4.6, 0.75],
    [4.71, 0.35],
    [4.9, 0.95],
    [7.2, 1.0],
    [7.25, 0.55],
    [8.05, 0.5],
    [9.47, 0.55],
    [10.6, 1.0],
    [11.55, 0.75],
    [14.75, 1.0],
    [14.82, 0.35],
    [15.47, 0.3],
    [16.3, 0.45],
    [17.73, 0.4],
    [18.6, 0.55],
    [19.95, 1.0],
    [20.05, 0.0],
  ];
  const dd = 20.05 - 3.87;
  const draw = curve(DRAW, 3.87, nsamp(dd));
  m.addWide('draw', drawnAir(dd, 1170, draw, 220, 900, 1.2), 3.87, {
    target: -23,
    kind: 'm',
    sendDb: -5,
  });
  const lowDraw = material(
    3.87,
    dd,
    1172,
    [
      [3.87, 0.1],
      [20.05, 0.2],
    ],
    [1.0, 0.25, 0.0],
  );
  m.add('draw-low', times(lowDraw, draw), 3.87, [0.0, 2.5, -8.0], {
    target: -25,
    kind: 'm',
    sendDb: -3,
  });
}

// ---- The black hole's own body (review 1, 2026-11-11). The owner heard no black hole where it is on
// screen and close. The orb above had only the red material (a roar from 480 Hz to 1.1 kHz) and
// tones, and stones and wind covered it. The body below is a deep torrent that draws in, felt
// under the camera: the study's turbulence on a low spectrum, a core that moves with the orb, air
// that rushes in, and a pressure under 70 Hz. One proximity curve, read from the frames, sets its
// level, its low weight, its width and its brightness. Every level wanders with no period.

/** How near the orb is, 0 (gone) to 1 (overhead or beside the camera), reference seconds. */
export const PROXIMITY: Points = [
  [3.87, 0.0],
  [4.4, 0.25],
  [4.69, 0.5],
  [4.712, 0.2],
  [4.86, 0.75],
  [5.3, 1.0],
  [7.2, 1.0],
  [7.25, 0.5],
  [8.05, 0.3],
  [9.47, 0.35],
  [10.0, 0.85],
  [10.25, 1.0],
  [10.6, 0.9],
  [11.0, 0.65],
  [11.55, 0.6],
  [12.5, 0.75],
  [13.5, 0.85],
  [14.3, 0.8],
  [14.81, 0.65],
  [14.85, 0.12],
  [18.6, 0.2],
  [19.2, 0.5],
  [19.9, 1.0],
  [20.4, 1.0],
  [21.0, 0.75],
  [22.28, 0.55],
  [22.31, 0.0],
];
const HOLE_FROM = 3.87;
const HOLE_TO = 22.31;

/** The spectrum of the hole: its weight from 30 to 150 Hz, falling above (Hz, dB). */
const HOLE_CURVE: readonly (readonly [number, number])[] = [
  [20, -14],
  [30, -6],
  [45, -1],
  [60, 0],
  [90, 0],
  [150, -2],
  [300, -5],
  [600, -8],
  [1200, -12],
  [2500, -17],
  [5000, -24],
  [10000, -32],
  [14000, -38],
];
const HOLE_BANDS: readonly (readonly [number, number, number, number, number])[] = [
  [22.0, 110.0, 2.0, 0.3, 4.0],
  [110.0, 600.0, 2.5, 0.5, 7.0],
  [600.0, 3000.0, 4.0, 1.0, 11.0],
  [3000.0, 12000.0, 5.0, 1.0, 13.0],
];

/** Where the orb is in each shot: (reference seconds, position) keys. A cut starts a new shot. */
const HOLE_SHOTS: readonly (readonly (readonly [number, Vec3])[])[] = [
  [
    [3.87, [0.2, 1.3, -1.2]],
    [4.86, [0.0, 2.6, -1.6]],
    [7.22, [0.3, 2.8, -1.4]],
  ],
  [
    [7.21, [1.5, 2.0, -6.0]],
    [9.48, [-1.0, 2.5, -9.0]],
  ],
  [
    [9.47, [-1.5, 3.0, -12.0]],
    [10.25, [0.0, 3.2, -0.8]],
    [11.0, [1.5, 2.8, 8.0]],
    [11.56, [2.0, 2.8, 14.0]],
  ],
  [
    [11.55, [-7.0, 6.0, -8.0]],
    [14.82, [7.0, 5.5, -6.0]],
  ],
  [
    [14.81, [0.0, 4.0, -16.0]],
    [18.61, [-3.0, 3.0, -20.0]],
  ],
  [
    [18.6, [-6.0, 2.5, -24.0]],
    [20.0, [0.0, 2.4, -1.5]],
    [21.0, [0.3, 2.0, -2.5]],
    [22.31, [0.6, 1.5, -3.0]],
  ],
];

const proximityAt = (t: number): number =>
  interp(
    t,
    PROXIMITY.map((p) => p[0]),
    PROXIMITY.map((p) => p[1]),
  );

function holeBody(m: Mix): void {
  const dur = HOLE_TO - HOLE_FROM;
  const n = nsamp(dur);
  const prox = curve(PROXIMITY, HOLE_FROM, n);
  const pw = (e: number) => prox.map((p) => p ** e);
  // the torrent: four bands of one deep spectrum, each with its own wandering level; the nearer the
  // orb, the more of the upper bands (the inrush is heard only near it) and the louder the whole
  const bands = S.turbulence(dur, 1200, HOLE_CURVE, HOLE_BANDS, 0.25);
  const weights = [pw(0.8), pw(1.0), pw(1.7), pw(2.6)];
  const roar: Stereo = [new Float64Array(n), new Float64Array(n)];
  bands.forEach((b, k) => {
    for (let c = 0; c < 2; c++)
      for (let i = 0; i < n; i++) roar[c]![i] = roar[c]![i]! + b[c]![i]! * weights[k]![i]!;
  });
  m.addWide('hole-roar', [fade(roar[0], 0.05, 0.02), fade(roar[1], 0.05, 0.02)], HOLE_FROM, {
    target: -14.5,
    kind: 'm',
    sendDb: -6,
  });
  // the core: the same deep noise as one source that moves with the orb, shot by shot, so its
  // distance, its side and its Doppler shift come from the path
  const core0 = S.curveNoise(n, 1210, HOLE_CURVE);
  const walk = S.levelWalk(n, 1211, 2.0, 0.3, 4.0);
  const core = core0.map((v, i) => v * walk[i]! * prox[i]! ** 0.7);
  HOLE_SHOTS.forEach((keys, k) => {
    const a = Math.max(0, nsamp(keys[0]![0] - HOLE_FROM));
    const b = Math.min(n, nsamp(keys[keys.length - 1]![0] - HOLE_FROM));
    m.add(`hole-core${k}`, fade(core.slice(a, b), 0.01, 0.01), HOLE_FROM + a / SR, keys, {
      target: null,
      gainDb: 0,
      focusDb: 0,
      sendDb: -8,
    });
  });
  // the inrush: air drawn into the core, its band climbing as the orb nears
  m.addWide('hole-inrush', drawnAir(dur, 1220, pw(1.4), 150, 1400, 1.3), HOLE_FROM, {
    target: -19,
    kind: 'm',
    sendDb: -6,
  });
  // the pressure under the camera: noise from 25 to 70 Hz, only when the orb is near
  const pr = S.wideNoise(dur, 1230, 25, 70, 3, false);
  const pe = pw(2.0);
  m.addWide(
    'hole-pressure',
    [
      fade(
        pr[0].map((v, i) => v * pe[i]!),
        0.05,
        0.02,
      ),
      fade(
        pr[1].map((v, i) => v * pe[i]!),
        0.05,
        0.02,
      ),
    ],
    HOLE_FROM,
    {
      target: -22,
      kind: 'm',
    },
  );
}

/** The core's level, set against the roar once both are in the mix: 3 dB under it at the closest. */
function levelCore(m: Mix): void {
  const roar = m.layers.get('hole-roar')!;
  let er = 0;
  for (const ch of roar.dry) for (const v of ch) er = Math.max(er, Math.abs(v));
  let ec = 0;
  for (let k = 0; k < HOLE_SHOTS.length; k++)
    for (const ch of m.layers.get(`hole-core${k}`)!.dry)
      for (const v of ch) ec = Math.max(ec, Math.abs(v));
  const g = (er / ec) * lin(-3);
  for (let k = 0; k < HOLE_SHOTS.length; k++) {
    const l = m.layers.get(`hole-core${k}`)!;
    for (const part of [l.dry, l.wet])
      for (const ch of part) for (let i = 0; i < ch.length; i++) ch[i] = ch[i]! * g;
  }
}

/** The layers that cover the hole while it is near: stones that fly, wind, passing rocks. */
const COVERS =
  /^(face-wind|fly-air|fly-whoosh|pebbles|tear-pass|gather-clump|gather-grind|gather-rubble|orbit|gather-low|approach-pass|approach-air|flight-air|rock-pass|slab-pass|dark-draw)/;

/**
 * Carve the covering layers while the orb is near: up to 6 dB under 500 Hz and 2 dB in all, with
 * the proximity. The landings and the strikes are not touched.
 */
function carve(m: Mix): void {
  for (const name of m.order) {
    if (!COVERS.test(name)) continue;
    const l = m.layers.get(name)!;
    for (const part of [l.dry, l.wet])
      for (const ch of part) {
        const x = Float64Array.from(ch);
        const low = lp(x, 500);
        for (let i = 0; i < ch.length; i++) {
          const p = proximityAt(m.t0 + (l.start + i) / SR);
          if (p <= 0) continue;
          ch[i] = lin(-2 * p) * (x[i]! - low[i]! + lin(-6 * p) * low[i]!);
        }
      }
  }
}

/** Scene 1, the red seal: the black hole, then the study's red passage. */
export function scene(): Mix {
  const m = new Mix('scene1', 0.0, SCENE_END, 1.5);
  m.until = SCENE_END;
  fullBed(m, 0.0, SCENE_END + 1.5, 101, -41.0, [
    [0, -30],
    [1.0, 0],
    [24.7, 0],
    [25.3, -4],
    [25.7, -4],
    [26.6, 0],
    [SCENE_END + 1.5, 0],
  ]);
  blackHole(m);
  redLayers(m, { bed: false });
  holeBody(m);
  levelCore(m);
  carve(m);
  m.driveDb = 8.8;
  // the end of the scene: the sound fades over the first second of the next shot
  m.afterDb = [
    [0, 0],
    [SCENE_END, 0],
    [SCENE_END + 1.0, -60],
  ];
  return m;
}
