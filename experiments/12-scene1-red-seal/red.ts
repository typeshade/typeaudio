// The red passage of the study (`passages.py`, `red()`, round 11), 20.0 to 30.0 s of the picture,
// made with the study's models in the engine (`src/study/`). Every statement is the study's, in the
// study's order, so that with the shared generator the passage gives the study's samples
// (`parity.ts`). The comments are the study's.

import {
  SR,
  bandGain,
  fade,
  linspace,
  nsamp,
  peak,
  rng,
  spectral,
  white,
  zeros,
  addAt,
  type Stereo,
  type Vec3,
  stftShape,
} from "../../src/study/dsp.ts";
import { Mix } from "../../src/study/mix.ts";
import {
  concat,
  curve,
  fullBed,
  line,
  shapeSt,
  spread,
  steady,
  sum,
  ticks,
  times,
} from "../../src/study/passage.ts";
import * as S from "../../src/study/sources.ts";

// the anchors of the picture study (frame-accurate)
export const RED_FRACTURE = 25.692333;
export const RED_RELEASE = 25.77575;
export const ICE = 26.317958;
export const ICE_FLASH = 26.5265;
export const ICE_CLEAR = 26.609917;

const T0 = 20.0;
const len = (x: { length: number }) => x.length;

/** The red passage as the study's `red()` builds it. */
export function red(): Mix {
  const m = new Mix("red", 20.0, 30.0);
  fullBed(m, T0, 12.5, 101, -41.0, [
    [20, 0],
    [24.7, 0],
    [25.3, -4],
    [25.7, -4],
    [26.6, 0],
    [32.5, 0],
  ]);

  // 20.00 to 22.30: the camera flies with the orb. The orb stays in front of us; rocks pass on both sides.
  const n = nsamp(22.3 - T0);
  let [rumble, roar, crackle] = S.redMaterial(
    n,
    new Float64Array(n).fill(0.15),
    111,
  );
  m.add(
    "orb-flight",
    fade(sum([0.8, rumble], [1.0, roar], [0.4, crackle]), 0.03, 0.01),
    T0,
    [0.0, 1.5, -3.0],
    {
      target: -21.5,
      kind: "m",
      sendDb: -12,
    },
  );
  const rush = S.wind(22.3 - T0, 114, 150, 1500);
  m.addWide(
    "flight-air",
    shapeSt(rush, fade(new Float64Array(len(rush[0])).fill(1), 0.03, 0.01)),
    T0,
    { target: -25, kind: "m" },
  );
  const passes: [number, number, number, number][] = [
    [20.15, -1, 2.2, -26],
    [20.42, 1, 2.6, -27],
    [20.63, -1, 1.8, -25],
    [20.88, 1, 2.4, -26],
    [21.02, -1, 2.0, -26],
    [21.52, 1, 2.2, -26],
    [21.66, -1, 1.2, -23],
    [21.74, 1, 1.3, -23],
    [22.08, -1, 1.1, -22],
  ];
  passes.forEach(([t, side, near, tg], i) => {
    const src = steady(0.36, 300 + i, 150, 3000);
    const k = src.length;
    const h = Math.floor(k / 2);
    const P = concat(
      line([side * 0.6, 1.5, -9.0], [side * near, 1.5, 0.0], h),
      line([side * near, 1.5, 0.0], [side * (near + 0.8), 1.5, 9.0], k - h),
    );
    m.add(`rock-pass${i}`, src, t - 0.18, P, {
      target: tg,
      kind: "i",
      sendDb: -10,
    });
  });

  // the orb strikes rock twice (sparks at 21.12 and 21.80), and a rock bursts toward the camera at 21.98
  const r = rng(120);
  const hit1 = zeros(nsamp(0.6));
  addAt(hit1, S.norm(S.stoneImpact(0.35, 14.0, r)), 0);
  addAt(hit1, S.sizzle(0.6, 121, 0.12), 0, 0.3);
  m.add("spark-hit1", hit1, 21.12, [0.3, 1.5, -3.0], {
    target: -19,
    kind: "i",
    sendDb: -6,
  });
  const hit2 = zeros(nsamp(0.7));
  addAt(hit2, S.norm(S.stoneImpact(0.5, 16.0, r)), 0);
  addAt(
    hit2,
    S.heavyCrack(122, { size: 0.5, dur: 0.3, kRate: 8 }).subarray(
      0,
      hit2.length,
    ),
    0,
    0.6,
  );
  addAt(hit2, S.sizzle(0.7, 123, 0.16), 0, 0.35);
  m.add("spark-hit2", hit2, 21.8, [-0.2, 1.5, -3.0], {
    target: -16,
    kind: "i",
    sendDb: -6,
  });
  const rb = S.norm(S.rockFall(0.35, 1.5, 124));
  addAt(
    rb,
    S.heavyCrack(126, { size: 0.7, dur: 0.4, kRate: 8 }).subarray(0, rb.length),
    0,
    0.9,
  );
  m.add("rock-burst", rb, 21.98, [-0.8, 1.2, -1.5], {
    target: -16,
    kind: "i",
    sendDb: -6,
  });

  // 22.31 to 22.78: close on the flame as it tears through stone
  const n2 = nsamp(22.79 - 22.31);
  [rumble, roar, crackle] = S.redMaterial(
    n2,
    new Float64Array(n2).fill(0.35),
    115,
  );
  m.add(
    "flame-close",
    fade(sum([0.8, rumble], [1.0, roar], [0.4, crackle]), 0.008, 0.01),
    22.31,
    [0.6, 1.2, -1.4],
    {
      target: -18.5,
      kind: "m",
      sendDb: -12,
    },
  );
  m.add(
    "flame-crumble",
    fade(S.gravel(22.79 - 22.31, 116), 0.008, 0.01),
    22.31,
    [1.0, 0.8, -2.0],
    { target: -22, kind: "m", sendDb: -8 },
  );
  // 22.80 to 23.02: the camera whips
  m.addWide("whip", S.bandSweepWide(0.22, 117, 400, 3000), 22.8, {
    target: -22,
    kind: "i",
  });

  // 23.06 to 23.77: wide; the red core is far, and the stone of the hall is pulled to it
  const rrG = rng(127);
  const n3 = nsamp(23.76 - 23.06);
  [rumble, roar, crackle] = S.redMaterial(
    n3,
    new Float64Array(n3).fill(0.3),
    118,
  );
  m.add(
    "orb-far",
    fade(sum([0.8, rumble], [1.0, roar], [0.3, crackle]), 0.01, 0.01),
    23.06,
    line([2.0, 3.0, -10.0], [0.0, 2.0, -9.0], n3),
    {
      target: -26,
      kind: "m",
      sendDb: -4,
    },
  );
  // The frames show blocks of stone that fly in from all sides and pack around a glowing core. Blocks
  // strike blocks, faster and faster, and the mass grinds as it closes.
  const core: Vec3 = [0.0, 2.5, -9.0];
  const gt: number[] = [];
  let t = 0.03;
  while (t < 0.7) {
    gt.push(t);
    t += rrG.exponential(1.0 / (7.0 + (22.0 * t) / 0.7));
  }
  (
    [
      ["l", -4.5],
      ["c", 0.0],
      ["r", 4.5],
    ] as const
  ).forEach(([side, x0], idx) => {
    const mine = gt.filter((_, k) => k % 3 === idx);
    const cl = ticks(
      mine,
      (i) => {
        const size = rrG.uniform(0.35, 1.0);
        const v = rrG.uniform(6.0, 11.0);
        return times(
          S.blockHit(500 + 7 * i + idx, size, v),
          0.5 + (0.5 * mine[i]!) / 0.7,
        );
      },
      1.5,
    );
    const P = line([x0, 1.0 + Math.abs(x0) * 0.4, -8.0], core, cl.length);
    m.add(`clump-${side}`, cl, 23.06, P, {
      target: -19,
      kind: "i",
      focusDb: 4,
      sendDb: -4,
    });
  });
  (
    [
      [23.08, [-7.0, 1.0, -4.0]],
      [23.17, [6.5, 4.0, -5.0]],
      [23.29, [-5.0, 5.0, -12.0]],
      [23.38, [7.0, 0.5, -11.0]],
      [23.5, [-6.0, 2.0, -6.0]],
    ] as [number, Vec3][]
  ).forEach(([tt, a], i) => {
    const src = steady(0.26, 520 + i, 150, 2500);
    m.add(`pull${i}`, src, tt, line(a, core, src.length), {
      target: -26,
      kind: "i",
      sendDb: -8,
    });
  });
  const g0 = S.grind(0.52, 526);
  const gr = times(g0, linspace(0.3, 1.0, S.grind(0.52, 526).length));
  m.add("clump-grind", gr, 23.26, core, {
    target: -22,
    kind: "m",
    focusDb: 4,
    sendDb: -4,
  });
  m.add(
    "target-strike",
    S.burst(129, 35, 140, 0.08, { rise: 0.004 }),
    23.7,
    [0.0, 2.0, -9.0],
    { target: -22, kind: "i", focusDb: 4 },
  );

  // 23.81 to 24.65: close on red cracks that spread across the stone
  let span = 24.65 - 23.81;
  const rr = rng(130);
  const tt: number[] = [];
  t = 0.0;
  while (t < span) {
    tt.push(t);
    t += rr.exponential(1.0 / (12 + (16 * t) / span));
  }
  const oneCrack = () => {
    const size = rr.uniform(0.12, 0.4);
    const c = S.stoneCrack(rr, size);
    return times(c, rr.uniform(0.5, 1.0));
  };
  const crack = ticks(tt, oneCrack, span + 0.4);
  const close: Vec3 = [0.3, 1.4, -1.6];
  m.add("crack-spread", crack, 23.81, close, {
    target: -21,
    kind: "i",
    sendDb: -8,
  });
  // the plates of stone lock into one another: five heavy seatings, and the grind between them
  (
    [
      [23.83, 0.9, -0.6],
      [23.97, 0.6, 0.7],
      [24.09, 1.0, 0.1],
      [24.22, 0.7, -0.4],
      [24.36, 0.8, 0.5],
    ] as const
  ).forEach(([tl, size, x], i) => {
    m.add(`lock${i}`, S.blockHit(530 + i, size, 5.0), tl, [x, 1.3, -1.7], {
      target: -18,
      kind: "i",
      sendDb: -8,
    });
  });
  const gc = S.grind(0.62, 536);
  m.add(
    "lock-grind",
    times(
      gc,
      curve(
        [
          [23.81, 0.6],
          [24.2, 1.0],
          [24.43, 0.0],
        ],
        23.81,
        gc.length,
      ),
    ),
    23.81,
    [0.2, 1.2, -1.5],
    { target: -21, kind: "m", sendDb: -8 },
  );
  (
    [
      [24.45, 0.22],
      [24.6, 0.17],
    ] as const
  ).forEach(([tl, d], i) =>
    m.add(`lock-creak${i}`, S.groan(d, 538 + i), tl, close, {
      target: -27,
      kind: "m",
      sendDb: -8,
    }),
  );
  const n4 = nsamp(span);
  crackle = S.redMaterial(n4, new Float64Array(n4).fill(0.6), 131)[2];
  m.add("crack-energy", fade(crackle, 0.005, 0.01), 23.81, close, {
    target: -25,
    kind: "m",
    sendDb: -8,
  });
  const groan = times(
    spectral(white(n4, 132), (f) => bandGain(f, 180, 420, 3)),
    linspace(0.4, 1.0, n4),
  );
  m.add("crack-groan", fade(groan, 0.005, 0.01), 23.81, close, {
    target: -26,
    kind: "m",
    sendDb: -8,
  });

  // 24.75 to the fracture: wide; the cracked shell hangs in the hall and tightens
  const far: Vec3 = [0.0, 2.5, -9.0];
  const n5 = nsamp(RED_RELEASE - 24.75);
  const tension = curve(
    [
      [24.75, 0.6],
      [RED_FRACTURE, 1.0],
      [RED_RELEASE, 1.0],
    ],
    24.75,
    n5,
  );
  [rumble, roar, crackle] = S.redMaterial(n5, tension, 133);
  const src = curve(
    [
      [24.75, 0],
      [24.79, 1],
      [RED_FRACTURE, 1.5],
      [RED_RELEASE - 0.004, 1.5],
      [RED_RELEASE, 0],
    ],
    24.75,
    n5,
  );
  m.add(
    "shell",
    times(sum([0.8, rumble], [1.0, roar], [0.3, crackle]), src),
    24.75,
    far,
    { target: -23.5, kind: "m", focusDb: 4, sendDb: -2 },
  );
  span = RED_FRACTURE - 24.75;
  const c = 0.03;
  const cnt = rr.poisson(7 * Math.log((span + c) / c));
  const strainT = Array.from(
    rr.randomN(cnt),
    (u) => span + c - (span + c) * (c / (span + c)) ** u,
  ).sort((a, b) => a - b);
  const strain = ticks(
    strainT,
    (i) => {
      const size = rr.uniform(0.2, 0.5);
      const k = S.stoneCrack(rr, size, 0.3);
      return times(
        times(k, 0.35 + 0.65 * (strainT[i]! / span) ** 2),
        rr.uniform(0.6, 1.0),
      );
    },
    span + 0.4,
  );
  m.add("shell-strain", strain, 24.75, far, {
    target: -25,
    kind: "i",
    focusDb: 4,
    sendDb: -3,
  });
  (
    [
      [24.95, 0.3],
      [25.28, 0.36],
    ] as const
  ).forEach(([tl, d], i) =>
    m.add(`shell-groan${i}`, S.groan(d, 136 + i), tl, far, {
      target: -27,
      kind: "m",
      focusDb: 4,
      sendDb: -3,
    }),
  );

  // the shell fractures; the pressure leaves two frames later as a violet burst
  m.add(
    "shell-fracture",
    S.heavyCrack(140, { size: 1.0, dur: 0.4, kRate: 10, bright: 0.8 }),
    RED_FRACTURE,
    far,
    {
      target: -21,
      kind: "i",
      focusDb: 8,
    },
  );
  const [front, low, slp] = S.whump(141, 0.0035, 0.6);
  m.add(
    "release",
    S.saturate(sum([0.55, front], [0.9, low], [0.6, slp])),
    RED_RELEASE,
    far,
    { target: -12, kind: "i", focusDb: 10 },
  );
  const nw = nsamp(1.6);
  const env = new Float64Array(nw).map((_, i) => Math.exp(-i / SR / 0.35));
  const k4 = nsamp(0.004);
  const ramp = linspace(0, 1, k4);
  for (let i = 0; i < k4; i++) env[i] = env[i]! * ramp[i]!;
  const wash = [0, 1].map((ch) =>
    stftShape(white(nw, 150 + ch), (tf, fr, g) => {
      const fcn = 300 + 1500 * Math.exp(-Math.max(tf, 0) / 0.16);
      for (let k = 0; k < fr.length; k++)
        g[k] = Math.exp(
          -0.5 * (Math.log2(Math.max(fr[k]!, 1) / fcn) / 1.0) ** 2,
        );
    }),
  ) as Stereo;
  m.addWide("release-wash", shapeSt(wash, env), RED_RELEASE, {
    target: -17,
    kind: "i",
    sendDb: -3,
  });

  // The ice, read again from the frames (round 10).
  const fig: Vec3 = [0.0, 1.4, -4.0];
  const wall: Vec3 = [0.0, 2.0, -5.0];
  m.add(
    "ice-boom",
    S.boom(160, { f: 88.0, tau: 0.16 }),
    ICE,
    [0.0, 0.5, -4.5],
    { target: -10, kind: "i", sendDb: -8 },
  );
  const ic = S.heavyCrack(161, {
    size: 1.6,
    dur: 0.22,
    kRate: 14,
    bright: 0.8,
  });
  m.add("ice-crack", ic, ICE, fig, {
    target: -11,
    kind: "i",
    focusDb: 2,
    sendDb: -6,
  });
  m.add("ice-slap", S.slap(ic, 800), ICE + 0.26, [0.0, 3.0, -15.0], {
    target: -23,
    kind: "i",
    focusDb: 6,
  });
  let up = S.bandSweepWide(0.2, 169, 350, 3800, 1.5, 0.5);
  const irr = S.irregular(up[0].length, 170, 20, 110);
  up = shapeSt(
    up,
    irr.map((v) => 0.55 + 0.45 * v),
  );
  // a run of sharp cracks whose band climbs as the slabs shoot up: 26 cracks in 0.17 s at irregular times
  const zt = rr.uniformN(0.0, 0.17, 26).sort();
  const zip = ticks(
    zt,
    (i) => {
      const b = S.tiltedBurst(
        900 + i,
        400.0 * 6.0 ** (zt[i]! / 0.17),
        1400.0 * 6.0 ** (zt[i]! / 0.17),
        0.004,
        { tilt: 0.3 },
      );
      return times(b, rr.uniform(0.5, 1.0));
    },
    0.2,
  );
  const upPeak = Math.max(peak(up[0]), peak(up[1]));
  const zn = S.norm(zip);
  const zz = zeros(up[0].length);
  zz.set(zn.subarray(0, Math.min(zn.length, zz.length)));
  up = up.map((ch) => ch.map((v, i) => (0.6 * v) / upPeak + zz[i]!)) as Stereo;
  m.addWide("ice-rise", up, ICE - 0.005, {
    target: -14,
    kind: "i",
    sendDb: -4,
  });
  // the slabs come at irregular times: equal steps of 40 ms would be a rattle at 25 Hz
  (
    [
      [0.012, 1.0, [-3.0, 1.0, -5.0]],
      [0.049, 1.4, [3.2, 1.5, -5.5]],
      [0.071, 0.8, [-1.5, 2.5, -6.5]],
      [0.118, 1.8, [1.2, 3.0, -7.0]],
      [0.137, 1.1, [-3.5, 3.5, -6.0]],
      [0.181, 0.7, [2.5, 4.0, -6.5]],
    ] as [number, number, Vec3][]
  ).forEach(([dt, size, pos], i) => {
    m.add(
      `ice-slab${i}`,
      S.heavyCrack(162 + i, { size, dur: 0.2, kRate: 5, bright: 0.2 }),
      ICE + dt,
      pos,
      {
        target: -18,
        kind: "i",
        focusDb: 2,
        sendDb: -6,
      },
    );
  });
  // The rays are on the ice. The ice takes their top at once.
  const nb = nsamp(0.36);
  const benv = curve(
    [
      [ICE, 0.0],
      [ICE + 0.012, 0.45],
      [ICE + 0.09, 0.6],
      [ICE_FLASH - 0.012, 1.0],
      [ICE_FLASH + 0.03, 0.55],
      [ICE_CLEAR, 0.18],
      [ICE + 0.36, 0.0],
    ],
    ICE,
    nb,
  );
  (
    [
      [[-2.6, 2.0, -5.0], 280.0, 1300.0],
      [[2.6, 2.6, -5.5], 380.0, 1700.0],
    ] as [Vec3, number, number][]
  ).forEach(([pos, lo, hi], i) => {
    m.add(
      `block-press${i}`,
      times(S.sear(0.36, 190 + i, lo, hi, 5.0), benv),
      ICE,
      pos,
      { target: -18, kind: "m", focusDb: 3, sendDb: -8 },
    );
  });
  m.add(
    "block-hiss",
    times(S.sear(0.36, 197, 2500.0, 9000.0, 6.0), benv),
    ICE,
    wall,
    { target: -27, kind: "m", focusDb: 3, sendDb: -8 },
  );
  const fz = ICE_FLASH - ICE;
  const ft = rr.uniformN(0.02, fz, 9).sort();
  const fis = ticks(
    ft,
    (i) => {
      const size = rr.uniform(0.35, 0.9);
      return times(S.stoneCrack(rr, size, 0.4), 0.45 + (0.55 * ft[i]!) / fz);
    },
    fz + 0.3,
  );
  m.add("block-fissure", fis, ICE, wall, {
    target: -19,
    kind: "i",
    focusDb: 3,
    sendDb: -6,
  });
  // the white frame: the rays break on the ice. This is the hit that stops them.
  const brk = zeros(nsamp(2.6));
  for (const [k, w] of [
    [S.heavyCrack(192, { size: 1.4, dur: 0.5, kRate: 12, bright: 1.0 }), 1.0],
    [S.tiltedBurst(193, 500.0, 9000.0, 0.045, { tilt: 0.4, rise: 0.002 }), 0.8],
    [S.boom(194, { f: 92.0, tau: 0.55 }), 1.3],
  ] as const)
    addAt(brk, k.subarray(0, brk.length), 0, w);
  m.add("block-break", S.norm(brk), ICE_FLASH, wall, {
    target: -8,
    kind: "i",
    focusDb: 3,
    sendDb: -3,
  });
  m.add(
    "block-slap",
    S.slap(S.norm(brk), 900),
    ICE_FLASH + 0.2,
    [0.0, 3.0, -15.0],
    { target: -22, kind: "i", focusDb: 6 },
  );
  // the ice that the rays broke is crushed: bright, with no pitch
  (
    [
      [-2.2, 1.5, -5.0],
      [2.2, 2.5, -5.5],
    ] as Vec3[]
  ).forEach((pos, i) =>
    m.add(
      `ice-crush${i}`,
      S.crush(0.9, 187 + i, 0.14),
      ICE_FLASH + 0.004 + 0.03 * i,
      pos,
      { target: -17, kind: "i", focusDb: 2 },
    ),
  );
  // one frame later what is left of the rays flies off to the sides and up
  (
    [
      [1.0, 0.3],
      [0.3, 1.0],
      [0.75, 0.75],
    ] as const
  ).forEach(([gl, grr], i) =>
    m.addWide(
      `ray-scatter${i}`,
      spread(S.lance(195 + i, 0.13, 5200.0 - 900.0 * i, 600.0), gl, grr),
      26.568208 + 0.012 * i,
      {
        target: -20,
        kind: "i",
        sendDb: -6,
      },
    ),
  );
  // the ice stands. It keeps working for a second: it cracks less and less often, it groans, frost hangs.
  const ex = rr.exponentialN(1.0, 16);
  let acc = 0;
  const wt = Array.from(
    ex,
    (v, k) => 26.62 + (acc += v * 0.035 * 1.32 ** k),
  ).filter((v) => v < 28.35);
  const work = ticks(
    wt.map((v) => v - 26.62),
    (i) => {
      const size = rr.uniform(0.25, 0.7);
      const k = S.stoneCrack(rr, size, 0.6);
      return times(
        times(k, rr.uniform(0.5, 1.0)),
        Math.exp(-(wt[i]! - 26.62) / 0.9),
      );
    },
    28.6 - 26.62,
  );
  m.add("ice-work", work, 26.62, [-0.8, 2.0, -5.2], {
    target: -21,
    kind: "i",
    focusDb: 2,
    sendDb: -4,
  });
  (
    [
      [26.66, 0.45, [-2.5, 2.0, -5.5], -21],
      [26.95, 0.5, [2.8, 2.5, -6.0], -23],
      [27.42, 0.4, [-1.0, 3.0, -6.5], -27],
      [28.02, 0.35, [2.0, 2.0, -6.0], -30],
    ] as [number, number, Vec3, number][]
  ).forEach(([tl, d, pos, tg], i) =>
    m.add(`ice-groan${i}`, S.groan(d, 172 + i), tl, pos, {
      target: tg,
      kind: "m",
      focusDb: 2,
    }),
  );
  (
    [
      [26.93, 0.5, [1.8, 1.0, -5.0], -26],
      [27.21, 0.35, [-2.6, 2.0, -5.5], -29],
      [27.74, 0.45, [0.6, 3.0, -6.5], -31],
      [28.19, 0.3, [-1.4, 1.2, -5.0], -33],
    ] as [number, number, Vec3, number][]
  ).forEach(([tl, size, pos, tg], i) =>
    m.add(
      `ice-tick${i}`,
      S.heavyCrack(180 + i, { size, dur: 0.25, kRate: 3, bright: 0.3 }),
      tl,
      pos,
      { target: tg, kind: "i", focusDb: 2 },
    ),
  );
  const mist = shapeSt(
    S.wideNoise(1.9, 185, 180, 1400),
    curve(
      [
        [26.6, 0],
        [27.0, 1],
        [28.0, 0.7],
        [28.5, 0],
      ],
      26.6,
      nsamp(1.9),
    ),
  );
  m.addWide("ice-mist", mist, 26.6, { target: -33, kind: "m", sendDb: -6 });
  const frost = shapeSt(
    S.dust(1.9, 186, {
      lo: 3500.0,
      hi: 11000.0,
      sd: 2.0,
      grain: 0.5,
      tilt: 0.2,
    }),
    curve(
      [
        [26.62, 0],
        [26.85, 1],
        [27.3, 0.7],
        [28.0, 0.3],
        [28.5, 0],
      ],
      26.62,
      nsamp(1.9),
    ),
  );
  m.addWide("ice-frost", frost, 26.62, { target: -31, kind: "m" });

  // 25.776 to 26.31: the burst is a star of eight to ten rays that reach the walls and the vault.
  const rays: [number, Vec3, number][] = [
    [0.045, [-8.5, 2.0, -7.0], 1.2],
    [0.06, [8.5, 3.5, -8.0], 1.0],
    [0.085, [-3.0, 13.0, -8.0], 1.4],
    [0.11, [5.5, 1.0, -16.5], 0.9],
    [0.14, [3.5, 13.0, -11.0], 1.1],
    [0.17, [-5.5, 4.5, -16.5], 1.3],
    [0.215, [-6.5, 0.0, -9.5], 0.8],
    [0.26, [6.0, 0.0, -6.5], 1.0],
  ];
  rays.forEach(([dt, pos, size], i) => {
    m.addWide(
      `ray-lance${i}`,
      spread(
        S.lance(540 + i),
        pos[0] <= 0 ? 1.0 : 0.45,
        pos[0] >= 0 ? 1.0 : 0.45,
      ),
      RED_RELEASE + dt - 0.035,
      {
        target: -19,
        kind: "i",
        sendDb: -8,
      },
    );
    m.add(
      `ray-hit${i}`,
      S.heavyCrack(550 + i, { size, dur: 0.35, kRate: 7, bright: 0.9 }),
      RED_RELEASE + dt,
      pos,
      {
        target: -13,
        kind: "i",
        focusDb: 5,
        sendDb: -7,
      },
    );
  });
  (
    [
      [[-7.0, 3.0, -8.0], 700.0, 1600.0],
      [[7.0, 4.0, -9.0], 1600.0, 3600.0],
      [[0.0, 11.0, -9.0], 3600.0, 8000.0],
    ] as [Vec3, number, number][]
  ).forEach(([pos, lo, hi], i) => {
    const se = times(
      S.sear(0.86, 560 + i, lo, hi),
      curve(
        [
          [25.8, 0],
          [25.84, 1],
          [26.2, 0.8],
          [ICE, 0.8],
          [ICE + 0.012, 0.22],
          [ICE_FLASH, 0.22],
          [ICE_CLEAR, 0.06],
          [26.66, 0],
        ],
        25.8,
        nsamp(0.86),
      ),
    );
    m.add(`ray-sear${i}`, se, 25.8, pos, {
      target: -15,
      kind: "m",
      focusDb: 5,
      sendDb: -8,
    });
  });
  (
    [
      [25.98, [-8.0, 0.0, -7.5]],
      [26.07, [8.0, 0.0, -8.5]],
      [26.2, [-2.5, 0.0, -9.0]],
      [26.72, [4.5, 0.0, -14.0]],
      [26.88, [-5.0, 0.0, -15.0]],
    ] as [number, Vec3][]
  ).forEach(([tl, pos], i) =>
    m.add(
      `ray-debris${i}`,
      S.slabFall(566 + i, [0.5, 0.4, 0.7, 0.5, 0.6][i]!),
      tl,
      pos,
      { target: -20, kind: "i", focusDb: 4 },
    ),
  );
  // 26.7 to 28.45: behind the ice, stone keeps coming down from the walls and the vault
  (
    [
      [-7.5, 0.0, -9.0],
      [7.0, 0.0, -11.0],
    ] as Vec3[]
  ).forEach((pos, i) => {
    const wd = S.tumble(
      2.0,
      572 + i,
      (q) => 6.0 * Math.exp(-q / 0.9) + 0.8,
      [0.15, 0.5],
      [4.0, 9.0],
    );
    m.add(`wall-debris${i}`, wd, 26.7, pos, {
      target: -24,
      kind: "m",
      focusDb: 3,
    });
  });

  // 28.53 to 30.21: wide: a cloud of smoke fills the hall and rolls; debris flies out of it and rains down
  const SMK = 28.53;
  const sm = shapeSt(
    S.billow(2.4, 580, 60.0, 600.0),
    curve(
      [
        [SMK, 0],
        [SMK + 0.3, 0.75],
        [29.05, 1.0],
        [29.7, 0.7],
        [30.3, 0.4],
        [30.9, 0],
      ],
      SMK,
      nsamp(2.4),
    ),
  );
  m.addWide("smoke", sm, SMK, { target: -20, kind: "m", sendDb: -6 });
  const sw = S.boom(581, { f: 85.0, tau: 0.55 });
  m.add(
    "smoke-swell",
    times(
      sw,
      curve(
        [
          [28.85, 0.0],
          [29.0, 1.0],
          [31.0, 1.0],
        ],
        28.85,
        S.boom(581, { f: 85.0, tau: 0.55 }).length,
      ),
    ),
    28.85,
    [0.0, 3.0, -10.0],
    { target: -22, kind: "m", sendDb: -2 },
  );
  const hiss = shapeSt(
    S.dust(2.2, 582, { lo: 700.0, hi: 6000.0, grain: 0.15, tilt: 0.6 }),
    curve(
      [
        [SMK, 0],
        [SMK + 0.3, 1],
        [29.6, 0.8],
        [30.25, 0.35],
        [30.73, 0],
      ],
      SMK,
      nsamp(2.2),
    ),
  );
  m.addWide("smoke-hiss", hiss, SMK, { target: -26, kind: "m" });
  (
    [
      [-6.0, 0.0, -11.0],
      [5.0, 0.0, -13.0],
    ] as Vec3[]
  ).forEach((pos, i) => {
    const dr = S.tumble(
      1.9,
      584 + i,
      (q) => 6.0 * Math.exp(-q / 1.1) + 1.0,
      [0.05, 0.2],
      [3.0, 7.0],
    );
    m.add(`debris-rain${i}`, dr, SMK + 0.1, pos, { target: -28, kind: "m" });
  });
  // ---- round 4: tones that last, sharp moments, what comes back from the walls
  const ORB = [185.0, 311.0, 466.0, 740.0, 1109.0];
  m.add(
    "orb-voice",
    fade(S.voice(22.3 - T0, 401, ORB), 0.03, 0.01),
    T0,
    [0.0, 1.5, -3.0],
    { target: -20.5, kind: "m", sendDb: -12 },
  );
  m.add(
    "orb-voice-close",
    fade(
      S.voice(22.79 - 22.31, 402, [...ORB, 1480.0], { wander: 0.02 }),
      0.008,
      0.01,
    ),
    22.31,
    [0.6, 1.2, -1.4],
    {
      target: -18,
      kind: "m",
      sendDb: -12,
    },
  );
  m.add(
    "orb-voice-far",
    fade(S.voice(23.76 - 23.06, 403, ORB.slice(0, 4)), 0.01, 0.01),
    23.06,
    line([2.0, 3.0, -10.0], [0.0, 2.0, -9.0], nsamp(23.76 - 23.06)),
    { target: -26, kind: "m", sendDb: -4 },
  );
  (
    [
      [-1.2, 1.6, -3.2],
      [1.2, 1.4, -3.2],
    ] as Vec3[]
  ).forEach((pos, i) =>
    m.add(
      `orb-sparks${i}`,
      fade(S.pops(22.3 - T0, 404 + i, 16.0, 500, 4000, 0.005), 0.02, 0.01),
      T0,
      pos,
      { target: -28, kind: "m", sendDb: -10 },
    ),
  );
  (
    [
      ["hit1", hit1, 21.12, -26],
      ["hit2", hit2, 21.8, -23],
    ] as const
  ).forEach(([nm, sig, tl, tg]) => {
    m.add(`${nm}-slap0`, S.slap(sig), tl + 0.17, [-8.5, 2.0, -6.0], {
      target: tg,
      kind: "i",
      sendDb: -6,
    });
    m.add(`${nm}-slap1`, S.slap(sig, 1200), tl + 0.27, [8.5, 2.0, -9.0], {
      target: tg - 2,
      kind: "i",
      sendDb: -6,
    });
    m.add(
      `${nm}-low`,
      S.burst(406 + (nm === "hit2" ? 1 : 0), 40, 140, 0.12, { rise: 0.004 }),
      tl,
      [0.0, 1.0, -3.0],
      {
        target: tg + 4,
        kind: "i",
        sendDb: -8,
      },
    );
  });
  const ck = ticks(
    [0.05, 0.21, 0.37],
    (i) =>
      S.heavyCrack(408 + i, { size: [0.5, 0.8, 0.6][i]!, dur: 0.2, kRate: 5 }),
    1.3,
  );
  m.add("flame-cracks", ck, 22.31, [1.0, 0.8, -1.8], {
    target: -17.5,
    kind: "i",
    sendDb: -8,
  });
  m.add(
    "crack-tone",
    fade(
      S.glide(24.65 - 23.81, 410, 220, 311, {
        ratios: [1.0, 1.5, 2.4, 3.2],
        shape: 1.3,
      }),
      0.02,
      0.02,
    ),
    23.81,
    close,
    {
      target: -23,
      kind: "m",
      sendDb: -8,
    },
  );
  const shTone = times(
    S.glide(RED_FRACTURE - 24.75, 411, 311, 466, { ratios: [1.0, 2.0, 3.0] }),
    curve(
      [
        [24.75, 0],
        [24.85, 0.5],
        [RED_FRACTURE - 0.005, 1.0],
        [RED_FRACTURE, 0],
      ],
      24.75,
      nsamp(RED_FRACTURE - 24.75),
    ),
  );
  m.add("shell-tone", shTone, 24.75, far, {
    target: -22.5,
    kind: "m",
    focusDb: 4,
    sendDb: -2,
  });
  const fall = S.glide(0.7, 412, 900, 180, {
    ratios: [1.0, 1.5, 2.25],
    shape: 0.6,
  }).map((v, i) => v * Math.exp(-i / (0.22 * SR)));
  m.add("release-fall", fade(fall, 0.004, 0.05), RED_RELEASE, far, {
    target: -18,
    kind: "m",
    focusDb: 10,
    sendDb: -2,
  });
  const rel = S.saturate(sum([0.55, front], [0.9, low], [0.6, slp]));
  m.add(
    "release-slap",
    S.slap(rel, 900),
    RED_RELEASE + 0.24,
    [0.0, 3.0, -15.0],
    { target: -19, kind: "i", focusDb: 6 },
  );
  // under the close shot of her face the smoke is still there, far and soft, and two last stones land
  (
    [
      [30.62, 0.2, [-5.0, 0, -10.0]],
      [31.34, 0.15, [4.0, 0, -12.0]],
    ] as [number, number, Vec3][]
  ).forEach(([tl, a, pos], i) =>
    m.add(`settle${i}`, S.rockFall(a, 0.5, 415 + i), tl, pos, {
      target: -33,
      kind: "i",
    }),
  );
  m.driveDb = 8.8;
  const wi = S.wind(2.25, 182, 300, 3500);
  m.addWide(
    "hair-wind",
    shapeSt(
      wi,
      curve(
        [
          [30.25, 0],
          [30.45, 1],
          [32.1, 0.8],
          [32.5, 0],
        ],
        30.25,
        wi[0].length,
      ),
    ),
    30.25,
    { target: -33, kind: "m" },
  );
  const irrC = S.irregular(nsamp(2.2), 184, 2, 9);
  const fl = S.cloth(2.2, 183, 260).map((v, i) => v * (0.6 + 0.4 * irrC[i]!));
  m.add("hair-cloth", fl, 30.27, [0.2, 1.5, -0.8], {
    target: -34,
    kind: "m",
    sendDb: -10,
  });
  const wtone = times(
    S.voice(2.2, 416, [620.0, 930.0, 1395.0], {
      wander: 0.03,
      rate: 2.0,
      breath: 0.7,
    }),
    curve(
      [
        [30.25, 0],
        [30.6, 1],
        [32.0, 0.7],
        [32.45, 0],
      ],
      30.25,
      nsamp(2.2),
    ),
  );
  m.add("wind-tone", wtone, 30.25, [-0.6, 1.8, -1.5], {
    target: -39,
    kind: "m",
    sendDb: -4,
  });
  return m;
}
