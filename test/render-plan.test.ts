import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createDevice, type Device } from 'typeshade/runtime';
import { onePlan, renderPlan, SAMPLE_RATE, SNAP_WINDOW } from '../src/render-plan.ts';
import { integratedLoudness, truePeak, checklist } from '../src/analyze/index.ts';
import { validatePlan, type PlanEvent } from '../src/plan/index.ts';
import {
  attenuationDb,
  DUCK_DB,
  DUCK_FALL,
  DUCK_LEAD,
  DUCK_RECOVER,
  duckGains,
  duckSources,
} from '../src/spatial/duck.ts';
import fixture from '../experiments/08-sound-design/plan.json';

// The layered render on the CPU tier, on small plans in a fabric room (a 0.5 s impulse response, so
// that the convolution of each block is cheap): the stems, the sync, the pan, the ducking, the
// master and the determinism. The master's limiter is held to a synthetic overshoot.

const SR = SAMPLE_RATE;
let dev: Device;
beforeAll(async () => {
  dev = await createDevice({ prefer: ['cpu'] });
});
afterAll(async () => {
  await dev.dispose();
});

const energy = (x: ArrayLike<number>, from = 0, to = x.length): number => {
  let s = 0;
  for (let i = from; i < to; i++) s += x[i]! * x[i]!;
  return s;
};
const at = (seconds: number): number => Math.round(seconds * SR);

const ev = (id: string, t: number, over: Partial<PlanEvent> = {}): PlanEvent => ({
  id,
  t,
  kind: 'impact',
  layer: 'effects',
  intensity: 0.8,
  position: { x: 0, y: 0, distance: 4 },
  macros: { weight: 0.5, decay: 0.2, crack: 0.5 },
  sync: 'onset',
  ...over,
});

const mini = (events: PlanEvent[], over: Record<string, unknown> = {}): unknown => ({
  version: 1,
  clip: { duration: 1.5, fps: 24 },
  scene: {
    room: { size: [6, 8, 3], material: 'fabric' },
    listener: { position: [0, 1.6, 0], yaw: 0 },
  },
  master: { lufs: -23, truePeak: -1 },
  seed: 3,
  picture: { cuts: [0.5], motion: [] },
  events,
  ...over,
});

/** A speech-like stem: a 150 Hz buzz under a slow envelope, `seconds` long. */
const speech = (seconds: number): Float32Array =>
  Float32Array.from({ length: at(seconds) }, (_, i) => {
    const t = i / SR;
    return (
      0.3 *
      Math.sin(2 * Math.PI * 3 * t) ** 2 *
      (Math.sin(2 * Math.PI * 150 * t) + 0.5 * Math.sin(2 * Math.PI * 450 * t))
    );
  });

describe('renderPlan on the CPU tier', { timeout: 120000 }, () => {
  test("refuses a plan the validator refuses, with the validator's sentence", async () => {
    await expect(renderPlan(dev, { version: 2 })).rejects.toThrow(
      'Plan: field "version" must be 1.',
    );
  });

  test('returns five stems and a mix of the clip, the mix being the stems and the reverb, summed', async () => {
    const r = await renderPlan(
      dev,
      mini([
        ev('a', 0.3),
        ev('b', 0.8, {
          layer: 'effects',
          kind: 'whoosh',
          macros: { speed: 0.5, brightness: 0.5 },
          duration: 0.4,
        }),
      ]),
    );
    expect(r.frames).toBe(at(1.5));
    expect(Object.keys(r.stems)).toEqual(['dialogue', 'foley', 'effects', 'ambience', 'music']);
    for (const l of ['dialogue', 'foley', 'ambience', 'music'] as const)
      expect(energy(r.stems[l][0])).toBe(0);
    expect(energy(r.stems.effects[0])).toBeGreaterThan(0);
    expect(r.tier).toBe('cpu');
    expect(r.reports).toHaveLength(Math.ceil(at(1.5) / 1024));
    for (let c = 0; c < 2; c++)
      for (let i = 0; i < r.frames; i += 997) {
        const sum =
          r.stems.effects[c]![i]! +
          r.stems.dialogue[c]![i]! +
          r.stems.foley[c]![i]! +
          r.stems.ambience[c]![i]! +
          r.stems.music[c]![i]!;
        expect(r.dry[c]![i]).toBeCloseTo(sum, 6);
        expect(r.mix[c]![i]).toBeCloseTo(r.dry[c]![i]! + r.wet[c]![i]!, 6);
      }
  });

  test('is the same bits when rendered twice', async () => {
    const p = mini(
      [
        ev('a', 0.3),
        ev('b', 0.7, { kind: 'shimmer', macros: { density: 0.5, height: 0.5 }, duration: 0.25 }),
      ],
      { clip: { duration: 1, fps: 24 } },
    );
    const a = await renderPlan(dev, p);
    const b = await renderPlan(dev, p);
    expect(b.mix[0]).toEqual(a.mix[0]);
    expect(b.mix[1]).toEqual(a.mix[1]);
    expect(b.stems.effects[1]).toEqual(a.stems.effects[1]);
  });

  test('an edit to one event changes that event only', async () => {
    const base = [
      ev('a', 0.3),
      ev('b', 0.9, { kind: 'riser', macros: { length: 0.5, pitch: 0.5 }, duration: 0.6 }),
    ];
    const edited = [base[0]!, { ...base[1]!, macros: { length: 0.5, pitch: 0.9 } }];
    const a = await renderPlan(dev, mini(base), { guards: false, reverb: false });
    const b = await renderPlan(dev, mini(edited), { guards: false, reverb: false });
    // Without the guards the stems are the events' sum: the frames before the edited event match.
    expect(b.stems.effects[0].slice(0, at(0.9) - 1)).toEqual(
      a.stems.effects[0].slice(0, at(0.9) - 1),
    );
    expect(b.stems.effects[0]).not.toEqual(a.stems.effects[0]);
  });

  test('an event keeps its sound when another event is added before it in the sorted list', async () => {
    // Adding "a" at t = 0.1 moves "b" from the first place of the sorted list to the second.
    const wind = ev('b', 0.3, {
      kind: 'wind',
      layer: 'ambience',
      macros: { gust: 0.6, howl: 0.5 },
      duration: 0.6,
    });
    const alone = await renderPlan(dev, mini([wind]), { guards: false, reverb: false });
    const added = await renderPlan(dev, mini([ev('a', 0.1), wind]), {
      guards: false,
      reverb: false,
    });
    expect(energy(alone.stems.ambience[0])).toBeGreaterThan(0);
    expect(added.stems.ambience[0]).toEqual(alone.stems.ambience[0]);
    expect(added.stems.ambience[1]).toEqual(alone.stems.ambience[1]);
  });

  test('a sync of arrive ends the sound at t, and an onset starts it at t', async () => {
    const r = await renderPlan(
      dev,
      mini([
        ev('arr', 1.2, {
          kind: 'whoosh',
          macros: { speed: 0.5, brightness: 0.5 },
          duration: 0.4,
          sync: 'arrive',
        }),
        ev('on', 0.3),
      ]),
      { guards: false, reverb: false },
    );
    const by = Object.fromEntries(r.placed.map((p) => [p.id, p]));
    expect(by['arr']!.end).toBe(at(1.2));
    expect(by['arr']!.end - by['arr']!.start).toBeGreaterThan(at(0.3));
    expect(by['on']!.start).toBe(at(0.3));
  });

  test('snaps an onset within the window to a cut, and leaves one outside it', async () => {
    const near = at(0.5) + at(SNAP_WINDOW / 2);
    const r = await renderPlan(dev, mini([ev('near', near / SR), ev('far', 1.0)]), {
      reverb: false,
    });
    const by = Object.fromEntries(r.placed.map((p) => [p.id, p]));
    expect(by['near']!.start).toBe(at(0.5));
    expect(by['far']!.start).toBe(at(1.0));
    const off = await renderPlan(dev, mini([ev('near', near / SR)]), {
      guards: false,
      reverb: false,
    });
    expect(off.placed[0]!.start).toBe(near);
  });

  test("puts an event on the side of its screen x, in its layer's stem, and a centred one in the middle", async () => {
    const r = await renderPlan(
      dev,
      mini([
        ev('left', 0.1, { position: { x: -0.9, y: 0, distance: 3 } }),
        ev('mid', 0.5, { position: { x: 0, y: 0, distance: 3 } }),
        ev('right', 0.9, { position: { x: 0.9, y: 0, distance: 3 } }),
      ]),
      { guards: false, reverb: false },
    );
    const side = (from: number): [number, number] => [
      energy(r.stems.effects[0], at(from), at(from + 0.4)),
      energy(r.stems.effects[1], at(from), at(from + 0.4)),
    ];
    const [ll, lr] = side(0.1);
    const [ml, mr] = side(0.5);
    const [rl, rr] = side(0.9);
    expect(ll).toBeGreaterThan(5 * lr);
    expect(rr).toBeGreaterThan(5 * rl);
    expect(ml / mr).toBeGreaterThan(0.7);
    expect(ml / mr).toBeLessThan(1.4);
  });

  test('the reverb returns after the sound has stopped, decaying, and a dry render has none', async () => {
    const p = mini([
      ev('hit', 0.2, {
        macros: { weight: 0.5, decay: 0, crack: 0.5 },
        position: { x: 0, y: 0, distance: 10 },
      }),
    ]);
    const r = await renderPlan(dev, p);
    // The impact ends 0.72 s after 0.3 s; the room rings up to 0.5 s longer. Frames just after
    // the sound hold wet and no dry.
    const end = r.placed[0]!.end;
    expect(energy(r.dry[0], end + 5000)).toBeLessThan(1e-9);
    expect(energy(r.wet[0], end + 5000)).toBeGreaterThan(1e-6);
    const dry = await renderPlan(dev, p, { spatial: false });
    expect(energy(dry.wet[0])).toBe(0);
  });

  test('speech ducks the other layers, and the stems of the other layers are lower in the speech', async () => {
    const bed = ev('bed', 0, {
      kind: 'wind',
      layer: 'ambience',
      macros: { gust: 0.3, howl: 0.3 },
      duration: 3,
      intensity: 0.6,
      position: { x: 0, y: 0, distance: 6 },
    });
    const voice = ev('v', 1, {
      kind: 'voice',
      layer: 'dialogue',
      macros: {},
      duration: 1,
      position: { x: 0, y: 0, distance: 2 },
    });
    const p = mini([bed, voice], { clip: { duration: 3, fps: 24 } });
    const withVoice = await renderPlan(dev, p, { stems: { v: speech(1) }, reverb: false });
    const without = await renderPlan(dev, p, { reverb: false });
    const during = (r: typeof withVoice): number => energy(r.stems.ambience[0], at(1.3), at(1.9));
    expect(energy(withVoice.stems.dialogue[0])).toBeGreaterThan(0);
    expect(energy(without.stems.dialogue[0])).toBe(0); // a voice with no stem is silent
    expect(10 * Math.log10(during(without) / during(withVoice))).toBeGreaterThan(3);
    const q = checklist({
      channels: withVoice.mix,
      sampleRate: SR,
      plan: validatePlan(p),
      stems: withVoice.stems,
    });
    expect(q.dynamics.measures.duckingDb).not.toBeNull();
  });

  describe('the pre-impact ducking guard (docs/sound-design-loop.md, "The guards")', () => {
    const ONSET = 3;
    const wind = ev('bed', 0, {
      kind: 'wind',
      layer: 'ambience',
      macros: { gust: 0, howl: 0 },
      duration: 4.5,
      intensity: 0.6,
      position: { x: 0, y: 0, distance: 6 },
    });
    const hit = ev('hit', ONSET, { intensity: 0.9 });
    const voice = ev('v', 2.8, {
      kind: 'voice',
      layer: 'dialogue',
      macros: {},
      duration: 0.5,
      position: { x: 0, y: 0, distance: 2 },
    });
    const plan = (events: PlanEvent[]): unknown =>
      mini(events, { clip: { duration: 4.5, fps: 24 }, picture: { cuts: [], motion: [] } });
    // The master scales every stem by one gain. `raw` takes it out, so that a render with the
    // impact and one without compare on the guard alone. The limiter stays out of these plans.
    const raw = (r: Awaited<ReturnType<typeof renderPlan>>, x: Float32Array): Float32Array => {
      expect(r.master.limiterMinDb).toBe(0);
      const k = 10 ** (-r.master.normalizeDb / 20);
      return x.map((v) => v * k);
    };
    const maxDiff = (a: Float32Array, b: Float32Array): number => {
      let m = 0;
      for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]! - b[i]!));
      return m;
    };
    const dbBetween = (a: Float32Array, b: Float32Array, from: number, to: number): number =>
      10 * Math.log10(energy(a, at(from), at(to)) / energy(b, at(from), at(to)));

    test('the ambience stem drops by 6 dB before the onset and recovers within 0.3 s after it', async () => {
      const without = await renderPlan(dev, plan([wind]), { reverb: false });
      const withHit = await renderPlan(dev, plan([wind, hit]), { reverb: false });
      const a = raw(without, without.stems.ambience[0]);
      const b = raw(withHit, withHit.stems.ambience[0]);
      // Before the fall: no change.
      expect(Math.abs(dbBetween(a, b, ONSET - 2, ONSET - 0.5))).toBeLessThan(0.1);
      // The hold: the last 0.05 s before the onset, and the onset itself, are down by 6 dB.
      expect(dbBetween(a, b, ONSET - DUCK_LEAD, ONSET)).toBeCloseTo(DUCK_DB, 1);
      // The fall: each 0.05 s step down the window 0.45 s to 0.05 s before the onset is deeper.
      let last = 0;
      for (let t = ONSET - 0.45; t < ONSET - DUCK_LEAD - 1e-9; t += 0.05) {
        const down = dbBetween(a, b, t, t + 0.05);
        expect(down).toBeGreaterThan(last - 0.01);
        expect(down).toBeLessThanOrEqual(DUCK_DB + 0.1);
        last = down;
      }
      expect(last).toBeGreaterThan(DUCK_DB - 1);
      // The recovery: down at the onset, back to 0 dB within 0.3 s.
      expect(dbBetween(a, b, ONSET, ONSET + 0.05)).toBeGreaterThan(DUCK_DB - 0.5);
      expect(Math.abs(dbBetween(a, b, ONSET + DUCK_RECOVER, ONSET + 1))).toBeLessThan(0.1);
    });

    test("the impact's own stem and a voice stem are not ducked", async () => {
      const stems = { v: speech(0.5) };
      const alone = await renderPlan(dev, plan([hit, voice]), { reverb: false, stems });
      const full = await renderPlan(dev, plan([wind, hit, voice]), { reverb: false, stems });
      // `effects` holds the impact alone, and `dialogue` the voice alone: the bed changes neither.
      // The voice sits after the onset, so the impact's recovery is not in its window.
      expect(
        maxDiff(raw(full, full.stems.effects[0]), raw(alone, alone.stems.effects[0])),
      ).toBeLessThan(1e-6);
      expect(energy(full.stems.dialogue[0])).toBeGreaterThan(0);
      // The voice sounds through the fall, the hold and the recovery: its stem is as it is without the hit.
      const noHit = await renderPlan(dev, plan([wind, voice]), { reverb: false, stems });
      const a = raw(full, full.stems.dialogue[0]);
      const b = raw(noHit, noHit.stems.dialogue[0]);
      expect(maxDiff(a, b)).toBeLessThan(1e-6);
    });

    test('the checklist reads the dip and meets its rule, and the render is the same bits twice', async () => {
      const p = plan([wind, hit]);
      const one = await renderPlan(dev, p, { reverb: false });
      const two = await renderPlan(dev, p, { reverb: false });
      expect(one.mix[0]).toEqual(two.mix[0]);
      expect(one.stems.ambience[1]).toEqual(two.stems.ambience[1]);
      const r = checklist({
        channels: one.mix,
        sampleRate: SR,
        plan: validatePlan(p),
        stems: one.stems,
      });
      const dip = r.dynamics.measures.dipDb!;
      expect(dip).toBeGreaterThan(3);
      expect(dip).toBeLessThan(DUCK_DB + 0.1);
      expect(r.dynamics.rules.find((x) => x.measure === 'dipDb')?.met).toBe(true);
    });

    test('with the guards off, nothing ducks', async () => {
      const off = await renderPlan(dev, plan([wind, hit]), { reverb: false, guards: false });
      const ref = await renderPlan(dev, plan([wind]), { reverb: false, guards: false });
      expect(off.stems.ambience[0]).toEqual(ref.stems.ambience[0]);
    });
  });

  describe('duckGains', () => {
    const plain = (id: string, over: Partial<PlanEvent>): PlanEvent => ev(id, 0, over);

    test('picks the heroes by the checklist rule, and only impacts', () => {
      const events = [
        plain('a', { intensity: 0.9 }),
        plain('b', { intensity: 0.5 }),
        plain('c', { intensity: 0.9, kind: 'whoosh', macros: { speed: 0.5, brightness: 0.5 } }),
      ];
      expect(duckSources(events, [10, 20, 30])).toEqual([{ start: 10, layer: 2 }]);
      // No event reaches 0.8: the cap at the highest intensity makes the top impact a hero.
      expect(
        duckSources([plain('a', { intensity: 0.6 }), plain('b', { intensity: 0.4 })], [1, 2]),
      ).toEqual([{ start: 1, layer: 2 }]);
    });

    test('the curve has the constants of the rule', () => {
      expect(attenuationDb(-(DUCK_LEAD + DUCK_FALL) - 0.01)).toBe(0);
      expect(attenuationDb(-DUCK_LEAD)).toBeCloseTo(DUCK_DB, 9);
      expect(attenuationDb(0)).toBeCloseTo(DUCK_DB, 9);
      expect(attenuationDb(DUCK_RECOVER)).toBe(0);
      expect(attenuationDb(DUCK_RECOVER / 2)).toBeCloseTo(DUCK_DB / 2, 9);
    });

    test('the deeper attenuation holds where two impacts overlap, and a source skips its own layer', () => {
      const start = 1024 * 50;
      const a = { start, layer: 2 };
      const b = { start: start + 4800, layer: 1 };
      const block = (sources: { start: number; layer: number }[], at: number): Float32Array => {
        const out = new Float32Array(5 * 1024);
        duckGains(out, sources, at, SAMPLE_RATE);
        return out;
      };
      // Blocks from the fall of `a` to the recovery of `b`.
      for (let at = start - 1024 * 22; at < start + 4800 + 1024 * 15; at += 1024) {
        const both = block([a, b], at);
        const onlyA = block([a], at);
        const onlyB = block([b], at);
        for (let l = 0; l < 5; l++)
          for (let n = 0; n < 1024; n++) {
            const i = l * 1024 + n;
            expect(both[i]).toBe(Math.min(onlyA[i]!, onlyB[i]!));
          }
        for (let n = 0; n < 1024; n++) expect(both[n]).toBe(1); // dialogue
        for (let n = 0; n < 1024; n++) expect(onlyA[2 * 1024 + n]).toBe(1); // a's own layer
        for (let n = 0; n < 1024; n++) expect(onlyB[1 * 1024 + n]).toBe(1); // b's own layer
      }
      // At the onset of `a`, the layers other than its own are down by `DUCK_DB`.
      const g = block([a], start - 512)[3 * 1024 + 512]!;
      expect(g).toBeCloseTo(10 ** (-DUCK_DB / 20), 6);
    });
  });

  test('the master sets the loudness and holds the true peak under the limit', async () => {
    const p = validatePlan(
      mini(
        [
          ev('a', 0.4, { intensity: 1 }),
          ev('b', 1, {
            intensity: 1,
            kind: 'wind',
            layer: 'ambience',
            macros: { gust: 0.5, howl: 0.5 },
            duration: 1,
          }),
        ],
        { clip: { duration: 2, fps: 24 } },
      ),
    );
    const r = await renderPlan(dev, p, { reverb: false });
    expect(integratedLoudness(r.mix, SR)).toBeCloseTo(p.master.lufs, 0);
    expect(truePeak(r.mix)).toBeLessThanOrEqual(p.master.truePeak);
    const raw = await renderPlan(dev, p, { guards: false, reverb: false });
    expect(Number.isNaN(raw.master.lufsBefore)).toBe(true);
    expect(r.master.lufsBefore).toBeCloseTo(integratedLoudness(raw.mix, SR) - 0, -1);
  });

  test('the one-layer plan is the same moments, one impact on effects at each', () => {
    const plan = validatePlan(fixture);
    const one = onePlan(plan);
    expect(one.events.length).toBeLessThan(plan.events.length);
    expect(new Set(one.events.map((e) => e.layer))).toEqual(new Set(['effects']));
    expect(new Set(one.events.map((e) => e.kind))).toEqual(new Set(['impact']));
    // Two events a moment apart are one moment, and a third far away is another.
    const three = {
      ...plan,
      events: [
        plan.events[0]!,
        { ...plan.events[1]!, id: 'x', t: plan.events[0]!.t + 0.05 },
        { ...plan.events[2]!, id: 'y', t: 20 },
      ],
    };
    expect(onePlan(three).events).toHaveLength(2);
    expect(() => validatePlan(one)).not.toThrow();
  });
});
