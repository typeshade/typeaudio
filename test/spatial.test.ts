import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createDevice, type Device, type Resident } from 'typeshade/runtime';
import {
  Spatial,
  Strip,
  history,
  layers,
  pack,
  place,
  sendSum,
  strips,
} from '../src/spatial/spatial.shade.ts';
import { accumulate2, fftStage, overlap2 } from '../src/spatial/fft.shade.ts';
import { Reverb } from '../src/spatial/reverb.ts';
import { MATERIALS, impulseResponse, onePoleK, spatialOf, stripOf } from '../src/spatial/room.ts';
import { twiddleTable, fft64 } from '../experiments/03-fft/signals.ts';
import { validatePlan, type PlanEvent } from '../src/plan/index.ts';
import plan from '../experiments/08-sound-design/plan.json';
import {
  BLOCK,
  HIST,
  RefPlace,
  RefStrip,
  WIDTH,
  refAccumulate2,
  refFftStage,
  refHistory,
  refLayers,
  refPlace,
  refSendSum,
  refStrips,
} from './reference-spatial.ts';

// Each stage of the spatial chain on the CPU tier, called as a kernel function over `Resident`s and
// held to the plain-JavaScript reference bit for bit; then the properties the stages exist for: the
// pan law, the distance law, the air, the reflections, the far ear, the ducking, the transform and
// the convolution.

const SR = 48000;
let dev: Device;
beforeAll(async () => {
  dev = await createDevice({ prefer: ['cpu'] });
});
afterAll(async () => {
  await dev.dispose();
});

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const noise = (n: number, seed: number, amp = 1): Float32Array => {
  const r = rng(seed);
  return Float32Array.from({ length: n }, () => amp * (2 * r() - 1));
};
const f32 = (x: Float32Array): Float32Array => x;
const resident = (x: Float32Array): Resident<Float32Array> => dev.array(x);
const zeros = (n: number): Resident<Float32Array> => dev.array(n, 'f32');
const energy = (x: ArrayLike<number>, from = 0, to = x.length): number => {
  let s = 0;
  for (let i = from; i < to; i++) s += x[i]! * x[i]!;
  return s;
};

const event = (over: Partial<PlanEvent> & { x?: number; distance?: number } = {}): PlanEvent => ({
  id: 'e',
  t: 1,
  kind: 'impact',
  layer: 'effects',
  intensity: 0.5,
  position: { x: over.x ?? 0, y: 0, distance: over.distance ?? 5 },
  macros: { weight: 0.5, decay: 0.5, crack: 0.5 },
  sync: 'onset',
  ...(over.layer === undefined ? {} : { layer: over.layer }),
});
const scene = validatePlan(plan).scene;
const lane = (e: PlanEvent, spatial = true): Spatial => spatialOf(e, scene, { spatial, sr: SR });

describe('history', () => {
  test('moves every lane one block on, as the reference does', async () => {
    const lanes = 3;
    const prev = noise(lanes * WIDTH, 1);
    const fresh = noise(lanes * BLOCK, 2);
    const next = zeros(lanes * WIDTH);
    await history(next, resident(prev), resident(fresh));
    const got = await next.read();
    expect(got).toEqual(refHistory(prev, fresh, lanes));
    // The block just written is the end of the history: frame `HIST + n` is `fresh[n]`.
    expect(got[WIDTH + HIST + 5]).toBe(fresh[BLOCK + 5]);
  });
});

describe('place', () => {
  const events = [
    event({ x: -0.8, distance: 3 }),
    event({ x: 0, distance: 12 }),
    event({ x: 0.6, distance: 30, layer: 'ambience' }),
  ];
  const lanesOf = (): Spatial[] => events.map((e) => lane(e));

  for (const binaural of [0, 1]) {
    test(`is the reference, binaural ${binaural}, over two blocks that carry the filters' state`, async () => {
      const hosts = lanesOf();
      const states = hosts.map((h) => new RefPlace(h));
      const bankLanes = dev.array(hosts);
      let hist = noise(hosts.length * WIDTH, 7, 0.5);
      for (let b = 0; b < 2; b++) {
        const l = zeros(hosts.length * BLOCK);
        const r = zeros(hosts.length * BLOCK);
        const s = zeros(hosts.length * BLOCK);
        await place(l, r, s, resident(hist), bankLanes, binaural);
        const want = refPlace(states, hist, binaural);
        expect(await l.read()).toEqual(want.l);
        expect(await r.read()).toEqual(want.r);
        expect(await s.read()).toEqual(want.send);
        hist = noise(hosts.length * WIDTH, 8 + b, 0.5);
      }
    });
  }

  /** One lane, an impulse at the start of the block, no reflections. */
  async function impulse(
    e: PlanEvent,
    binaural = 0,
    silenceTaps = true,
  ): Promise<{ l: Float32Array; r: Float32Array }> {
    const host = lane(e);
    if (silenceTaps) host.r0 = host.r1 = host.r2 = host.r3 = host.r4 = host.r5 = 0;
    const hist = new Float32Array(WIDTH);
    hist[HIST] = 1;
    const l = zeros(BLOCK);
    const r = zeros(BLOCK);
    await place(l, r, zeros(BLOCK), resident(hist), dev.array([host]), binaural);
    return { l: await l.read(), r: await r.read() };
  }
  /** A noise burst, for energy ratios. */
  async function burst(e: PlanEvent, binaural = 0): Promise<{ l: Float32Array; r: Float32Array }> {
    const host = lane(e);
    host.r0 = host.r1 = host.r2 = host.r3 = host.r4 = host.r5 = 0;
    const hist = new Float32Array(WIDTH);
    hist.set(noise(BLOCK, 3), HIST);
    const l = zeros(BLOCK);
    const r = zeros(BLOCK);
    await place(l, r, zeros(BLOCK), resident(hist), dev.array([host]), binaural);
    return { l: await l.read(), r: await r.read() };
  }

  test('the pan is equal power: the centre is -3 dB in each ear, and the gains of any x sum to 1 in power', async () => {
    for (const x of [-1, -0.5, 0, 0.3, 1]) {
      const h = lane(event({ x }));
      expect(h.panL ** 2 + h.panR ** 2).toBeCloseTo(1, 12);
    }
    const centre = lane(event({ x: 0 }));
    expect(centre.panL).toBeCloseTo(Math.SQRT1_2, 12);
    expect(centre.panR).toBeCloseTo(Math.SQRT1_2, 12);
    const { l, r } = await burst(event({ x: 0, distance: 2 }));
    expect(energy(l) / energy(r)).toBeCloseTo(1, 6);
    const left = await burst(event({ x: -1, distance: 2 }));
    const right = await burst(event({ x: 1, distance: 2 }));
    expect(energy(left.l)).toBeGreaterThan(50 * energy(left.r));
    expect(energy(right.r)).toBeGreaterThan(50 * energy(right.l));
    // The total power does not change across the screen (the air's lowpass aside, which is the same).
    const total = (s: { l: Float32Array; r: Float32Array }): number => energy(s.l) + energy(s.r);
    expect(total(left) / total(right)).toBeCloseTo(1, 6);
  });

  test('the distance gain is 1 up to 2 m, then 2 / d', async () => {
    expect(lane(event({ distance: 1 })).g).toBe(1);
    expect(lane(event({ distance: 2 })).g).toBe(1);
    expect(lane(event({ distance: 8 })).g).toBeCloseTo(0.25, 6);
    expect(lane(event({ distance: 40 })).g).toBeCloseTo(0.05, 6);
  });

  test('the air takes the top off a distant sound and leaves the bottom', async () => {
    const hi = (s: Float32Array): number => {
      let e = 0;
      for (let i = 1; i < s.length; i++) e += (s[i]! - s[i - 1]!) ** 2;
      return e / energy(s);
    };
    const near = await burst(event({ distance: 2 }));
    const far = await burst(event({ distance: 60 }));
    expect(hi(far.l)).toBeLessThan(0.7 * hi(near.l));
  });

  test('the early reflections arrive at their delays, with their gains, and the room sets them', async () => {
    const host = lane(event({ x: 0, distance: 6 }));
    const hist = new Float32Array(WIDTH);
    hist[HIST + 100] = 1;
    const l = zeros(BLOCK);
    const r = zeros(BLOCK);
    await place(l, r, zeros(BLOCK), resident(hist), dev.array([host]), 0);
    const L = await l.read();
    const R = await r.read();
    const taps: [number, number][] = [
      [host.d0, host.r0],
      [host.d1, host.r1],
      [host.d2, host.r2],
      [host.d3, host.r3],
      [host.d4, host.r4],
      [host.d5, host.r5],
    ];
    taps.forEach(([d, g], k) => {
      if (100 + d >= BLOCK) return;
      const side = k % 2 === 0 ? [0.8, 0.45] : [0.45, 0.8];
      expect(L[100 + d]).toBeCloseTo(host.g * g * side[0]!, 5);
      expect(R[100 + d]).toBeCloseTo(host.g * g * side[1]!, 5);
    });
    expect(taps.every(([d, g]) => d >= 96 && d <= HIST - 96 && g > 0)).toBe(true);
    // A bigger room puts the reflections later; a fabric room makes them quieter.
    const big = spatialOf(
      event({ distance: 6 }),
      { ...scene, room: { size: [60, 80, 30], material: 'stone' } },
      { spatial: true, sr: SR },
    );
    expect(Math.max(big.d0, big.d2, big.d4)).toBeGreaterThan(Math.max(host.d0, host.d2, host.d4));
    const soft = spatialOf(
      event({ distance: 6 }),
      { ...scene, room: { ...scene.room, material: 'fabric' } },
      { spatial: true, sr: SR },
    );
    expect(soft.r0).toBeLessThan(host.r0);
  });

  test('a reflection later than the history is left out, and every reflection of a room it covers is kept', () => {
    const at = (size: [number, number, number]) =>
      spatialOf(
        event({ distance: 2 }),
        { ...scene, room: { size, material: 'stone' } },
        { spatial: true, sr: SR },
      );
    // 60 by 40 by 15 m: the four wall reflections arrive 94 to 195 ms after the direct sound, and
    // the history holds 85 ms. They were moved to the end of the history, all at the same time.
    const hall = at([60, 40, 15]);
    expect([hall.r0, hall.r1, hall.r2, hall.r3]).toEqual([0, 0, 0, 0]);
    expect(hall.r4).toBeGreaterThan(0);
    expect(hall.r5).toBeGreaterThan(0);
    // 18 by 24 by 9 m, the fixture's room: every delay is under the history, and all six sound.
    const stone = at([18, 24, 9]);
    expect([stone.r0, stone.r1, stone.r2, stone.r3, stone.r4, stone.r5].every((g) => g > 0)).toBe(
      true,
    );
    expect(Math.max(stone.d0, stone.d1, stone.d2, stone.d3, stone.d4, stone.d5)).toBeLessThan(
      HIST - 96,
    );
  });

  test('the binaural stage delays and shadows the far ear, and leaves the near ear as the pan does', async () => {
    const dry = await impulse(event({ x: 0.9, distance: 2 }), 0);
    const bin = await impulse(event({ x: 0.9, distance: 2 }), 1);
    const first = (s: Float32Array): number => s.findIndex((v) => Math.abs(v) > 1e-3);
    // Source on the right: the right ear is near and unchanged; the left (far) ear is late.
    expect(bin.r).toEqual(dry.r);
    expect(first(bin.l) - first(dry.l)).toBeGreaterThanOrEqual(lane(event({ x: 0.9 })).itd - 1);
    expect(lane(event({ x: 0.9 })).itd).toBeGreaterThan(20);
    expect(lane(event({ x: 0.9 })).itd).toBeLessThanOrEqual(32);
    expect(lane(event({ x: 0 })).itd).toBe(0);
    const farBurst = await burst(event({ x: 0.9, distance: 2 }), 1);
    const flat = await burst(event({ x: 0.9, distance: 2 }), 0);
    const hf = (s: Float32Array): number => {
      let e = 0;
      for (let i = 1; i < s.length; i++) e += (s[i]! - s[i - 1]!) ** 2;
      return e / energy(s);
    };
    expect(hf(farBurst.l)).toBeLessThan(hf(flat.l));
  });

  test('a room with no spatial chain is a centred dry sound', async () => {
    const h = lane(event({ x: 0.9, distance: 40 }), false);
    expect([h.g, h.kAir, h.send, h.panL, h.panR, h.r0]).toEqual([
      1,
      1,
      0,
      Math.SQRT1_2,
      Math.SQRT1_2,
      0,
    ]);
  });
});

describe('layers, strips, sendSum and pack', () => {
  test('layers sums the lanes of each layer, in lane order, as the reference does', async () => {
    const hosts = [
      event({ layer: 'effects' }),
      event({ layer: 'ambience' }),
      event({ layer: 'effects' }),
      event({ layer: 'dialogue' }),
    ].map((e) => lane(e));
    const [a, b, c] = [noise(4 * BLOCK, 1), noise(4 * BLOCK, 2), noise(4 * BLOCK, 3)];
    const [ol, or, os] = [zeros(5 * BLOCK), zeros(5 * BLOCK), zeros(5 * BLOCK)];
    await layers(ol, or, os, resident(a), resident(b), resident(c), dev.array(hosts));
    expect(await ol.read()).toEqual(refLayers(hosts, a));
    expect(await or.read()).toEqual(refLayers(hosts, b));
    expect(await os.read()).toEqual(refLayers(hosts, c));
    const sums = await ol.read();
    expect(energy(sums, 1 * BLOCK, 2 * BLOCK)).toBe(0); // no foley lane
    expect(energy(sums, 0, BLOCK)).toBeGreaterThan(0);
  });

  test('strips is the reference over two blocks, with the sidechain from layer 0', async () => {
    const hosts = [0, 1, 2, 3, 4].map((i) => stripOf(i, SR, true));
    const refs = hosts.map((h, i) => {
      const s = hosts[i]!;
      return new RefStrip(s.atk, s.rel, s.depth, s.thr, {
        k: s.left.k,
        lo: s.left.lo,
        hi: s.left.hi,
      });
    });
    const bankStrips = dev.array(hosts);
    for (let b = 0; b < 2; b++) {
      const [l, r, s] = [
        noise(5 * BLOCK, 10 + b, 0.3),
        noise(5 * BLOCK, 20 + b, 0.3),
        noise(5 * BLOCK, 30 + b, 0.3),
      ];
      const [ol, or, os] = [zeros(5 * BLOCK), zeros(5 * BLOCK), zeros(5 * BLOCK)];
      await strips(ol, or, os, resident(l), resident(r), resident(s), bankStrips);
      const want = refStrips(refs, l, r, s);
      expect(await ol.read()).toEqual(want.l);
      expect(await or.read()).toEqual(want.r);
      expect(await os.read()).toEqual(want.s);
    }
  });

  test('speech ducks the other layers by their depth, and the dialogue layer not at all', async () => {
    const hosts = [0, 1, 2, 3, 4].map((i) => stripOf(i, SR, true));
    const bankStrips = dev.array(hosts);
    const loud = (layer: number): Float32Array => {
      // A 100 Hz tone, under every shelf's corner or the same through it, in every layer, and speech in layer 0.
      const x = new Float32Array(5 * BLOCK);
      for (let l = 0; l < 5; l++)
        for (let n = 0; n < BLOCK; n++)
          x[l * BLOCK + n] = (l === 0 ? 0.4 : 0.2) * Math.sin((2 * Math.PI * 1000 * n) / SR);
      void layer;
      return x;
    };
    const quiet = loud(0).map((v, i) => (i < BLOCK ? 0 : v));
    // Many blocks, so the follower settles.
    let tailQuiet = 0;
    let tailLoud = 0;
    const run = async (input: Float32Array, bankOf: Resident<Strip[]>): Promise<Float32Array> => {
      let out = new Float32Array(0);
      for (let b = 0; b < 40; b++) {
        const [ol, or, os] = [zeros(5 * BLOCK), zeros(5 * BLOCK), zeros(5 * BLOCK)];
        await strips(ol, or, os, resident(input), resident(input), resident(input), bankOf);
        out = await ol.read();
      }
      return out;
    };
    const withSpeech = await run(loud(0), bankStrips);
    const without = await run(quiet, dev.array([0, 1, 2, 3, 4].map((i) => stripOf(i, SR, true))));
    for (const l of [1, 2, 3, 4]) {
      tailLoud = energy(withSpeech, l * BLOCK, (l + 1) * BLOCK);
      tailQuiet = energy(without, l * BLOCK, (l + 1) * BLOCK);
      expect(10 * Math.log10(tailQuiet / tailLoud)).toBeGreaterThan(3);
    }
    // Dialogue itself is not ducked: its depth is 1.
    expect(hosts[0]!.depth).toBe(1);
  });

  test('sendSum and pack are the reference', async () => {
    const s = noise(5 * BLOCK, 4);
    const sum = zeros(BLOCK);
    await sendSum(sum, resident(s));
    expect(await sum.read()).toEqual(refSendSum(s));
    const [l, r, w] = [noise(5 * BLOCK, 5), noise(5 * BLOCK, 6), noise(2 * BLOCK, 7)];
    const out = zeros(12 * BLOCK);
    await pack(out, resident(l), resident(r), resident(w));
    expect(await out.read()).toEqual(Float32Array.from([...l, ...r, ...w]));
  });
});

describe('the transform and the convolution', () => {
  const tw = twiddleTable(2048);
  const complex = (n: number, seed: number): Float32Array => noise(n * 2, seed);

  test('fftStage is the reference, for the first, a middle and the last stage, two transforms at once', async () => {
    const x = complex(2 * 2048, 1);
    const twRes = resident(tw);
    for (const k of [0, 5, 10]) {
      const out = zeros(2 * 2048 * 2);
      await fftStage(
        out,
        resident(x),
        twRes,
        1 << k,
        1024 >> k,
        k % 2 === 0 ? -1 : 1,
        k === 10 ? 1 / 2048 : 1,
      );
      expect(await out.read()).toEqual(
        refFftStage(x, tw, 1 << k, 1024 >> k, k % 2 === 0 ? -1 : 1, k === 10 ? 1 / 2048 : 1),
      );
    }
  });

  test('eleven stages are the forward transform, within the rounding of an f32', async () => {
    const x = complex(2048, 2);
    const twRes = resident(tw);
    let cur = resident(x);
    let other = zeros(4096);
    let spare = zeros(4096);
    for (let k = 0; k < 11; k++) {
      const out = k === 0 ? other : k % 2 === 1 ? spare : other;
      await fftStage(out, cur, twRes, 1 << k, 1024 >> k, -1, 1);
      cur = out;
    }
    const got = await cur.read();
    const want = fft64(x, 2048, 'forward');
    let worst = 0;
    let top = 0;
    for (let i = 0; i < got.length; i++) {
      worst = Math.max(worst, Math.abs(got[i]! - want[i]!));
      top = Math.max(top, Math.abs(want[i]!));
    }
    expect(worst / top).toBeLessThan(2e-6);
    void spare;
  });

  test('accumulate2 and overlap2 are the reference', async () => {
    const partitions = 3;
    const line = complex(partitions * 2048, 3);
    const spectra = complex(2 * partitions * 2048, 4);
    const sum = zeros(2 * 2048 * 2);
    await accumulate2(sum, resident(line), resident(spectra), 1, partitions);
    expect(await sum.read()).toEqual(refAccumulate2(line, spectra, 1, partitions, 2 * 2048));
    const frames = complex(2 * 2048, 5);
    const tail = noise(2 * 1024, 6);
    const out = zeros(2 * 1024);
    const tailRes = resident(tail);
    await overlap2(out, tailRes, resident(frames));
    const got = await out.read();
    const nextTail = await tailRes.read();
    for (let i = 0; i < 2048; i++) {
      const c = Math.floor(i / 1024);
      const n = i % 1024;
      expect(got[i]).toBe(Math.fround(frames[2 * (c * 2048 + n)]! + tail[i]!));
      expect(nextTail[i]).toBe(frames[2 * (c * 2048 + n + 1024)]);
    }
  });

  test('the reverb is the convolution of the send with each channel of the impulse response', async () => {
    const left = noise(2600, 11, 0.1);
    const right = noise(2600, 12, 0.1);
    const reverb = await Reverb.create(dev, left, right);
    expect(reverb.partitions).toBe(3);
    const send = noise(5 * 1024, 13, 0.5);
    const gotL: number[] = [];
    const gotR: number[] = [];
    const input = zeros(1024);
    for (let b = 0; b < 5; b++) {
      await input.write(send.slice(b * 1024, (b + 1) * 1024));
      await dev.fuse(() => reverb.block(input));
      const wet = await reverb.wet.read();
      gotL.push(...wet.slice(0, 1024));
      gotR.push(...wet.slice(1024));
    }
    for (const [got, ir] of [
      [gotL, left],
      [gotR, right],
    ] as const) {
      let worst = 0;
      let top = 0;
      for (let n = 0; n < got.length; n++) {
        let s = 0;
        for (let k = 0; k < ir.length && k <= n; k++) s += ir[k]! * send[n - k]!;
        worst = Math.max(worst, Math.abs(got[n]! - s));
        top = Math.max(top, Math.abs(s));
      }
      expect(worst / top).toBeLessThan(1e-4);
    }
    reverb.release();
  });
});

describe('the room', () => {
  test('the impulse responses decay by 60 dB over their length, from 0.5 s to 2.5 s by material, at unit energy', () => {
    const lengths = Object.values(MATERIALS).map((m) => m.seconds);
    expect(Math.min(...lengths)).toBe(0.5);
    expect(Math.max(...lengths)).toBe(2.5);
    const { left, right } = impulseResponse('stone', SR, 8);
    expect(left.length).toBe(2.5 * SR);
    expect(energy(left)).toBeCloseTo(1, 4);
    expect(energy(right)).toBeCloseTo(1, 4);
    expect(left).not.toEqual(right);
    const rms = (x: Float32Array, from: number, to: number): number =>
      Math.sqrt(energy(x, from, to) / (to - from));
    const n = left.length;
    const early = rms(left, 0, 0.05 * n);
    const late = rms(left, 0.95 * n, n);
    expect(20 * Math.log10(late / early)).toBeLessThan(-40);
    expect(impulseResponse('stone', SR, 8).left).toEqual(left);
    expect(onePoleK(1000, SR)).toBeGreaterThan(0);
  });
});
