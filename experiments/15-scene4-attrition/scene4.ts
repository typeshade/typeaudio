// Scene 4 of the reference video, the battle of attrition, 62.27 to 82.40 s, made with the study's
// models in the engine (`src/study/`), as scenes 1 to 3 are. Its mix starts at 61.27 s with scene 3's
// last shot (her face, the wind in her hair, the settling dust, the hall) and masters at scene 3's
// gain, so the two join at 62.27 s.
//
// The frames, read on 2026-11-12 at 4 and 24 frames a second, with a cut detector:
//
//   62.27-62.85  from above: she stands on the emblem floor; a white beam sweeps along the floor
//                toward her from the left; light flares at her staff (62.25 to 62.75)
//   62.85-63.27  quick cuts (62.98, 63.02, 63.06): a dark frame, a flash far off
//   63.27-64.73  the beam blasts through the rocks, blocks break and fly (63.3 to 63.8); dark
//                fragments rush past the camera (64.25 to 64.7)
//   64.73-65.15  quick cuts (64.98, 65.07): a blue sphere of hexagons among the blocks
//   65.15-67.61  wide: the sphere shields her while blocks batter it; it fades at 66.25 and she
//                stands among the falling blocks
//   67.61-68.86  closer: her silhouette with the staff among falling blocks and dust
//   68.86-71.15  Fern's face: "It blocked it." (a spoken line; the effects recede)
//   71.15-72.20  a streak of light with sparks crosses the hall
//   72.20-74.12  wide: Frieren and the golem in the hall; streaks cross; dark fragments and embers fly
//                past the camera (73.0 to 73.9)
//   74.12-76.91  Frieren, her hair blowing, blocks floating round her; she raises the staff (75.45)
//                ("It's still within our expectations.")
//   76.91-79.41  her eye, close ("From here on,")
//   79.41-82.26  her face, close, without colour, embers drifting ("it will be a battle of
//                attrition"); the picture fades to black (black 82.26 to 82.38; scene 5 from 82.42)
//
// The owner's rules of scenes 1 to 3 hold from the start: a sound earns its place (no small stones,
// no clicks of cloth or grains: `test/small-stones.test.ts`); an attack short and intense at its hit,
// and its level does not drop while it is on screen; big hits exaggerated, in animation's scale,
// without squashing; clarity (frequency slots, mono lows, short tails, little hall on dense layers);
// the presence of 120 Hz to 2 kHz; no glide; nothing above 12 kHz of note; positions follow the
// picture; one source across the cuts. Where a line is spoken the effects recede but stay alive.

import { SR, addAt, fade, iir, nsamp, rbj, type Stereo, type Vec3 } from '../../src/study/dsp.ts';
import { Mix, type Layer } from '../../src/study/mix.ts';
import { concat, line, steady } from '../../src/study/passage.ts';
import {
  BOLD,
  CEILING_DBTP,
  LIFT,
  body,
  impactSize,
  scaleLayer,
} from '../../src/study/presence.ts';
import * as S from '../../src/study/sources.ts';
import { fastHit, landing, passBy } from '../12-scene1-red-seal/tail.ts';
import {
  SCENE1_MASTER,
  drop,
  env,
  lowPass,
  shapeLayer,
  xfade,
} from '../13-scene2-stone-giant/scene2.ts';
import { after, bed3, hum, lp2, plasma, shots } from '../14-scene3-lightning/scene3.ts';

export const SCENE4_FROM = 61.27;
export const SCENE4_JOIN = 62.27;
export const SCENE4_END = 82.4;

// ---- The hall of this scene, crossed from scene 3's at the first cut.
function bed4(m: Mix): void {
  m.part('bed4', () => {
    const t0 = 62.0;
    const dur = SCENE4_END + 1.5 - t0;
    m.addWide('bed4', S.hallAir(dur, 401), t0, { target: -43.0, kind: 'a' });
    m.addWide('bed4-low', S.wideNoise(dur, 404, 28, 90, 3), t0, { target: -47.0, kind: 'r' });
  });
}

function tidy4(m: Mix): void {
  // scene 3's face shot ends at the cut: its wind, its sleeve and its dust go in 0.3 s
  for (const name of ['hair-wind', 'hair-cloth', 'settle-dust'])
    if (m.layers.has(name)) shapeLayer(m, name, xfade(62.27, 62.57, true));
  for (const name of ['bed3', 'bed3-low']) shapeLayer(m, name, xfade(62.3, 63.0, true));
  for (const name of ['bed4', 'bed4-low']) shapeLayer(m, name, xfade(62.3, 63.0, false));
  drop(m, ['mana-reabsorb0', 'mana-reabsorb1', 'residue-crackle']);
}

// ---- 62.27 to 64.73: the white beam. It sweeps along the floor toward her (from above), then, close,
// blasts through the rocks. One source across the shots; it grows to the impact and holds while it is
// on screen. A different colour from the lightning: a smooth roar of pressure with a seared top, a
// heavy low body, little crackle.
const HER_ABOVE: Vec3 = [0.3, 0.0, -9.0];
function beam(m: Mix): void {
  m.part('beam4', () => {
    const t0 = 62.27;
    const t1 = 64.8;
    const dur = t1 - t0;
    const n = nsamp(dur);
    const lv = env(
      [
        [t0, 0.55],
        [62.98, 0.9],
        [63.27, 1.0],
        [64.55, 0.95],
        [t1, 0.0],
      ],
      t0,
      n,
    );
    const roar = S.norm(
      plasma(
        t0,
        t1,
        4500,
        [
          [t0, 1.0],
          [t1, 1.0],
        ],
        1200,
      ),
    );
    const top = S.norm(S.sear(dur, 4501, 1500, 7000, 3.0));
    const low = S.norm(S.billow(dur, 4502, 30.0, 120.0, 2.0)[0]);
    const sig = lp2(
      new Float64Array(n).map((_, i) => (0.9 * roar[i]! + 0.35 * top[i]! + 0.6 * low[i]!) * lv[i]!),
      9000,
    );
    shots(m, 'beam4-', t0, [
      // from above: it comes along the floor from the left toward her
      { from: t0, to: 62.98, sig, pos: [-4.0, 0.0, -9.0], target: -15, sendDb: -8 },
      // the quick cuts: the beam far off, behind the flash
      {
        from: 62.98,
        to: 63.27,
        sig: lp2(sig, 2500),
        pos: [0.0, 0.0, -12.0],
        target: -17,
        sendDb: -6,
      },
      // close: through the rocks, from the upper left to the lower right
      { from: 63.27, to: t1, sig, pos: [-0.5, 1.2, -3.5], target: -11, sendDb: -10 },
    ]);
    // the light that flares at her staff as she meets it (62.25 to 62.75): a bright, smooth bloom
    const fl = new Float64Array(nsamp(0.6));
    addAt(fl, S.tiltedBurst(4510, 2000.0, 9000.0, 0.12, { tilt: 0.4, rise: 0.02 }), 0, 1.0);
    m.add('shield-flare', lp2(fade(fl, 0.02, 0.1), 9000), 62.3, HER_ABOVE, {
      target: -22,
      kind: 'i',
      sendDb: -8,
    });
    // the beam strikes the rocks (63.27 s): an impact of animation's size
    impactSize(m, 'k-beam', 63.27, 4520, {
      hold: 0.4,
      decay: 1.1,
      db: 0,
      pos: [-0.5, 0.5, -4.0],
      crack: 2.5,
    });
  });
}

// ---- 63.30 to 64.70: the rocks the beam breaks: large blocks crack and fly; dark fragments rush past
// the camera. Large pieces only.
function rocks(m: Mix): void {
  m.part('rocks4', () => {
    (
      [
        [63.3, [-1.5, 1.0, -4.0], 1.4],
        [63.52, [1.5, 0.5, -3.5], 1.1],
        [63.78, [0.5, 1.5, -5.0], 1.6],
      ] as [number, Vec3, number][]
    ).forEach(([t, pos, size], k) => {
      const c = lp2(S.heavyCrack(4530 + k, { size, dur: 0.5, kRate: 5, bright: 0.4 }), 10000);
      m.add(`block4-break${k}`, c, t, pos, { target: landing(size) - 1, kind: 'i', sendDb: -8 });
    });
    passBy(m, 'block4-rush0', 64.32, -1, 1.0, 22, 1.2, 4540, 0.45);
    passBy(m, 'block4-rush1', 64.58, 1, 1.4, 20, 1.0, 4541, 0.45);
  });
}

// ---- 64.98 to 66.25: the sphere of hexagons shields her while blocks batter it; at 66.25 s it fades.
// The field: a contained, low, resonant pressure (scene 2's barrier); each block that hits it a dull
// energy thud with the field's ring; the battering under it a low rumble of large blocks. Then blocks
// land round her (66.6 to 68.6 s).
const SHIELD: Vec3 = [-1.2, 0.8, -7.0];
function shield(m: Mix): void {
  m.part('shield4', () => {
    const t0 = 64.98;
    const t1 = 66.45;
    const fd = t1 - t0;
    const fn = nsamp(fd);
    const res = iir(S.norm(steady(fd, 4600, 100, 700)), [
      rbj('peak', 200, 2.0, 8),
      rbj('peak', 340, 2.5, 6),
    ]);
    const fe = env(
      [
        [t0, 0.0],
        [t0 + 0.04, 1.0],
        [66.2, 1.0],
        [t1, 0.0],
      ],
      t0,
      fn,
    );
    m.add(
      'shield-field',
      lp2(
        res.map((v, i) => v * fe[i]!),
        2000,
      ),
      t0,
      SHIELD,
      {
        target: -18,
        kind: 'm',
        sendDb: -6,
      },
    );
    // the shield appears (64.98 s): a bright, smooth bloom with a low push
    const on = new Float64Array(nsamp(0.5));
    addAt(on, S.tiltedBurst(4601, 800.0, 9000.0, 0.05, { tilt: 0.4, rise: 0.004 }), 0, 1.0);
    addAt(on, S.boom(4602, { f: 60.0, tau: 0.12, dur: 0.5 }), 0, 0.7);
    m.add('shield-on', lp2(on, 9000), t0, SHIELD, { target: -14, kind: 'i', sendDb: -8 });
    // blocks that hit the shield, each its own size and side
    (
      [
        [65.18, -1.6, 1.2],
        [65.44, 0.6, 0.9],
        [65.71, -0.4, 1.5],
        [65.97, 1.4, 1.0],
        [66.16, -1.9, 1.3],
      ] as [number, number, number][]
    ).forEach(([t, dx, size], k) => {
      const h = new Float64Array(nsamp(0.6));
      addAt(h, S.blockHit(4610 + k, size, 12.0), 0, 0.8);
      const ring = iir(S.norm(S.burst(4620 + k, 150, 900, 0.18, { rise: 0.004 })), [
        rbj('peak', 340, 3.0, 6),
      ]);
      addAt(h, ring.subarray(0, h.length), 0, 0.6);
      m.add(`shield-hit${k}`, lp2(S.norm(h), 10000), t, [SHIELD[0] + dx, 1.2, SHIELD[2]], {
        target: landing(size) - 1,
        kind: 'i',
        sendDb: -8,
      });
    });
    // the battering: a low rumble of large blocks round the shield, no small pieces
    const rb = S.rubble(1.5, 4630, (t) => 6.0 * Math.exp(-t / 1.2), {
      sizes: [0.5, 1.4],
      bright: 0.2,
      body: 0.8,
    });
    m.add('block4-batter', lp2(fade(rb, 0.02, 0.2), 8000), 65.15, SHIELD, {
      target: -20,
      kind: 'm',
      sendDb: -6,
    });
    // the shield fades (66.25 s): the field lets go, a soft fall of its brightness
    const off = new Float64Array(nsamp(0.5));
    addAt(off, S.burst(4640, 1500, 8000, 0.15, { rise: 0.03 }), 0, 1.0);
    m.add('shield-off', lp2(off, 9000), 66.25, SHIELD, { target: -24, kind: 'i', sendDb: -6 });
    // blocks land round her, large, at the accepted landing's level for their size and distance
    (
      [
        [66.62, [-3.0, 0.0, -8.0], 1.2],
        [67.02, [2.5, 0.0, -7.0], 1.0],
        [67.4, [-1.0, 0.0, -9.0], 1.4],
        [67.78, [-2.0, 0.0, -4.0], 1.0],
        [68.24, [2.5, 0.0, -4.5], 1.6],
      ] as [number, Vec3, number][]
    ).forEach(([t, pos, size], k) => {
      m.add(`land4-${k}`, fastHit(4650 + k, size, 10), t, pos, {
        target: landing(size) - 2,
        kind: 'i',
        focusDb: 2,
        sendDb: -6,
      });
    });
    // the dust of the falling blocks, smooth
    const ds = S.dust(4.0, 4660, { lo: 600.0, hi: 6000.0, sd: 2.0, grain: 0.0 });
    const de = env(
      [
        [65.1, 0.0],
        [65.6, 1.0],
        [68.8, 0.8],
        [69.1, 0.3],
        [69.1 + 0.0, 0.3],
      ],
      65.1,
      ds[0].length,
    );
    m.addWide(
      'dust4',
      [
        lp2(
          ds[0].map((v, i) => v * de[i]!),
          8000,
        ),
        lp2(
          ds[1].map((v, i) => v * de[i]!),
          8000,
        ),
      ],
      65.1,
      {
        target: -28,
        kind: 'm',
        sendDb: -4,
      },
    );
  });
}

// ---- 68.86 to 71.15: Fern's line. The effects recede and stay alive: two far, soft landings of the
// last blocks; the dust settles.
function recede(m: Mix): void {
  m.part('recede4', () => {
    (
      [
        [69.45, [-6.0, 0.0, -14.0], 1.0],
        [70.35, [5.0, 0.0, -15.0], 0.8],
      ] as [number, Vec3, number][]
    ).forEach(([t, pos, size], k) =>
      m.add(`land4-far${k}`, fastHit(4670 + k, size, 6), t, pos, {
        target: landing(size) - 10,
        kind: 'i',
        sendDb: -2,
      }),
    );
  });
}

// ---- 71.15 to 74.12: streaks of light cross the hall; in the wide shot of Frieren and the golem,
// dark fragments and embers fly past the camera. Each streak a smooth, bright rush on its own path.
function streaks(m: Mix): void {
  m.part('streaks4', () => {
    (
      [
        [71.25, 0.8, 1, [0.0, 3.0, -6.0]],
        [72.32, 0.5, -1, [0.0, 3.5, -10.0]],
        [72.66, 0.5, 1, [0.0, 3.0, -9.0]],
        [73.18, 0.6, -1, [0.0, 3.0, -8.0]],
      ] as [number, number, number, Vec3][]
    ).forEach(([t, d, side, mid], k) => {
      const n = nsamp(d);
      const bell = new Float64Array(n).map((_, i) => Math.sin((Math.PI * i) / n) ** 2);
      const sz = S.norm(steady(d, 4700 + k, 1500, 8000));
      const bodyS = S.norm(steady(d, 4710 + k, 300, 2000));
      const sig = lp2(
        new Float64Array(n).map((_, i) => (0.8 * sz[i]! + 0.4 * bodyS[i]!) * bell[i]!),
        9000,
      );
      const h = Math.floor(n / 2);
      m.add(
        `streak4-${k}`,
        sig,
        t,
        concat(
          line([side * 5.0, mid[1], mid[2] + 1.0], mid, h),
          line(mid, [-side * 5.0, mid[1], mid[2] - 1.0], n - h),
        ),
        { target: k === 0 ? -18 : -21, kind: 'i', sendDb: -8, doppler: false },
      );
    });
    passBy(m, 'block4-past0', 73.05, -1, 1.2, 18, 0.9, 4720, 0.4);
    passBy(m, 'block4-past1', 73.58, 1, 1.0, 20, 0.8, 4721, 0.4);
    // embers drifting past: a smooth, warm fizz
    const en = nsamp(1.2);
    const ee = new Float64Array(en).map((_, i) => Math.sin((Math.PI * i) / en) ** 2);
    const emb = lp2(steady(1.2, 4730, 2000, 7000), 8000).map((v, i) => v * ee[i]!);
    m.add('embers4', emb, 72.9, line([2.0, 1.0, -2.0], [-2.0, 1.2, -2.5], en), {
      target: -27,
      kind: 'm',
      sendDb: -8,
      doppler: false,
    });
  });
}

// ---- 74.12 to 82.26: the blocks float round Frieren: a low, steady, gently wavering hum of the
// magic that holds them, one source across the three close shots, receding under the spoken lines and
// fading to nothing with the picture; the wind in her hair; the staff raised (75.45 s); embers in the
// last shot.
function float(m: Mix): void {
  m.part('float4', () => {
    const t0 = 74.0;
    const t1 = 82.3;
    const h = hum(t0, t1, 4800, [
      [t0, 0.0],
      [74.3, 0.5],
      [76.8, 0.5],
      [77.2, 0.35],
      [79.3, 0.35],
      [79.6, 0.3],
      [81.5, 0.2],
      [82.25, 0.0],
    ]);
    // the hum an octave and more up from scene 3's voltage (no lightning here): its lowest partial cut
    const fh = iir(h, [rbj('hp', 70, 0.7071), rbj('peak', 220, 1.5, 4)]);
    shots(m, 'float-hum', t0, [
      { from: t0, to: 76.91, sig: fh, pos: [0.0, 1.5, -4.0], target: -24, sendDb: -6 },
      { from: 76.91, to: 79.41, sig: fh, pos: [0.0, 1.5, -2.0], target: -27, sendDb: -6 },
      { from: 79.41, to: t1, sig: fh, pos: [0.0, 1.5, -2.0], target: -28, sendDb: -6 },
    ]);
    const hw = S.wind(76.9 - 74.05, 4810, 600, 6500).map((c) => lp2(c, 9000)) as Stereo;
    hw[1] = hw[1].map((v, i) => 0.4 * v + 0.6 * hw[0][i]!);
    const he = env(
      [
        [74.05, 0.0],
        [74.3, 1.0],
        [76.6, 0.9],
        [76.9, 0.0],
      ],
      74.05,
      hw[0].length,
    );
    m.addWide(
      'hair4-wind',
      [hw[0].map((v, i) => v * he[i]!), hw[1].map((v, i) => v * he[i]!)] as Stereo,
      74.05,
      {
        target: -28,
        kind: 'm',
      },
    );
    const sw = new Float64Array(nsamp(0.35));
    addAt(sw, S.norm(steady(0.35, 4820, 300, 3000)), 0, 1.0);
    const sb = sw.map((v, i) => v * Math.sin((Math.PI * i) / sw.length) ** 2);
    m.add(
      'staff4-swish',
      lp2(sb, 6000),
      75.4,
      line([1.5, 1.0, -1.5], [-0.5, 1.6, -1.5], sb.length),
      {
        target: -28,
        kind: 'i',
        sendDb: -8,
        doppler: false,
      },
    );
    const en = nsamp(2.8);
    const ee = env(
      [
        [79.4, 0.0],
        [79.9, 1.0],
        [81.4, 0.7],
        [82.2, 0.0],
      ],
      79.4,
      en,
    );
    const emb = lp2(S.norm(steady(2.8, 4830, 2500, 8000)), 8500).map((v, i) => v * ee[i]!);
    m.add('embers4-close', emb, 79.4, [0.5, 1.5, -1.5], { target: -32, kind: 'm', sendDb: -8 });
  });
}

/**
 * The presence pass (`src/study/presence.ts`) on this scene's main events, and the bolder pass's level
 * for the continuous layers (scene 3's list, so the overlap with it stays exact, and this scene's
 * hall, dust, hum and wind).
 */
const MAIN4 = /^(beam4|k-beam|block4-|shield-(field|hit|on)|land4-)/;
const CONT4 =
  /^(bed|hole-roar|hole-inrush|hole-pressure|draw|far-draw|dark-draw|orbit|swirl|fly-air|flight-air|approach-air|orb-flight|dust-roll|dust-hiss|smoke|face-wind|hair-wind|gust|arc-hum|arc-ticks|g2-hum|settle-dust|dust4|float-hum|hair4-wind)/;
function levels4(_m: Mix, name: string, l: Layer): void {
  if (MAIN4.test(name)) body(l);
  if (CONT4.test(name)) scaleLayer(l, BOLD.continuousDb);
}

/** Scene 4, the battle of attrition: from scene 3's last shot to the black before scene 5. */
export function scene4(): Mix {
  const m = new Mix('scene4', SCENE4_FROM, SCENE4_END, 1.5);
  m.until = SCENE4_END;
  bed3(m);
  after(m);
  bed4(m);
  beam(m);
  rocks(m);
  shield(m);
  recede(m);
  streaks(m);
  float(m);
  m.finish(tidy4);
  // scene 2's low pass, as scene 3 applies it to its hair's wind and sleeve, so the overlap matches
  m.eachLayer('scene4-low-pass', lowPass);
  m.eachLayer('scene4-levels', levels4);
  m.driveDb = BOLD.driveDb;
  m.lift = LIFT;
  m.ceilingDb = CEILING_DBTP;
  m.fixedMaster = SCENE1_MASTER;
  m.afterDb = [
    [SCENE4_FROM, 0],
    [81.9, 0],
    [82.3, -60],
  ];
  return m;
}
