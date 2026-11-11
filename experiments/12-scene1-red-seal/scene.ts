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
} from "../../src/study/dsp.ts";
import {
  Mix,
  type AddOptions,
  type Layer,
  type Where,
} from "../../src/study/mix.ts";
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
} from "../../src/study/passage.ts";
import * as S from "../../src/study/sources.ts";
import { redLayers } from "./red.ts";

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
        g[k] =
          Math.exp(-0.5 * (Math.log2(f / fc) / width) ** 2) *
          Math.min(1, (fc / f) ** 0.3);
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
  m.part("dust-roll", () => {
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
    m.addWide(
      "dust-roll",
      shapeSt(S.billow(3.9, 1001, 50.0, 500.0), dustEnv),
      0.0,
      {
        target: -24,
        kind: "m",
        sendDb: -6,
      },
    );
    m.addWide(
      "dust-hiss",
      shapeSt(
        S.dust(3.9, 1003, { lo: 600.0, hi: 5000.0, grain: 0.2, tilt: 0.6 }),
        dustEnv,
      ),
      0.0,
      { target: -33, kind: "m" },
    );
  });
  m.part("far-draw", () => {
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
      "far-draw",
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
      { target: -27, kind: "m", sendDb: -2 },
    );
  });

  // ---- 3.29 to 4.71: close on the figure; a red glow in its hand grows into the orb.
  m.part("draw-breath", () => {
    const breath = S.howl(1.5, 1010, [180.0, 270.0, 410.0], 8.0, 0.08, 1.2);
    m.add(
      "draw-breath",
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
      { target: -30, kind: "m", sendDb: -6 },
    );
  });
  m.part("orb-form", () => {
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
      "orb-form",
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
      { target: -21, kind: "m", sendDb: -10 },
    );
  });
  m.part("orb-gather", () => {
    const formDraw = curve(
      [
        [3.85, 0.0],
        [4.69, 1.0],
        [4.712, 0.0],
      ],
      3.85,
      nsamp(0.88),
    );
    m.addWide("orb-gather", drawnAir(0.88, 1023, formDraw), 3.85, {
      target: -24,
      kind: "m",
      sendDb: -6,
    });
  });
  m.part("orb-form-sparks", () => {
    m.add(
      "orb-form-sparks",
      fade(S.pops(0.85, 1022, 22.0, 800, 6000, 0.004), 0.2, 0.01),
      3.86,
      [0.3, 1.2, -1.2],
      {
        target: -31,
        kind: "m",
        sendDb: -10,
      },
    );
  });

  // ---- 4.71: white frames: the orb is let go. A pressure, a deep body, a tear that falls.
  m.part("launch", () => {
    const [front, low, slp] = S.whump(1030, 0.004, 0.6);
    m.add(
      "launch",
      S.saturate(sum([0.55, front], [0.9, low], [0.6, slp])),
      4.713,
      [0.0, 1.4, -2.5],
      {
        target: -13,
        kind: "i",
        focusDb: 4,
      },
    );
  });
  m.part("launch-boom", () => {
    m.add(
      "launch-boom",
      S.boom(1031, { f: 70.0, tau: 0.6 }),
      4.713,
      [0.0, 0.5, -3.0],
      {
        target: -15,
        kind: "i",
        sendDb: -6,
      },
    );
  });
  m.part("launch-tear", () => {
    m.addWide("launch-tear", S.lance(1032, 0.16, 3500.0, 400.0), 4.705, {
      target: -20,
      kind: "i",
      sendDb: -6,
    });
  });

  // ---- 4.88 to 7.21: close on the orb. The black core draws the air round it.
  const ORB_CLOSE: Vec3 = [0.0, 1.4, -2.2];
  // the blue lines of wind turn round the camera toward the core, faster as they close in
  m.part("swirl", () => {
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
      m.add(`swirl${i}`, src, t, P, { target: -24, kind: "m", sendDb: -8 });
    });
  });

  // ---- 7.21 to 8.05: her face. The wind streams past her toward the orb.
  m.part("face-wind", () => {
    const fw = S.wind(1.0, 1050, 300, 3500);
    m.addWide(
      "face-wind",
      shapeSt(
        fw,
        curve(
          [
            [7.2, 0.6],
            [7.5, 1],
            [8.0, 0.8],
            [8.2, 0],
          ],
          7.2,
          fw[0].length,
        ),
      ),
      7.2,
      { target: -24, kind: "m" },
    );
  });
  m.part("face-hair", () => {
    const irr = S.irregular(nsamp(0.85), 1052, 2, 9);
    m.add(
      "face-hair",
      S.cloth(0.85, 1051, 300).map((v, i) => v * (0.6 + 0.4 * irr[i]!)),
      7.22,
      [0.2, 1.5, -0.8],
      { target: -29, kind: "m", sendDb: -10 },
    );
  });

  // ---- 8.05 to 9.47: she flies through the white hall; the first small stones drift in the draw.
  m.part("fly-air", () => {
    const fa = S.wind(1.67, 1060, 150, 1500);
    m.addWide(
      "fly-air",
      shapeSt(fa, fade(new Float64Array(fa[0].length).fill(1), 0.15, 0.15)),
      7.95,
      {
        target: -22,
        kind: "m",
      },
    );
  });
  m.part("fly-whoosh", () => {
    m.add(
      "fly-whoosh",
      S.bandSweep(0.6, 1061, 300.0, 2000.0),
      8.1,
      line([-4.0, 1.5, -2.0], [4.0, 1.5, -1.0], nsamp(0.6)),
      {
        target: -26,
        kind: "m",
        sendDb: -8,
      },
    );
  });

  // ---- 9.47 to 11.55: the orb tears through the hall; stones fly past and at it.
  m.part("orb-tear-sparks", () => {
    m.add(
      "orb-tear-sparks",
      fade(S.pops(2.08, 1072, 16.0, 500, 4000, 0.005), 0.02, 0.15),
      9.47,
      [1.0, 1.5, -3.0],
      {
        target: -28,
        kind: "m",
        sendDb: -10,
      },
    );
  });
  m.part("tear-pass", () => {
    const tearPasses: [number, number, number, number][] = [
      [9.62, 1, 2.4, -26],
      [9.86, -1, 1.9, -25],
      [10.05, 1, 1.5, -24],
      [10.38, -1, 2.2, -26],
      [10.66, 1, 1.3, -23],
      [10.98, -1, 1.6, -24],
      [11.3, 1, 2.0, -25],
    ];
    // review 6: each stone tears the air as it passes (`passBy`); the old target gives its size
    tearPasses.forEach(([t, side, near, tg], i) =>
      passBy(
        m,
        `tear-pass${i}`,
        t,
        side,
        near,
        30,
        0.5 * 10 ** ((tg + 24) / 10),
        1074 + i,
      ),
    );
  });
  m.part("tear-hit", () => {
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
        S.heavyCrack(1086 + i, { size, dur: 0.3, kRate: 8 }).subarray(
          0,
          hit.length,
        ),
        0,
        0.6,
      );
      addAt(hit, S.sizzle(0.7, 1088 + i, 0.14), 0, 0.3);
      // review 6: the orb strikes the stone hard (about 20 m/s), and the stone tears away past us
      m.add(`tear-hit${i}`, lp(S.saturate(S.norm(hit), 1.5), 12000), t, pos, {
        target: Math.round(hitDb(size, 20)),
        kind: "i",
        sendDb: -6,
      });
      passBy(
        m,
        `tear-hit${i}-huuk`,
        t + 0.2,
        i ? -1 : 1,
        1.4,
        22,
        size,
        1095 + i,
        0.4,
      );
      m.add(
        `tear-hit${i}-slap`,
        S.slap(hit, 1200),
        t + 0.21,
        [8.5 * (i ? -1 : 1), 2.0, -8.0],
        {
          target: -27 + i,
          kind: "i",
          sendDb: -6,
        },
      );
    });
  });

  // ---- 11.55 to 14.81: wide. A mass of stones turns round the orb and packs in.
  m.part("gather-grind", () => {
    const CORE: Vec3 = [0.0, 3.0, -10.0];
    const grindEnv = (n: number) =>
      curve(
        [
          [11.55, 0.0],
          [11.8, 0.35],
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
        kind: "m",
        focusDb: 3,
        sendDb: -4,
      });
    });
    // blocks strike blocks, faster and faster, as they are pulled in from all sides
    const rg = rng(1095);
    const gt = risingTimes(rg, 3.2, 4.0, 15.0, 0.2);
    (
      [
        ["l", -6.0],
        ["c", 0.0],
        ["r", 6.0],
      ] as const
    ).forEach(([side, x0], idx) => {
      const mine = gt.filter((_, k) => k % 3 === idx);
      const cl = ticks(
        mine,
        (i) => {
          const size = rg.uniform(0.45, 1.3);
          const v = rg.uniform(5.0, 10.0);
          return times(
            S.blockHit(1100 + 7 * i + idx, size, v),
            0.55 + (0.45 * mine[i]!) / 3.2,
          );
        },
        3.6,
      );
      const P = line([x0, 1.0 + Math.abs(x0) * 0.4, -7.0], CORE, cl.length);
      m.add(`gather-clump-${side}`, cl, 11.55, P, {
        target: -19,
        kind: "i",
        focusDb: 3,
        sendDb: -4,
      });
    });
    m.add(
      "gather-rubble",
      S.rubble(3.2, 1097, (t) => 8.0 + 6.0 * t, {
        sizes: [0.15, 0.6],
        bright: 0.2,
        body: 0.6,
      }),
      11.6,
      [0.5, 2.5, -9.0],
      { target: -25, kind: "m", focusDb: 2, sendDb: -4 },
    );
    [0, 1, 2, 3].forEach((i) => {
      const t = 11.6 + 0.35 * i;
      const src = steady(14.78 - t, 1098 + 13 * i, 100, 1800);
      const P = spiral(
        src.length,
        CORE,
        6.0 - 0.5 * i,
        2.0,
        0.8 + 0.25 * i,
        (Math.PI * i) / 2,
        1.5,
      );
      m.add(`orbit${i}`, src, t, P, { target: -27, kind: "m", sendDb: -6 });
    });
  });
  m.part("gather-low", () => {
    const gl = S.billow(3.27, 1099, 35.0, 180.0, 2.0);
    m.addWide(
      "gather-low",
      shapeSt(
        gl,
        curve(
          [
            [11.55, 0.0],
            [11.8, 0.4],
            [14.7, 1],
            [14.82, 0.2],
            [14.82 + 3.26, 0],
          ],
          11.55,
          gl[0].length,
        ),
      ),
      11.55,
      { target: -25, kind: "m", sendDb: -4 },
    );
  });

  // ---- 14.81 to 15.47: a face of stone, far. The stone groans; the gathering goes on, far.
  m.part("face-groan", () => {
    m.add(
      "face-groan",
      S.groan(0.62, 1110, { rLo: 60, rHi: 130, res: [90.0, 170.0, 320.0] }),
      14.84,
      [1.0, 0.5, -6.0],
      {
        target: -26,
        kind: "m",
        focusDb: 2,
      },
    );
  });
  m.part("face-grind", () => {
    m.add(
      "face-grind",
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
      { target: -30, kind: "m", sendDb: -2 },
    );
  });

  // ---- 15.47 to 16.40: a block falls onto the face and cracks it.
  m.part("block-land", () => {
    m.add("block-land", S.slabFall(1120, 1.6), 15.56, [0.5, 0.0, -6.0], {
      target: -11,
      kind: "i",
      focusDb: 3,
      sendDb: -3,
    });
  });
  m.part("block-land-body", () => {
    m.add(
      "block-land-body",
      S.boom(1121, { f: 62.0, tau: 0.7 }),
      15.56,
      [0.5, 0.0, -6.0],
      {
        target: -14,
        kind: "i",
        sendDb: -4,
      },
    );
  });
  m.part("block-cracks", () => {
    const rc = rng(1122);
    const ct = risingTimes(rc, 0.5, 26.0, 10.0, 0.04);
    const cracks = ticks(
      ct,
      (i) => {
        const size = rc.uniform(0.2, 0.6);
        return times(
          S.stoneCrack(rc, size, 0.4),
          rc.uniform(0.5, 1.0) * Math.exp(-ct[i]! / 0.4),
        );
      },
      0.9,
    );
    m.add("block-cracks", cracks, 15.58, [0.3, 0.3, -4.0], {
      target: -19,
      kind: "i",
      focusDb: 2,
      sendDb: -6,
    });
  });
  m.part("block-dust", () => {
    m.addWide("block-dust", S.puff(1.5, 1123, 150.0, 4000.0, 0.06, 0.5), 15.6, {
      target: -25,
      kind: "i",
      sendDb: -4,
    });
  });
  m.part("block-slap", () => {
    m.add(
      "block-slap",
      S.slap(S.slabFall(1120, 1.6), 900),
      15.56 + 0.22,
      [0.0, 3.0, -15.0],
      {
        target: -22,
        kind: "i",
        focusDb: 6,
      },
    );
  });

  // ---- 16.30 to 17.73: quick cuts. Stones fall; she leaps from stone to stone.
  m.part("leap-hit", () => {
    (
      [
        [16.33, "block", 0.8, [-1.5, 0.5, -4.0], -17],
        [16.62, "fall", 0.3, [2.0, 0.0, -5.0], -21],
        [16.9, "block", 0.6, [1.0, 0.8, -3.5], -18],
        [17.07, "crack", 1.0, [-2.0, 0.5, -6.0], -17],
        [17.24, "fall", 0.25, [2.5, 0.0, -4.5], -22],
        [17.4, "block", 0.5, [-0.5, 1.0, -3.0], -19],
        [17.57, "fall", 0.2, [1.5, 0.0, -5.5], -23],
      ] as [number, string, number, Vec3, number][]
    ).forEach(([t, kind, size, pos], i) => {
      // review 6: the stones come down fast (12 to 15 m/s) and strike loud and hard, at the
      // accepted landing's timbre and the level of their size and speed
      const v = kind === "fall" ? 15 : 12;
      const s =
        kind === "block"
          ? S.blockHit(1130 + i, size, v)
          : fastHit(1130 + i, size, v);
      m.add(`leap-hit${i}`, s, t, pos, {
        target: hitDb(size, v, Math.hypot(pos[0], pos[1] - 1.5, pos[2])),
        kind: "i",
        focusDb: 2,
        sendDb: -6,
      });
      // a falling stone tears the air on its way down
      if (kind === "fall")
        passBy(
          m,
          `leap-hit${i}-huuk`,
          t - 0.05,
          pos[0] > 0 ? 1 : -1,
          1.5,
          15,
          size,
          1145 + i,
          0.3,
        );
    });
  });
  m.part("leap-whoosh", () => {
    [16.6, 17.18].forEach((t, i) =>
      m.add(
        `leap-whoosh${i}`,
        S.bandSweep(0.28, 1140 + i, 400.0, 2500.0),
        t,
        line(
          [3.0 * (i ? 1 : -1), 1.5, -2.0],
          [-3.0 * (i ? 1 : -1), 1.6, -1.0],
          nsamp(0.28),
        ),
        { target: -26, kind: "i", sendDb: -8 },
      ),
    );
  });

  // ---- 17.73 to 18.60: dark. Slabs pass; the draw rumbles far.
  m.part("slab-pass", () => {
    (
      [
        [17.85, -1, 2.0],
        [18.12, 1, 1.6],
        [18.38, -1, 2.4],
      ] as const
    ).forEach(([t, side, near], i) =>
      // review 6: a heavy slab tears the air low as it passes
      passBy(m, `slab-pass${i}`, t, side, near, 18, 1.4, 1150 + i, 0.5, 1.8),
    );
  });
  m.part("dark-draw", () => {
    m.add(
      "dark-draw",
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
      { target: -27, kind: "m", sendDb: -2 },
    );
  });

  // ---- 18.60 to 20.00: the orb comes back on a streak among flying stones.
  m.part("orb-approach", () => {
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
    m.add("orb-approach", times(ap, apEnv), 18.6, apPath, {
      target: -22,
      kind: "m",
      sendDb: -8,
    });
    m.add(
      "orb-approach-voice",
      times(S.voice(1.45, 1161, ORB), apEnv),
      18.6,
      apPath,
      {
        target: -22,
        kind: "m",
        sendDb: -10,
      },
    );
  });
  m.part("approach-pass", () => {
    (
      [
        [18.75, 1, 2.6, -27],
        [19.05, -1, 2.0, -26],
        [19.3, 1, 1.7, -25],
        [19.55, -1, 1.4, -24],
        [19.82, 1, 2.2, -26],
      ] as [number, number, number, number][]
    )
      // review 6: each stone tears the air as it passes; the old target gives its size
      .forEach(([t, side, near, tg], i) =>
        passBy(
          m,
          `approach-pass${i}`,
          t,
          side,
          near,
          30,
          0.5 * 10 ** ((tg + 24) / 10),
          1162 + i,
          0.36,
        ),
      );
  });
  m.part("approach-air", () => {
    const aa = S.wind(1.45, 1168, 150, 1500);
    m.addWide(
      "approach-air",
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
      { target: -26, kind: "m" },
    );
  });

  // ---- 3.87 to 20.05: the draw itself. Air that is pulled to the core, all the time the orb is
  // there; it swells when the orb is near and climbs as it grows, and hands over to the red passage.
  m.part("draw", () => {
    const DRAW: Points = [
      [3.87, 0.0],
      [4.6, 0.75],
      [4.71, 0.35],
      [4.9, 0.95],
      [7.2, 1.0],
      [7.32, 0.55],
      [8.05, 0.5],
      [9.47, 0.55],
      [10.6, 1.0],
      [11.55, 0.75],
      [14.75, 1.0],
      [14.95, 0.35],
      [15.47, 0.3],
      [16.3, 0.45],
      [17.73, 0.4],
      [18.6, 0.55],
      [19.95, 1.0],
      [20.05, 0.0],
    ];
    const dd = 20.05 - 3.87;
    const draw = curve(DRAW, 3.87, nsamp(dd));
    m.addWide("draw", drawnAir(dd, 1170, draw, 220, 900, 1.2), 3.87, {
      target: -23,
      kind: "m",
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
    m.add("draw-low", times(lowDraw, draw), 3.87, [0.0, 2.5, -8.0], {
      target: -25,
      kind: "m",
      sendDb: -3,
    });
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
  [7.14, 1.0],
  [7.3, 0.5],
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
  [14.76, 0.65],
  [14.96, 0.12],
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
const HOLE_BANDS: readonly (readonly [
  number,
  number,
  number,
  number,
  number,
])[] = [
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

/** The proximity over the hole's span (from HOLE_FROM) raised to a power. */
function holePower(e: number): Float64Array {
  return curve(PROXIMITY, HOLE_FROM, nsamp(HOLE_TO - HOLE_FROM)).map(
    (p) => p ** e,
  );
}

function holeBody(m: Mix): void {
  m.part("hole-roar", () => {
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
        for (let i = 0; i < n; i++)
          roar[c]![i] = roar[c]![i]! + b[c]![i]! * weights[k]![i]!;
    });
    m.addWide(
      "hole-roar",
      [fade(roar[0], 0.05, 0.02), fade(roar[1], 0.05, 0.02)],
      HOLE_FROM,
      {
        target: -18.5,
        kind: "m",
        sendDb: -6,
      },
    );
  });
  m.part("hole-core", () => {
    const dur = HOLE_TO - HOLE_FROM;
    const n = nsamp(dur);
    const prox = curve(PROXIMITY, HOLE_FROM, n);
    // the core: the same deep noise as one source that moves with the orb, shot by shot, so its
    // distance, its side and its Doppler shift come from the path
    const core0 = S.curveNoise(n, 1210, HOLE_CURVE);
    const walk = S.levelWalk(n, 1211, 2.0, 0.3, 4.0);
    const core = core0.map((v, i) => v * walk[i]! * prox[i]! ** 0.7);
    across(
      m,
      "hole-core",
      core,
      HOLE_FROM,
      HOLE_SHOTS.map((keys, k) => ({
        from: keys[0]![0],
        to:
          k < HOLE_SHOTS.length - 1
            ? HOLE_SHOTS[k + 1]![0]![0]
            : keys[keys.length - 1]![0],
        pos: keys,
        opts: { target: null, gainDb: 0, sendDb: -8 },
      })),
    );
  });
  m.part("hole-inrush", () => {
    const dur = HOLE_TO - HOLE_FROM;
    const pw = holePower;
    // the inrush: air drawn into the core, its band climbing as the orb nears
    m.addWide(
      "hole-inrush",
      drawnAir(dur, 1220, pw(1.4), 150, 1400, 1.3),
      HOLE_FROM,
      {
        target: -22,
        kind: "m",
        sendDb: -6,
      },
    );
  });
  m.part("hole-pressure", () => {
    const dur = HOLE_TO - HOLE_FROM;
    const pw = holePower;
    // the pressure under the camera: noise from 25 to 70 Hz, only when the orb is near
    const pr = S.wideNoise(dur, 1230, 25, 70, 3, false);
    const pe = pw(2.0);
    m.addWide(
      "hole-pressure",
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
        kind: "m",
      },
    );
  });
}

/** The core's level, set against the roar once both are in the mix: 3 dB under it at the closest. */
function levelCore(m: Mix): void {
  const roar = m.layers.get("hole-roar")!;
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
      for (const ch of part)
        for (let i = 0; i < ch.length; i++) ch[i] = ch[i]! * g;
  }
}

/** The layers that cover the hole while it is near: stones that fly, wind, passing rocks. */
const COVERS =
  /^(face-wind|fly-air|fly-whoosh|pebbles|tear-pass|gather-clump|gather-grind|gather-rubble|orbit|gather-low|approach-pass|approach-air|flight-air|rock-pass|slab-pass|dark-draw)/;

/**
 * Carve a covering layer while the orb is near: up to 6 dB under 500 Hz and 2 dB in all, with
 * the proximity. The landings and the strikes are not touched. A layer step (`Mix.eachLayer`).
 */
function carve(m: Mix, name: string, l: Layer): void {
  if (!COVERS.test(name)) return;
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

// ---- Review 2, 2026-11-11. The owner: good, not yet 100 points. The hole sounds like wind, not
// like something that sucks in; it has no character, nothing uncanny; the stones that are pulled in
// are weak. Three answers, each from the study's models:
//
// - Suction: gestures that swallow. Each is air that converges from the side into the orb: a band
//   that falls and narrows as the matter is consumed, a level that grows into the core and stops
//   dead (4 ms), and grains of dust drawn in (reversed bursts) that crowd toward its end. The
//   torrent goes 4 dB down under them.
// - Character: the mana as a dark tone that is not music: inharmonic partials that sink slowly and
//   drift against each other with no period (`glide`), a growl under 75 Hz with the proximity
//   (`voice`), glassy grains that glide down and are swallowed, and formants on the inrush (`howl`,
//   bands of noise, not a comb, so no tube).
// - The stones: single stones dragged to the core, louder and faster until they strike it (`grind`,
//   `blockHit`, `crush`), stones that fly past the camera into it, and a pile at the core that grinds,
//   crunches and groans more as they arrive (`rubble`, `groan`).

/** Where the orb is at a reference second, from the shot that holds it. */
function orbAt(t: number): Vec3 {
  const shot =
    HOLE_SHOTS.find((k) => t >= k[0]![0] && t <= k[k.length - 1]![0]) ??
    HOLE_SHOTS[HOLE_SHOTS.length - 1]!;
  const ts = shot.map((k) => k[0]);
  return [0, 1, 2].map((c) =>
    interp(
      t,
      ts,
      shot.map((k) => k[1][c]!),
    ),
  ) as unknown as Vec3;
}
const shotOf = (t: number) =>
  HOLE_SHOTS.find((k) => t >= k[0]![0] && t < k[k.length - 1]![0]);

/** A path from `a` to `b` over n samples whose speed grows toward the end (drawn in). */
function drawnPath(a: Vec3, b: Vec3, n: number, power = 2.2) {
  const axis = (c: 0 | 1 | 2) =>
    new Float64Array(n).map(
      (_, i) => a[c] + (b[c] - a[c]) * (i / Math.max(1, n - 1)) ** power,
    );
  return { x: axis(0), y: axis(1), z: axis(2) };
}

/** One swallow: air drawn in, its band falling and narrowing, a growing level that stops dead. */
function swallow(
  dur: number,
  seed: number,
  f0: number,
  f1: number,
): Float64Array {
  const n = nsamp(dur);
  const x = stftShape(white(n, seed), (tf, fr, g) => {
    const u = Math.min(1, Math.max(0, tf / dur));
    const fc = f0 * (f1 / f0) ** u;
    const w = 1.5 * (1 - u) + 0.35;
    for (let k = 0; k < fr.length; k++)
      g[k] = Math.exp(-0.5 * (Math.log2(Math.max(fr[k]!, 1) / fc) / w) ** 2);
  });
  const walk = S.levelWalk(n, seed + 1, 1.5, 2.0, 12.0);
  const r = rng(seed + 2);
  const y = new Float64Array(n);
  const grow = 4.5;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    y[i] = x[i]! * walk[i]! * ((Math.exp(grow * u) - 1) / (Math.exp(grow) - 1));
  }
  const ry = Math.sqrt(y.reduce((p, q) => p + q * q, 0) / n) + 1e-12;
  // grains of dust drawn in: reversed bursts that end where they are swallowed, crowding to the end
  const grains = zeros(n);
  const count = Math.round(10 + 30 * dur);
  for (let k = 0; k < count; k++) {
    const end = Math.floor(n * Math.sqrt(r.random()));
    const g = S.burst(
      r.integers(1, 2 ** 31 - 1),
      1800,
      9000,
      r.uniform(0.002, 0.008),
      {
        rise: 0.0002,
      },
    ).reverse();
    addAt(grains, g, end - g.length, r.uniform(0.2, 1.0) * (end / n) ** 2);
  }
  const rg = Math.sqrt(grains.reduce((p, q) => p + q * q, 0) / n) + 1e-12;
  for (let i = 0; i < n; i++) y[i] = y[i]! / ry + (0.35 * grains[i]!) / rg;
  // the dead stop: 4 ms
  const k = nsamp(0.004);
  for (let i = 0; i < k; i++)
    y[n - k + i] =
      y[n - k + i]! * (0.5 + 0.5 * Math.cos((Math.PI * (i + 1)) / k));
  return y;
}

function suction(m: Mix): void {
  m.part("hole-swallow", () => {
    const r = rng(1300);
    let t = HOLE_FROM + 0.2;
    let i = 0;
    while (t < HOLE_TO - 0.3) {
      t += r.exponential(1 / 4.0);
      const p = proximityAt(t);
      if (r.random() > p || p < 0.3) continue;
      const dur = r.uniform(0.35, 1.1);
      const shot = shotOf(t);
      if (!shot) continue;
      const start = Math.max(t - dur, shot[0]![0] + 0.02);
      const d = t - start;
      if (d < 0.25) continue;
      const az = r.uniform(0, 2 * Math.PI);
      const rad = r.uniform(3.0, 6.0);
      const core = orbAt(t);
      const from: Vec3 = [
        core[0] + rad * Math.cos(az),
        Math.max(0.3, core[1] + r.uniform(-1.5, 1.5)),
        core[2] + rad * Math.sin(az),
      ];
      const sig = swallow(
        d,
        1310 + 7 * i,
        r.uniform(1400, 2600),
        r.uniform(90, 160),
      );
      m.add(`hole-swallow${i}`, sig, start, drawnPath(from, core, sig.length), {
        target: -17 + 9 * (p - 1),
        kind: "m",
        // the walls' first answers would carry the gesture past its stop; the hall's late field stays
        erDb: -12,
        sendDb: -8,
      });
      i++;
    }
  });
}

function character(m: Mix): void {
  m.part("hole-mana", () => {
    const dur = HOLE_TO - HOLE_FROM;
    const n = nsamp(dur);
    const prox = curve(PROXIMITY, HOLE_FROM, n);
    // the mana: inharmonic partials that sink slowly, two clusters that drift against each other
    const ratios = [1.0, 1.41, 1.87, 2.63, 3.31];
    const a = S.glide(dur, 1400, 233, 147, {
      ratios,
      wander: 0.012,
      shape: 1.0,
      tilt: 0.6,
    });
    const b = S.glide(dur, 1401, 236, 149, {
      ratios: ratios.map((q) => q * 1.013),
      wander: 0.012,
      shape: 1.0,
      tilt: 0.6,
    });
    const pm = prox.map((p) => p ** 1.2);
    m.addWide(
      "hole-mana",
      [
        fade(
          a.map((v, i) => v * pm[i]!),
          0.1,
          0.03,
        ),
        fade(
          b.map((v, i) => v * pm[i]!),
          0.1,
          0.03,
        ),
      ],
      HOLE_FROM,
      {
        target: -21,
        kind: "m",
        sendDb: -4,
      },
    );
  });
  m.part("hole-growl", () => {
    const dur = HOLE_TO - HOLE_FROM;
    const n = nsamp(dur);
    const prox = curve(PROXIMITY, HOLE_FROM, n);
    // the growl under the camera: three low partials, a level that breathes, only near
    const growl = S.voice(dur, 1410, [38.0, 53.0, 71.0], {
      wander: 0.04,
      rate: 3.0,
      tilt: 0.4,
      breath: 0.9,
    });
    const pg = prox.map((p) => p ** 2);
    const gr = fade(
      growl.map((v, i) => v * pg[i]!),
      0.1,
      0.03,
    );
    m.addWide("hole-growl", [gr, gr.slice()], HOLE_FROM, {
      target: -20,
      kind: "m",
    });
  });
  m.part("hole-ring", () => {
    const dur = HOLE_TO - HOLE_FROM;
    const n = nsamp(dur);
    const prox = curve(PROXIMITY, HOLE_FROM, n);
    // formants on the inrush: narrow bands of noise whose centres wander
    const ring = S.howl(
      dur,
      1420,
      [233.0, 349.0, 523.0, 741.0],
      9.0,
      0.06,
      1.0,
    );
    const pr = prox.map((p) => p ** 1.5);
    m.add(
      "hole-ring",
      fade(
        ring.map((v, i) => v * pr[i]!),
        0.1,
        0.03,
      ),
      HOLE_FROM,
      [0.0, 2.5, -2.5],
      {
        target: -25,
        kind: "m",
        sendDb: -4,
      },
    );
  });
  // review 3: the glassy grains that glided down and were cut off (heard as a laser) are gone
}

function gathering(m: Mix): void {
  m.part("drag", () => {
    const r = rng(1500);
    // stones dragged to the core: louder and faster until they strike it
    const arrivals: number[] = [];
    for (const [a, b, r0, r1] of [
      [9.8, 11.0, 2.0, 3.0],
      [11.75, 14.75, 2.0, 6.0],
      [19.0, 19.95, 2.0, 3.0],
    ] as const) {
      let t = a;
      for (;;) {
        t += r.exponential(1 / (r0 + ((r1 - r0) * (t - a)) / (b - a)));
        if (t >= b) break;
        arrivals.push(t);
      }
    }
    arrivals.forEach((ta, i) => {
      const shot = shotOf(ta);
      if (!shot) return;
      const d = Math.min(r.uniform(0.7, 1.6), ta - shot[0]![0] - 0.02);
      if (d < 0.3) return;
      const core = orbAt(ta);
      const az = r.uniform(0, 2 * Math.PI);
      const rad = r.uniform(5.0, 8.0);
      const from: Vec3 = [
        core[0] + rad * Math.cos(az),
        r.uniform(0.5, 4.0),
        core[2] + rad * Math.sin(az),
      ];
      const size = r.uniform(0.4, 1.2);
      const g = S.grind(d, 1510 + 11 * i, { rLo: 50, rHi: 260, scrape: 1.6 });
      const drag = g.map((v, k) => v * (k / g.length) ** 1.5);
      const cut = nsamp(0.006);
      for (let k = 0; k < cut; k++)
        drag[drag.length - cut + k] =
          drag[drag.length - cut + k]! * (1 - k / cut);
      m.add(`drag-${i}`, drag, ta - d, drawnPath(from, core, drag.length), {
        target: -25 + 3 * size,
        kind: "m",
        sendDb: -6,
      });
      const hit = S.blockHit(1520 + 11 * i, size, 9.0);
      addAt(
        hit,
        S.crush(0.3, 1521 + 11 * i, 0.06).subarray(0, hit.length),
        0,
        0.5,
      );
      m.add(`drag-${i}-arrive`, hit, ta, core, {
        // the arrival lands as the accepted landings do: the largest at the level of the block at
        // 15.56 s (-11), a smaller one lower by its size
        target: -11 + 10 * Math.log10(size / 1.2),
        kind: "i",
        focusDb: 2,
        // review 6: drier, so the strike reads as a stone and not as a wash of the hall
        sendDb: -9,
      });
      // review 6: the last quarter second of its flight tears the air into the core
      const tear = huuk(0.25, 1530 + 11 * i, 25, size, 0.9);
      const mid: Vec3 = [
        (from[0] + core[0]) / 2,
        (from[1] + core[1]) / 2,
        (from[2] + core[2]) / 2,
      ];
      m.add(`drag-${i}-huuk`, tear, ta - 0.25, line(mid, core, tear.length), {
        target: -11 + 10 * Math.log10(size / 1.2) - 8,
        kind: "i",
        sendDb: -9,
      });
    });
  });
  // stones that fly past the camera into the core
  m.part("fly-past", () => {
    (
      [
        [10.1, -1],
        [10.6, 1],
        [11.9, 1],
        [12.6, -1],
        [13.2, 1],
        [13.7, -1],
        [14.2, 1],
        [19.5, -1],
      ] as const
    ).forEach(([t, side], i) => {
      // review 6: each tears the air as it passes, closest a third of the way, then on into the core
      const src = huuk(0.6, 1560 + i, 28, 0.5, 0.3);
      const core = orbAt(t + 0.3);
      const k = Math.floor(src.length * 0.3);
      const P = concat(
        line([side * 2.5, 1.2, 5.0], [side * 1.0, 1.4, 0.0], k),
        line([side * 1.0, 1.4, 0.0], core, src.length - k),
      );
      m.add(`fly-past${i}`, src, t - 0.18, P, {
        target: huukDb(28, 0.5),
        kind: "i",
        sendDb: -10,
      });
    });
  });
  // the pile at the core: crunching and grinding more as they arrive, and the groan of large masses
  m.part("pile-crunch", () => {
    const CORE: Vec3 = [0.0, 3.0, -10.0];
    m.add(
      "pile-crunch",
      S.rubble(3.2, 1580, (t) => 6.0 + 9.0 * t, {
        sizes: [0.2, 0.8],
        bright: 0.2,
        body: 0.8,
      }),
      11.6,
      CORE,
      { target: -23, kind: "m", focusDb: 2, sendDb: -4 },
    );
    const groan = S.groan(3.2, 1581, {
      rLo: 40,
      rHi: 90,
      res: [60.0, 110.0, 190.0],
      q: 3.0,
    });
    m.add(
      "pile-groan",
      times(
        groan,
        curve(
          [
            [11.6, 0.0],
            [11.85, 0.3],
            [14.7, 1.0],
            [14.8, 0.0],
          ],
          11.6,
          groan.length,
        ),
      ),
      11.6,
      CORE,
      { target: -23, kind: "m", focusDb: 2, sendDb: -4 },
    );
  });
}

// ---- Review 4, 2026-11-11. The owner: at the cut near 11.55 s the sound does not go on. The orb's
// material, its voice and its core were made shot by shot, each with its own noise and place, so
// at each cut they stopped in 10 to 15 ms and began again. Now each is one source that runs across
// the cuts; at a cut only its place, distance and level change, through an equal-power crossfade of
// 120 ms. Nothing begins fresh on a cut, and the proximity changes over 150 ms or more.

interface AcrossPart {
  readonly from: number;
  readonly to: number;
  readonly pos: Where;
  readonly opts: AddOptions;
}

/**
 * One continuous signal (from `t0`), laid shot by shot: each part from its cut to the next, with an
 * equal-power crossfade of `xf` seconds across each cut, and `tail` seconds of fade after the last.
 */
function across(
  m: Mix,
  name: string,
  sig: Float64Array,
  t0: number,
  parts: readonly AcrossPart[],
  xf = 0.12,
  tail = 0.2,
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
    const fin = first ? nsamp(0.02) : nsamp(xf);
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

/** The orb's red material and its voice: one source each from 4.86 s, across the cuts to 14.81 s. */
function orbAcross(m: Mix): void {
  m.part("orb-body", () => {
    const T0 = 4.86;
    const T1 = 15.05;
    const body = material(
      T0,
      T1 - T0,
      1040,
      [
        [4.86, 0.45],
        [7.2, 0.6],
        [8.05, 0.5],
        [9.47, 0.3],
        [11.55, 0.33],
        [14.8, 0.45],
      ],
      [0.9, 1.0, 0.3],
    );
    const voice = S.voice(T1 - T0, 1041, ORB);
    const tearAt = (n: number) => line([-1.5, 2.0, -5.0], [0.8, 1.4, -3.0], n);
    const shots: [
      number,
      number,
      Where | ((n: number) => Where),
      number,
      number,
      number,
    ][] = [
      [4.86, 7.21, [0.0, 1.4, -2.2], -19.5, -23.5, -10],
      [7.21, 8.05, [1.5, 1.5, -6.0], -26, -29, -4],
      [8.05, 9.47, [0.0, 3.0, -14.0], -31, -33, -4],
      [9.47, 11.55, tearAt, -20.5, -21.5, -10],
      [11.55, 14.81, [0.0, 3.0, -10.0], -23, -26, -4],
    ];
    for (const [name, sig, which] of [
      ["orb-body", body, 3],
      ["orb-body-voice", voice, 4],
    ] as const) {
      const parts = shots.map(([from, to, pos, tb, tv, send], k) => {
        const len = nsamp(
          to -
            from +
            (k === 0 ? 0.06 : 0.12) +
            (k === shots.length - 1 ? 0.14 : 0),
        );
        const p =
          typeof pos === "function" ? (pos as (n: number) => Where)(len) : pos;
        return {
          from,
          to,
          pos: p,
          opts: {
            target: which === 3 ? tb : tv,
            kind: "m" as const,
            focusDb: k === 4 ? 3 : 0,
            sendDb: send - (which === 4 ? 2 : 0),
          },
        };
      });
      across(m, name, sig, T0, parts);
    }
  });
}

// ---- The owner's rule, 2026-11-11: a sound earns its place by its part in the moment; small detail
// of little weight that nobody would miss is cut ("this matters especially in animation"). In
// scene 1 that removed `far-debris`, `pebbles` and `leap-debris`, the trickle of 1 to 3 cm pieces
// after the stone that bursts toward the camera (21.98 s), the stones under 0.3 m that fall behind
// the ice, and the patter of small debris under the smoke. The red passage (`red.ts`) stays the
// study's; these parts replace its layers in the scene, and `cutSmall` leaves the originals out.

/** The stone that bursts toward the camera at 21.98 s: its 35 cm stone and its crack, no trickle. */
function burstStone(m: Mix): void {
  m.part("rock-burst-stone", () => {
    const rb = zeros(nsamp(0.9));
    addAt(rb, S.stoneImpact(0.35, Math.sqrt(2 * 9.81 * 1.5), rng(124)), 0);
    const n = S.norm(rb);
    addAt(
      n,
      S.heavyCrack(126, { size: 0.7, dur: 0.4, kRate: 8 }).subarray(
        0,
        n.length,
      ),
      0,
      0.9,
    );
    // review 6: it bursts toward us fast (25 m/s): a loud hard strike, and it tears the air past us
    m.add(
      "rock-burst-stone",
      lp(S.saturate(n, 1.5), 12000),
      21.98,
      [-0.8, 1.2, -1.5],
      {
        target: Math.round(hitDb(0.35, 25)),
        kind: "i",
        sendDb: -6,
      },
    );
    passBy(m, "rock-burst-huuk", 22.1, -1, 1.0, 25, 0.35, 3150, 0.3);
  });
}

/** 26.7 to 28.7 s: behind the ice, only the stones of 0.3 to 0.5 m keep coming down. */
function wallStones(m: Mix): void {
  m.part("wall-stones", () => {
    (
      [
        [-7.5, 0.0, -9.0],
        [7.0, 0.0, -11.0],
      ] as Vec3[]
    ).forEach((pos, i) => {
      // the share of the study's draws from 0.15 to 0.5 m that lie at 0.3 m or more: log(5/3)/log(10/3)
      const keep = Math.log(0.5 / 0.3) / Math.log(0.5 / 0.15);
      const wd = S.tumble(
        2.0,
        572 + i,
        (q) => keep * (6.0 * Math.exp(-q / 0.9) + 0.8),
        [0.3, 0.5],
        // review 6: they come down from the vault fast and strike loud
        [8.0, 14.0],
      );
      m.add(`wall-stones${i}`, wd, 26.7, pos, {
        target: -19,
        kind: "m",
        focusDb: 3,
      });
    });
  });
}

/** Leaves out the red passage's layers that the rule cuts or that `burstStone` and `wallStones` replace. */
function cutSmall(m: Mix): void {
  for (const name of [
    "rock-burst",
    "wall-debris0",
    "wall-debris1",
    "debris-rain0",
    "debris-rain1",
  ]) {
    m.layers.delete(name);
    for (let i = m.order.length - 1; i >= 0; i--)
      if (m.order[i] === name) m.order.splice(i, 1);
  }
}

// ---- Review 6, 2026-11-11 (render r6). The owner: stones that fly out should go "huuk": they
// move fast, so the air tears; and when they strike the floor it should be loud, because they are
// fast. Every stone that flies past the camera now tears the air (`huuk`, in place of the steady
// band of noise that read as wind), and every stone that strikes lands with the accepted landing's
// timbre, louder with its speed (`fastHit`). Around 13 s the black hole leads again; around 21 s
// the sparks the orb strikes from the rock are a spray that is heard.

/** The level of a stone that lands, from the accepted landing (a slab of 1.6 m at -11 LUFS), lower by its size. */
const landing = (size: number) => -11 + 10 * Math.log10(size / 1.6);

/**
 * The level of a fast stone that strikes: the landing of its size, up by its speed against the
 * accepted landing's (about 8 m/s), down by its distance beyond the accepted landing's 6 m.
 */
const hitDb = (size: number, v: number, dist = 6) =>
  landing(size) +
  10 * Math.log10(v / 8) -
  10 * Math.log10(Math.max(dist, 6) / 6);

/** The level of a stone's tear through the air: up by its speed and its size. */
const huukDb = (speed: number, size: number) =>
  -13 + 10 * Math.log10(speed / 25) + 5 * Math.log10(size / 0.5);

/**
 * A stone that tears through the air ("huuk"): the air noise of its speed (`aero`: brighter and
 * louder as it is faster), torn by an irregular grain, with a low body for its size. It swells as
 * it comes, peaks `pk` of the way through, and is cut off fast as it goes. Its pitch moves only by
 * the Doppler of its path; nothing glides. Two low-pass sections at 9 kHz.
 */
function huuk(
  dur: number,
  seed: number,
  speed: number,
  size: number,
  pk = 0.62,
): Float64Array {
  const n = nsamp(dur);
  const air = S.norm(
    S.aero(new Float64Array(n).fill(speed), seed, 10.0, 180.0, 250.0, 8500.0),
  );
  const tear = S.irregular(n, seed + 1, 25.0, 120.0);
  const body = S.norm(
    steady(dur, seed + 2, 50.0, 260.0 / Math.max(size, 0.3) ** 0.5),
  );
  const tp = pk * dur;
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = t < tp ? (t / tp) ** 3 : Math.exp(-(t - tp) / 0.045);
    y[i] =
      e *
      (air[i]! * (0.7 + 0.3 * tear[i]!) + 0.5 * Math.min(size, 1.5) * body[i]!);
  }
  return fade(lp(lp(y, 9000), 9000), 0.002, 0.01);
}

/**
 * A stone that passes the camera: its tear on a straight path at `speed` m/s that comes closest,
 * `near` m to one side, at second `t`.
 */
function passBy(
  m: Mix,
  name: string,
  t: number,
  side: number,
  near: number,
  speed: number,
  size: number,
  seed: number,
  dur = 0.4,
  height = 1.5,
): void {
  const pk = 0.62;
  const src = huuk(dur, seed, speed, size, pk);
  const k = Math.floor(src.length * pk);
  const P = concat(
    line(
      [side * near * 0.6, height, -speed * pk * dur],
      [side * near, height, 0.0],
      k,
    ),
    line(
      [side * near, height, 0.0],
      [side * (near + 0.6), height, speed * (1 - pk) * dur],
      src.length - k,
    ),
  );
  m.add(name, src, t - pk * dur, P, {
    target: huukDb(speed, size),
    kind: "i",
    sendDb: -12,
  });
}

/**
 * A fast stone that strikes: the accepted landing's timbre (a slab's thud and crack, `slabFall`)
 * with the clack and tick of its speed (`stoneImpact`), driven a little so its front is hard.
 */
function fastHit(seed: number, size: number, v: number): Float64Array {
  const slab = S.slabFall(seed, size, 0.8);
  const k = S.norm(S.stoneImpact(size, v, rng(seed + 1)));
  const y = zeros(Math.max(slab.length, k.length));
  addAt(y, slab, 0, 1.0);
  addAt(y, k, 0, 0.7);
  return lp(S.saturate(S.norm(y), 1.5), 12000);
}

/** 20.15 to 22.08 s: the rocks that pass the camera with the orb tear the air (in place of `rock-pass`). */
function rockHuuk(m: Mix): void {
  m.part("rock-huuk", () => {
    (
      [
        [20.15, -1, 2.2, 0.4],
        [20.42, 1, 2.6, 0.35],
        [20.63, -1, 1.8, 0.5],
        [20.88, 1, 2.4, 0.4],
        [21.02, -1, 2.0, 0.4],
        [21.52, 1, 2.2, 0.4],
        [21.66, -1, 1.2, 0.5],
        [21.74, 1, 1.3, 0.5],
        [22.08, -1, 1.1, 0.6],
      ] as const
    ).forEach(([t, side, near, size], i) =>
      passBy(m, `rock-huuk${i}`, t, side, near, 32, size, 3100 + 7 * i, 0.36),
    );
  });
}

/**
 * 21.12 and 21.80 s: the orb strikes rock and sparks spray from it over the frame. Each spray is one
 * event: a hard bright burst, then a dense crackle of hot sparks that thins out, and the fizz of
 * their burning, spread to both sides. Two low-pass sections at 11 kHz.
 */
function sparkSpray(m: Mix): void {
  m.part("spark-spray", () => {
    (
      [
        [21.13, 0.6, -13],
        [21.82, 0.65, -12],
      ] as const
    ).forEach(([t, dur, tg], i) =>
      ([-1, 1] as const).forEach((side, j) => {
        const seed = 3200 + 20 * i + 10 * j;
        const n = nsamp(dur);
        const y = zeros(n);
        addAt(
          y,
          S.tiltedBurst(seed, 600.0, 12000.0, 0.012, {
            tilt: 0.3,
            rise: 0.0003,
          }),
          0,
          1.0,
        );
        addAt(
          y,
          S.sizzle(dur, seed + 1, 0.13, 7000.0, 1800.0, 11000.0),
          0,
          0.9,
        );
        addAt(
          y,
          S.burst(seed + 2, 3000.0, 10000.0, 0.12, { dur, rise: 0.003 }),
          0,
          0.35,
        );
        const s = lp(lp(S.saturate(S.norm(y), 1.5), 11000), 11000);
        m.add(
          `spark-spray${i}-${j}`,
          fade(s, 0.0005, 0.05),
          t,
          [side * 1.4, 1.6, -2.6],
          {
            target: tg - 3,
            kind: "i",
            sendDb: -8,
          },
        );
      }),
    );
  });
}

/**
 * 25.98 to 26.88 s: the stones the rays throw out tear through the air from the burst and land
 * loud, at the accepted landing's timbre and the level of their size and speed (in place of
 * `ray-debris`).
 */
function rayStones(m: Mix): void {
  m.part("ray-stones", () => {
    const FROM: Vec3 = [0.0, 3.0, -6.0];
    (
      [
        [25.98, [-8.0, 0.0, -7.5], 0.5],
        [26.07, [8.0, 0.0, -8.5], 0.4],
        [26.2, [-2.5, 0.0, -9.0], 0.7],
        [26.72, [4.5, 0.0, -14.0], 0.5],
        [26.88, [-5.0, 0.0, -15.0], 0.6],
      ] as [number, Vec3, number][]
    ).forEach(([tl, pos, size], i) => {
      const dist = Math.hypot(pos[0], pos[1] - 1.5, pos[2]);
      m.add(`ray-stone${i}`, fastHit(566 + i, size, 20), tl, pos, {
        target: hitDb(size, 20, dist),
        kind: "i",
        focusDb: 4,
      });
      const dur = Math.min(0.3, tl - 25.8);
      const src = huuk(dur, 3300 + i, 20, size, 0.8);
      m.add(`ray-stone${i}-huuk`, src, tl - dur, line(FROM, pos, src.length), {
        target: huukDb(20, size) - 3,
        kind: "i",
        sendDb: -8,
      });
    });
  });
}

/**
 * Around 13 s the black hole leads (review 6: only the wind was heard). From the cut at 11.55 s to
 * the cut at 14.81 s the layers of drawn air go 6 dB down, the torrent of the hole 3 dB, and the
 * hole's voice (its swallows, growl, mana, ring and core) 4 dB up. A layer step.
 */
const DRAWN_AIR =
  /^(draw|draw-low|hole-inrush|orbit|gather-grind|gather-rubble|gather-low|gather-clump)/;
const HOLE_VOICE =
  /^(hole-swallow|hole-growl|hole-mana|hole-ring|hole-core|orb-body-voice)/;
function foreHole(m: Mix, name: string, l: Layer): void {
  const db =
    name === "hole-roar"
      ? -3
      : DRAWN_AIR.test(name)
        ? -6
        : HOLE_VOICE.test(name)
          ? 4
          : 0;
  if (!db) return;
  const ts = [11.45, 11.65, 14.71, 14.91];
  const vs = [0, db, db, 0];
  for (const part of [l.dry, l.wet])
    for (const ch of part)
      for (let i = 0; i < ch.length; i++)
        ch[i] = ch[i]! * lin(interp(m.t0 + (l.start + i) / SR, ts, vs));
}

/** Leaves out the red passage's layers that `rockHuuk` and `rayStones` replace. */
function replaceRed(m: Mix): void {
  for (const name of [
    ...Array.from({ length: 9 }, (_, i) => `rock-pass${i}`),
    ...Array.from({ length: 5 }, (_, i) => `ray-debris${i}`),
  ]) {
    m.layers.delete(name);
    for (let i = m.order.length - 1; i >= 0; i--)
      if (m.order[i] === name) m.order.splice(i, 1);
  }
}

/** Scene 1, the red seal: the black hole, then the study's red passage. */
export function scene(): Mix {
  const m = new Mix("scene1", 0.0, SCENE_END, 1.5);
  m.until = SCENE_END;
  m.part("bed", () =>
    fullBed(m, 0.0, SCENE_END + 1.5, 101, -41.0, [
      [0, -30],
      [1.0, 0],
      [24.7, 0],
      [25.3, -4],
      [25.7, -4],
      [26.6, 0],
      [SCENE_END + 1.5, 0],
    ]),
  );
  blackHole(m);
  orbAcross(m);
  redLayers(m, { bed: false });
  burstStone(m);
  wallStones(m);
  m.finish(cutSmall);
  rockHuuk(m);
  sparkSpray(m);
  rayStones(m);
  m.finish(replaceRed);
  holeBody(m);
  m.finish(levelCore);
  suction(m);
  character(m);
  gathering(m);
  m.eachLayer("carve", carve);
  m.eachLayer("fore-hole", foreHole);
  m.driveDb = 8.8;
  // review 3: 1 dB less into the master where the black hole is near, so the soft clip's final trim
  // of the true peak no longer lowers the whole scene; the landings lie within 0.2 dB of review 0
  m.beforeDb = [
    [4.7, 0],
    [4.86, -1],
    [7.21, -1],
    [7.3, 0],
    [9.4, 0],
    [9.6, -1],
    [14.82, -1],
    [14.9, 0],
    [18.6, 0],
    [19.2, -1],
    [22.3, -1],
    [22.4, 0],
    // review 6: the stones the rays throw out add to the block's break at 26.6 s, where the
    // limiter works 5 dB deep; 1.3 dB less into the master there keeps the master's gain of r6
    [26.45, 0],
    [26.55, -1.3],
    [26.75, -1.3],
    [26.85, 0],
  ];
  // the end of the scene: the sound fades over the first second of the next shot
  m.afterDb = [
    [0, 0],
    [SCENE_END, 0],
    [SCENE_END + 1.0, -60],
  ];
  return m;
}
