// Scene 4 of the reference video, the battle of attrition, 62.27 to 82.40 s, made with the study's
// models in the engine (`src/study/`), as scenes 1 to 3 are. Its mix starts at 61.27 s with scene 3's
// last shot (her face, the wind in her hair, the settling dust, the hall) and masters at scene 3's
// gain, so the two join at 62.27 s.
//
// The frames, read on 2026-11-12 at 24 frames a second, with a cut detector (review 1 below):
//
//   62.27-62.99  from above: the white beam's head comes along the floor from the left toward her; a
//                glint at her staff from 62.28, flaring at 62.74 to 62.95; the beam reaches her in a
//                white flash at 62.99
//   63.03-63.27  the dark hall, a glint far off; the second beam shoots in on a diagonal (63.12)
//   63.28-64.95  the beam blasts the rocks (63.283) and holds through them, blocks thrown up; it thins
//                (63.62 to 63.81) and is gone by 63.88; rocks land in front of the camera (64.0,
//                64.19); a large block passes right by (64.375); fragments fly across (64.44 to
//                64.56); the smoke rushes past (64.62 to 64.95)
//   65.01-66.26  the sphere of hexagons blooms (65.012) and shields her; blocks strike it (65.14,
//                65.45, 65.83, 66.01); it fades (66.14 to 66.26)
//   66.26-68.86  wide, then closer from 67.61: blocks keep falling round her, landings near her
//   68.86-71.15  Fern's face: "It blocked it." (empty)
//   71.15-72.15  a knot of crackling light drifts right to left; a streak shoots off (71.95)
//   72.15-74.10  wide: Frieren and the golem; flame streaks pass the camera (72.22, 72.33); sparks
//                near the golem (72.45, 72.75); the golem struck, dark chunks burst (73.02); chunks
//                fly to the camera (73.62, 73.85); a last streak (74.0)
//   74.10-76.85  Frieren, her hair blowing, blocks floating round her; the staff swung up (75.10 to
//                75.45) ("It's still within our expectations.")
//   76.85-79.41  her eye, close ("From here on,")
//   79.41-82.26  her face, close ("it will be a battle of attrition"); the picture fades to black
//                (black 82.26 to 82.38; scene 5 from 82.42)
//
// The owner's rules of scenes 1 to 3 hold from the start: a sound earns its place (no small stones,
// no clicks of cloth or grains: `test/small-stones.test.ts`); an attack short and intense at its hit,
// and its level does not drop while it is on screen; big hits exaggerated, in animation's scale,
// without squashing; clarity (frequency slots, mono lows, short tails, little hall on dense layers);
// the presence of 120 Hz to 2 kHz; no glide; nothing above 12 kHz of note; positions follow the
// picture; one source across the cuts. Nothing sounds without an event in the picture, and the
// parts the picture leaves empty stay empty.

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
import { fastHit, huuk, landing, passBy } from '../12-scene1-red-seal/tail.ts';
import {
  SCENE1_MASTER,
  drop,
  env,
  lowPass,
  shapeLayer,
  shimmer,
  xfade,
} from '../13-scene2-stone-giant/scene2.ts';
import { after, arcCrackle, bed3, lp2, plasma, strike } from '../14-scene3-lightning/scene3.ts';

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

// ---- Review 1, 2026-11-12 (render r1). The owner: "Up to the first 2 s I understand it, but after
// that everything fails": the sounds did not sit on the picture's events, the objects did not sound
// like themselves, and it had less care than scenes 1 to 3; "the parts to empty can stay empty, but
// the noise feel is far too strong". Rebuilt from a frame-accurate list (24 frames a second) and from
// the accepted models of scenes 1 to 3: the beams from scene 3's bolt, the blocks from the accepted
// landing and the stone's tear, the shield and the floating blocks from scene 2's mana field, the
// glints from scene 2's shimmer. No bed of noise; nothing sounds without an event in the picture.

/** Scene 2's mana field (its barrier): low pressure through two soft resonances, at a level. */
function field(dur: number, seed: number, level: Float64Array): Float64Array {
  const res = iir(S.norm(steady(dur, seed, 100, 600)), [
    rbj('peak', 180, 2.0, 8),
    rbj('peak', 310, 2.5, 6),
  ]);
  const fl = S.irregular(res.length, seed + 1, 2, 7);
  return lp2(
    res.map((v, i) => v * level[i]! * (0.8 + 0.2 * fl[i]!)),
    2000,
  );
}

/** Scene 3's bolt in white: its discharge, cleaner and more focused (less crackle, no hiss on top). */
function whiteBeam(t0: number, t1: number, seed: number, points: Points): Float64Array {
  const x = plasma(t0, t1, seed, points, 1800);
  return lp2(iir(x, [rbj('hp', 200, 0.7071), rbj('peak', 350, 0.8, -4)]), 7000);
}

type Points = readonly (readonly [number, number])[];

// ---- 62.27 to 63.03: from above. The first beam's white head comes along the floor from the left
// toward her; a glint grows at her staff (62.28) and flares (62.74 to 62.95); at 62.99 the beam
// reaches her in a white flash.
const HER_ABOVE: Vec3 = [0.5, 0.0, -9.0];
function beamA(m: Mix): void {
  m.part('beam4a', () => {
    const t0 = 62.27;
    const t1 = 63.04;
    const n = nsamp(t1 - t0);
    const b = whiteBeam(t0, t1, 4300, [
      [t0, 0.6],
      [62.95, 1.0],
      [63.0, 1.0],
      [t1, 0.0],
    ]);
    m.add('beam4a', fade(b, 0.01, 0.03), t0, line([-6.0, 0.0, -8.5], [-1.5, 0.0, -8.5], n), {
      target: -13,
      kind: 'm',
      sendDb: -8,
      doppler: false,
    });
    m.add('glint4a', lp2(shimmer(0.5, 4310), 9000), 62.28, [HER_ABOVE[0], 1.0, HER_ABOVE[2]], {
      target: -26,
      kind: 'i',
      sendDb: -8,
    });
    m.add('glint4b', lp2(shimmer(0.4, 4311), 9000), 62.74, [HER_ABOVE[0], 1.2, HER_ABOVE[2]], {
      target: -20,
      kind: 'i',
      sendDb: -8,
    });
    // the beam reaches her: scene 3's strike, and the size of a large hit
    const [c, th] = strike(4320, 1.4, 0.15);
    m.add('beam4a-hit', c, 62.992, [-0.5, 0.5, -8.5], {
      target: -9,
      kind: 'i',
      focusDb: 3,
      sendDb: -8,
    });
    m.add('beam4a-thump', th, 62.992, [-0.5, 0.0, -8.5], { target: -12, kind: 'i' });
  });
}

// ---- 63.03 to 64.95: the dark hall; a glint far off where she is (63.03 to 63.24); the second beam
// shoots in on a diagonal (63.12) and blasts the rocks at 63.283; a thick beam through the rocks,
// blocks thrown up (63.3 to 63.8), the beam thinning out (63.62 to 63.81); rocks fall in front of the
// camera (64.0, 64.19); a large rock passes right by the camera (64.375); fragments fly across (64.44 to
// 64.56); the smoke rushes past (64.62 to 64.95).
function beamB(m: Mix): void {
  m.part('beam4b', () => {
    m.add('glint4c', lp2(shimmer(0.25, 4330), 9000), 63.04, [3.0, 0.5, -14.0], {
      target: -26,
      kind: 'i',
      sendDb: -6,
    });
    const [rc, rt] = strike(4340, 0.8, 0.08);
    m.add('beam4b-release', rc, 63.117, [-5.0, 3.0, -12.0], { target: -16, kind: 'i', sendDb: -8 });
    m.add('beam4b-release-thump', rt, 63.117, [-5.0, 2.0, -12.0], { target: -20, kind: 'i' });
    const t0 = 63.117;
    const t1 = 63.86;
    const n = nsamp(t1 - t0);
    const b = whiteBeam(t0, t1, 4350, [
      [t0, 0.5],
      [63.283, 1.0],
      [63.6, 0.9],
      [63.81, 0.3],
      [t1, 0.0],
    ]);
    // it comes in on the diagonal, then holds through the rocks, close
    const k = nsamp(63.283 - t0);
    m.add(
      'beam4b',
      fade(b, 0.005, 0.04),
      t0,
      concat(
        line([-5.0, 3.0, -12.0], [-0.8, 1.2, -4.0], k),
        line([-0.8, 1.2, -4.0], [0.5, 0.6, -3.5], n - k),
      ),
      { target: -11, kind: 'm', sendDb: -10, doppler: false },
    );
    // the blast on the rocks
    const [bc, bt] = strike(4360, 1.6, 0.15);
    m.add('beam4b-blast', bc, 63.283, [0.0, 0.5, -4.0], {
      target: -8,
      kind: 'i',
      focusDb: 3,
      sendDb: -8,
    });
    m.add('beam4b-blast-thump', bt, 63.283, [0.0, 0.0, -4.0], { target: -11, kind: 'i' });
    impactSize(m, 'k-blast4', 63.283, 4370, {
      hold: 0.4,
      decay: 1.0,
      db: 1,
      pos: [0.0, 0.5, -4.0],
      crack: 3.0,
    });
    // the rocks break and are thrown up, large pieces only, each its own size and side
    (
      [
        [63.31, [-1.6, 0.8, -3.5], 1.5],
        [63.45, [1.4, 0.6, -3.0], 1.1],
        [63.64, [0.4, 1.2, -4.5], 1.8],
      ] as [number, Vec3, number][]
    ).forEach(([t, pos, size], j) => {
      const c = lp2(S.heavyCrack(4380 + j, { size, dur: 0.45, kRate: 5, bright: 0.45 }), 10000);
      m.add(`block4-break${j}`, c, t, pos, { target: landing(size) - 1, kind: 'i', sendDb: -8 });
    });
    passBy(m, 'block4-up0', 63.52, 1, 1.6, 18, 1.2, 4390, 0.4, 2.0);
    passBy(m, 'block4-up1', 63.72, -1, 1.8, 16, 1.0, 4391, 0.4, 2.2);
    // the rocks that fall in front of the camera
    m.add('land4-a', fastHit(4400, 1.2, 12), 64.0, [-1.5, 0.0, -3.0], {
      target: landing(1.2),
      kind: 'i',
      focusDb: 2,
      sendDb: -8,
    });
    m.add('land4-b', fastHit(4401, 1.6, 12), 64.19, [1.5, 0.0, -2.5], {
      target: landing(1.6),
      kind: 'i',
      focusDb: 2,
      sendDb: -8,
    });
    // a large rock right by the camera, fragments across, the smoke's push
    passBy(m, 'block4-past0', 64.375, -1, 0.6, 15, 2.0, 4410, 0.45);
    passBy(m, 'block4-past1', 64.5, 1, 1.2, 18, 1.0, 4411, 0.35);
    const [pf, pl] = S.whump(4420, 0.02, 0.6);
    const push = new Float64Array(nsamp(0.6));
    addAt(push, pf, 0, 1.0);
    addAt(push, pl, 0, 0.8);
    m.add('smoke4-push', S.saturate(push, 1.4), 64.62, [0.0, 1.0, -1.5], {
      target: -18,
      kind: 'i',
    });
  });
}

// ---- 65.01 to 66.26: the sphere of hexagons (Frieren's shield), in scene 2's barrier's family: it
// blooms (65.012), its field holds, blocks strike it (65.14, 65.45, 65.83, 66.01: each a stone's
// strike absorbed into the field's ring, its own size and side), and it lets go (66.14 to 66.26).
const SHIELD: Vec3 = [-0.6, 0.8, -7.0];
function shield(m: Mix): void {
  m.part('shield4', () => {
    const t0 = 65.012;
    const t1 = 66.3;
    const fn = nsamp(t1 - t0);
    const lv = env(
      [
        [t0, 0.0],
        [t0 + 0.03, 1.0],
        [66.14, 1.0],
        [66.2, 0.0],
        [t1, 0.0],
      ],
      t0,
      fn,
    );
    m.add('shield-field', field(t1 - t0, 4500, lv), t0, SHIELD, {
      target: -17,
      kind: 'm',
      sendDb: -6,
    });
    const bl = new Float64Array(nsamp(0.4));
    addAt(bl, S.tiltedBurst(4510, 500.0, 9000.0, 0.03, { tilt: 0.4, rise: 0.004 }), 0, 1.0);
    addAt(bl, S.boom(4511, { f: 55.0, tau: 0.1, dur: 0.4 }), 0, 0.8);
    m.add('shield-on', lp2(S.saturate(bl, 1.6), 9000), t0, SHIELD, {
      target: -13,
      kind: 'i',
      sendDb: -8,
    });
    (
      [
        [65.138, -1.2, 1.2],
        [65.45, 1.0, 1.0],
        [65.825, 1.4, 1.4],
        [66.012, -0.3, 1.1],
      ] as [number, number, number][]
    ).forEach(([t, dx, size], j) => {
      const h = new Float64Array(nsamp(0.6));
      addAt(h, S.blockHit(4520 + j, size, 12.0), 0, 0.8);
      const ring = iir(S.norm(S.burst(4530 + j, 120, 600, 0.2, { rise: 0.004 })), [
        rbj('peak', 180, 2.0, 8),
        rbj('peak', 310, 2.5, 6),
      ]);
      addAt(h, ring.subarray(0, h.length), 0, 0.7);
      m.add(`shield-hit${j}`, lp2(S.norm(h), 10000), t, [SHIELD[0] + dx, 1.2, SHIELD[2]], {
        target: landing(size) - 1,
        kind: 'i',
        sendDb: -8,
      });
    });
    m.add('shield-off', lp2(shimmer(0.35, 4540), 9000), 66.14, SHIELD, {
      target: -24,
      kind: 'i',
      sendDb: -6,
    });
  });
}

// ---- 66.26 to 68.86: she stands among the blocks that keep falling (wide, then closer from 67.61):
// the low mass of large blocks (cracks of large stones, no small ones), and the landings the picture
// shows near her; Fern's line (68.86 to 71.15) stays empty.
function blocks(m: Mix): void {
  m.part('blocks4', () => {
    const rb = S.rubble(2.6, 4600, (t) => 4.0 * Math.exp(-t / 2.0), {
      sizes: [0.6, 1.5],
      bright: 0.2,
      body: 0.8,
    });
    m.add('block4-mass', lp2(fade(rb, 0.05, 0.4), 8000), 66.26, [0.0, 1.0, -8.0], {
      target: -23,
      kind: 'm',
      sendDb: -6,
    });
    (
      [
        [66.62, [-3.0, 0.0, -8.0], 1.2],
        [67.05, [2.5, 0.0, -7.0], 1.0],
        [67.45, [-1.0, 0.0, -9.0], 1.4],
        [67.92, [-2.0, 0.0, -4.0], 1.0],
        [68.3, [2.5, 0.0, -4.5], 1.6],
      ] as [number, Vec3, number][]
    ).forEach(([t, pos, size], j) =>
      m.add(`land4-${j}`, fastHit(4610 + j, size, 10), t, pos, {
        target: landing(size) - 2,
        kind: 'i',
        focusDb: 2,
        sendDb: -6,
      }),
    );
  });
}

// ---- 71.15 to 74.12: a knot of crackling light drifts across the hall (71.2 to 72.1) and shoots off
// as a streak (71.95); in the wide shot two flame streaks pass the camera (72.22, 72.33); sparks strike
// near the golem (72.45, 72.75); the golem is struck and dark chunks burst from it (73.02); chunks fly
// to the camera (73.62, 73.85); a last streak passes (74.0).
const GOLEM: Vec3 = [0.5, 1.5, -12.0];
function attack(m: Mix): void {
  m.part('attack4', () => {
    const kd = 0.95;
    const kn = nsamp(kd);
    const kw = S.levelWalk(kn, 4701, 3.0, 2.0, 8.0);
    const knot = arcCrackle(
      kd,
      4700,
      new Float64Array(kn).map((_, i) => Math.min(1, 0.45 * kw[i]!)),
    );
    m.add('knot4', fade(knot, 0.05, 0.08), 71.17, line([3.0, 3.0, -8.0], [-2.0, 3.0, -8.0], kn), {
      target: -21,
      kind: 'm',
      sendDb: -8,
      doppler: false,
    });
    const st = huuk(0.35, 4710, 28, 0.6, 0.3);
    m.add('streak4a', st, 71.95, line([0.0, 3.0, -8.0], [-6.0, 3.0, -9.0], st.length), {
      target: -18,
      kind: 'i',
      sendDb: -8,
      doppler: false,
    });
    passBy(m, 'streak4b', 72.22, -1, 1.2, 30, 1.0, 4720, 0.35, 1.6);
    passBy(m, 'streak4c', 72.33, 1, 1.6, 28, 0.9, 4721, 0.35, 1.8);
    [72.45, 72.75].forEach((t, j) => {
      const [c, th] = strike(4730 + 10 * j, 0.5, 0.06);
      m.add(`spark4-${j}`, c, t, [GOLEM[0] + (j ? 1.0 : -0.8), 2.5, GOLEM[2]], {
        target: -21,
        kind: 'i',
        sendDb: -4,
      });
      m.add(`spark4-${j}-thump`, th, t, GOLEM, { target: -25, kind: 'i' });
    });
    m.add('golem4-hit', fastHit(4750, 1.3, 14), 73.02, GOLEM, {
      target: landing(1.3) - 3,
      kind: 'i',
      focusDb: 2,
      sendDb: -4,
    });
    m.add(
      'golem4-crack',
      lp2(S.heavyCrack(4751, { size: 2.0, dur: 0.5, kRate: 6, bright: 0.4 }), 10000),
      73.03,
      GOLEM,
      { target: landing(1.3) - 5, kind: 'i', sendDb: -4 },
    );
    passBy(m, 'chunk4-0', 73.62, 1, 1.2, 16, 1.0, 4760, 0.4);
    passBy(m, 'chunk4-1', 73.85, -1, 1.0, 18, 0.8, 4761, 0.4);
    passBy(m, 'streak4d', 74.0, 1, 1.5, 26, 0.7, 4762, 0.3, 1.6);
  });
}

// ---- 74.10 to 82.26: the blocks float round Frieren, held by her magic: scene 2's field, low and
// slow, one source across the three close shots, receding under the spoken lines, fading out with the
// picture; her hair in the wind, low; the staff swung up into the frame (75.10 to 75.45).
function float(m: Mix): void {
  m.part('float4', () => {
    const t0 = 74.1;
    const t1 = 82.26;
    const n = nsamp(t1 - t0);
    const lv = env(
      [
        [t0, 0.0],
        [74.4, 1.0],
        [76.8, 1.0],
        [77.2, 0.45],
        [79.3, 0.45],
        [81.5, 0.25],
        [t1, 0.0],
      ],
      t0,
      n,
    );
    m.add('float4-field', fade(field(t1 - t0, 4800, lv), 0.2, 0.2), t0, [0.0, 1.2, -3.0], {
      target: -29,
      kind: 'm',
      sendDb: -6,
    });
    const hw = S.wind(76.85 - 74.1, 4810, 600, 5000).map((c) => lp2(c, 7000)) as Stereo;
    hw[1] = hw[1].map((v, i) => 0.4 * v + 0.6 * hw[0][i]!);
    const he = env(
      [
        [74.1, 0.0],
        [74.3, 1.0],
        [76.6, 0.9],
        [76.85, 0.0],
      ],
      74.1,
      hw[0].length,
    );
    m.addWide(
      'hair4-wind',
      [hw[0].map((v, i) => v * he[i]!), hw[1].map((v, i) => v * he[i]!)] as Stereo,
      74.1,
      { target: -31, kind: 'm' },
    );
    passBy(m, 'staff4-swing', 75.3, -1, 1.0, 8, 0.4, 4820, 0.4, 1.3);
  });
}

/**
 * The presence pass (`src/study/presence.ts`) on this scene's main events, and the bolder pass's level
 * for the continuous layers (scene 3's list, so the overlap with it stays exact, and this scene's
 * hall and hair wind).
 */
const MAIN4 = /^(beam4|k-blast4|block4-|shield-(field|hit|on)|land4-|golem4-|float4-field)/;
const CONT4 =
  /^(bed|hole-roar|hole-inrush|hole-pressure|draw|far-draw|dark-draw|orbit|swirl|fly-air|flight-air|approach-air|orb-flight|dust-roll|dust-hiss|smoke|face-wind|hair-wind|gust|arc-hum|arc-ticks|g2-hum|settle-dust|hair4-wind)/;
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
  beamA(m);
  beamB(m);
  shield(m);
  blocks(m);
  attack(m);
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
