// The red passage as scene 1 holds it, and the stones of the owner's reviews of scene 1: the study's
// red passage (`red.ts`, unchanged) less what the owner's rule cuts, with the stones that replace
// them; the tear of a stone through the air and the strike of a fast stone. Its own file, so that
// scene 2 (experiment 13) starts from the same layers without scene 1's other parts.

import { SR, addAt, fade, lp, nsamp, rng, zeros, type Vec3 } from '../../src/study/dsp.ts';
import type { Mix } from '../../src/study/mix.ts';
import { concat, line, steady } from '../../src/study/passage.ts';
import * as S from '../../src/study/sources.ts';
import { redLayers } from './red.ts';

// ---- The owner's rule, 2026-11-11: a sound earns its place by its part in the moment; small detail
// of little weight that nobody would miss is cut ("this matters especially in animation"). In
// scene 1 that removed `far-debris`, `pebbles` and `leap-debris`, the trickle of 1 to 3 cm pieces
// after the stone that bursts toward the camera (21.98 s), the stones under 0.3 m that fall behind
// the ice, and the patter of small debris under the smoke. The red passage (`red.ts`) stays the
// study's; these parts replace its layers in the scene, and `cutSmall` leaves the originals out.

/** The stone that bursts toward the camera at 21.98 s: its 35 cm stone and its crack, no trickle. */
function burstStone(m: Mix): void {
  m.part('rock-burst-stone', () => {
    const rb = zeros(nsamp(0.9));
    addAt(rb, S.stoneImpact(0.35, Math.sqrt(2 * 9.81 * 1.5), rng(124)), 0);
    const n = S.norm(rb);
    addAt(n, S.heavyCrack(126, { size: 0.7, dur: 0.4, kRate: 8 }).subarray(0, n.length), 0, 0.9);
    // review 6: it bursts toward us fast (25 m/s): a loud hard strike, and it tears the air past us
    m.add('rock-burst-stone', lp(S.saturate(n, 1.5), 12000), 21.98, [-0.8, 1.2, -1.5], {
      target: Math.round(hitDb(0.35, 25)),
      kind: 'i',
      sendDb: -6,
    });
    passBy(m, 'rock-burst-huuk', 22.1, -1, 1.0, 25, 0.35, 3150, 0.3);
  });
}

/**
 * 26.7 to 28.7 s: behind the ice, stone comes down from the walls. The owner's rule on small stones
 * that roll (2026-11-11): no tumble of stones; three large blocks land far off, one after another,
 * with the accepted landing's body and crack and no scatter.
 */
function wallStones(m: Mix): void {
  m.part('wall-stones', () => {
    (
      [
        [27.05, [-7.5, 0.0, -9.0], 0.9],
        [27.62, [7.0, 0.0, -11.0], 1.1],
        [28.3, [-6.0, 0.0, -12.0], 0.8],
      ] as [number, Vec3, number][]
    ).forEach(([t, pos, size], i) =>
      m.add(`wall-stones${i}`, lp(S.slabFall(572 + i, size, 0.8, 0), 9000), t, pos, {
        target: landing(size) - 4,
        kind: 'i',
        focusDb: 3,
      }),
    );
  });
}

/** Leaves out the red passage's layers that the rule cuts or that `burstStone` and `wallStones` replace. */
function cutSmall(m: Mix): void {
  for (const name of [
    'rock-burst',
    'wall-debris0',
    'wall-debris1',
    'debris-rain0',
    'debris-rain1',
  ]) {
    m.layers.delete(name);
    for (let i = m.order.length - 1; i >= 0; i--) if (m.order[i] === name) m.order.splice(i, 1);
  }
}

// ---- Review 6, 2026-11-11 (render r6). The owner: stones that fly out should go "huuk": they
// move fast, so the air tears; and when they strike the floor it should be loud, because they are
// fast. Every stone that flies past the camera now tears the air (`huuk`, in place of the steady
// band of noise that read as wind), and every stone that strikes lands with the accepted landing's
// timbre, louder with its speed (`fastHit`). Around 13 s the black hole leads again; around 21 s
// the sparks the orb strikes from the rock are a spray that is heard.

/** The level of a stone that lands, from the accepted landing (a slab of 1.6 m at -11 LUFS), lower by its size. */
export const landing = (size: number) => -11 + 10 * Math.log10(size / 1.6);

/**
 * The level of a fast stone that strikes: the landing of its size, up by its speed against the
 * accepted landing's (about 8 m/s), down by its distance beyond the accepted landing's 6 m.
 */
export const hitDb = (size: number, v: number, dist = 6) =>
  landing(size) + 10 * Math.log10(v / 8) - 10 * Math.log10(Math.max(dist, 6) / 6);

/** The level of a stone's tear through the air: up by its speed and its size. */
export const huukDb = (speed: number, size: number) =>
  -13 + 10 * Math.log10(speed / 25) + 5 * Math.log10(size / 0.5);

/**
 * A stone that tears through the air ("huuk"): the air noise of its speed (`aero`: brighter and
 * louder as it is faster), torn by an irregular grain, with a low body for its size. It swells as
 * it comes, peaks `pk` of the way through, and is cut off fast as it goes. Its pitch moves only by
 * the Doppler of its path; nothing glides. Two low-pass sections at 9 kHz.
 */
export function huuk(
  dur: number,
  seed: number,
  speed: number,
  size: number,
  pk = 0.62,
): Float64Array {
  const n = nsamp(dur);
  const air = S.norm(S.aero(new Float64Array(n).fill(speed), seed, 10.0, 180.0, 250.0, 8500.0));
  const tear = S.irregular(n, seed + 1, 25.0, 120.0);
  const body = S.norm(steady(dur, seed + 2, 50.0, 260.0 / Math.max(size, 0.3) ** 0.5));
  const tp = pk * dur;
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = t < tp ? (t / tp) ** 3 : Math.exp(-(t - tp) / 0.045);
    y[i] = e * (air[i]! * (0.7 + 0.3 * tear[i]!) + 0.5 * Math.min(size, 1.5) * body[i]!);
  }
  return fade(lp(lp(y, 9000), 9000), 0.002, 0.01);
}

/**
 * A stone that passes the camera: its tear on a straight path at `speed` m/s that comes closest,
 * `near` m to one side, at second `t`.
 */
export function passBy(
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
    line([side * near * 0.6, height, -speed * pk * dur], [side * near, height, 0.0], k),
    line(
      [side * near, height, 0.0],
      [side * (near + 0.6), height, speed * (1 - pk) * dur],
      src.length - k,
    ),
  );
  m.add(name, src, t - pk * dur, P, {
    target: huukDb(speed, size),
    kind: 'i',
    sendDb: -12,
  });
}

/**
 * A fast stone that strikes: the accepted landing's timbre (a slab's thud and crack, `slabFall`)
 * with the clack and tick of its speed (`stoneImpact`), driven a little so its front is hard.
 */
export function fastHit(seed: number, size: number, v: number): Float64Array {
  const slab = S.slabFall(seed, size, 0.8, 0);
  const k = S.norm(S.stoneImpact(size, v, rng(seed + 1)));
  const y = zeros(Math.max(slab.length, k.length));
  addAt(y, slab, 0, 1.0);
  addAt(y, k, 0, 0.7);
  return lp(S.saturate(S.norm(y), 1.5), 12000);
}

/** 20.15 to 22.08 s: the rocks that pass the camera with the orb tear the air (in place of `rock-pass`). */
function rockHuuk(m: Mix): void {
  m.part('rock-huuk', () => {
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
  m.part('spark-spray', () => {
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
        addAt(y, S.sizzle(dur, seed + 1, 0.13, 7000.0, 1800.0, 11000.0), 0, 0.9);
        addAt(y, S.burst(seed + 2, 3000.0, 10000.0, 0.12, { dur, rise: 0.003 }), 0, 0.35);
        const s = lp(lp(S.saturate(S.norm(y), 1.5), 11000), 11000);
        m.add(`spark-spray${i}-${j}`, fade(s, 0.0005, 0.05), t, [side * 1.4, 1.6, -2.6], {
          target: tg - 3,
          kind: 'i',
          sendDb: -8,
        });
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
  m.part('ray-stones', () => {
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
        kind: 'i',
        focusDb: 4,
      });
      const dur = Math.min(0.3, tl - 25.8);
      const src = huuk(dur, 3300 + i, 20, size, 0.8);
      m.add(`ray-stone${i}-huuk`, src, tl - dur, line(FROM, pos, src.length), {
        target: huukDb(20, size) - 3,
        kind: 'i',
        sendDb: -8,
      });
    });
  });
}

/** Leaves out the red passage's layers that `rockHuuk` and `rayStones` replace. */
function replaceRed(m: Mix): void {
  for (const name of [
    ...Array.from({ length: 9 }, (_, i) => `rock-pass${i}`),
    ...Array.from({ length: 5 }, (_, i) => `ray-debris${i}`),
  ]) {
    m.layers.delete(name);
    for (let i = m.order.length - 1; i >= 0; i--) if (m.order[i] === name) m.order.splice(i, 1);
  }
}

/**
 * The presence pass (`src/study/presence.ts`): the main events get the body of 120 Hz to 2 kHz.
 * The hole's voice and body, the orb, every stone that strikes, lands, grinds or breaks, the shell,
 * the lock, the rays and the ice; not the air, the wind, the dust or the tears of passing stones.
 */
export const MAIN =
  /^(hole-(swallow|growl|mana|ring|core|roar|pressure)|orb-(body|voice|flight|approach|far|form)|launch|block-|leap-hit\d+$|tear-hit\d+$|drag-\d+-arrive|pile-|gather-grind|clump-grind|face-(grind|groan)|flame-(close|crumble|cracks)|shell|crack-|release|lock|ray-(hit|sear|lance|stone\d+$)|rock-burst-stone|wall-stones|spark-hit|ice-(boom|crack|crush|slab|groan)|whip|target-strike)/;
/**
 * The study's red passage as this scene holds it: its layers, less what the rule cuts, with the
 * stones that replace them. Scene 2 starts from it (experiment 13).
 */
export function redTail(m: Mix): void {
  redLayers(m, { bed: false });
  burstStone(m);
  wallStones(m);
  m.finish(cutSmall);
  rockHuuk(m);
  sparkSpray(m);
  rayStones(m);
  m.finish(replaceRed);
}
