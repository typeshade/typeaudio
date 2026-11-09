import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createDevice, type Device } from 'typeshade/runtime';
import { onePlan, renderPlan, SAMPLE_RATE, SNAP_WINDOW } from '../src/render-plan.ts';
import { integratedLoudness, truePeak, checklist } from '../src/analyze/index.ts';
import { validatePlan, type PlanEvent } from '../src/plan/index.ts';
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

  test('the one-layer plan is the same moments, every one an impact on effects', () => {
    const plan = validatePlan(fixture);
    const one = onePlan(plan);
    expect(one.events.map((e) => e.t)).toEqual(plan.events.map((e) => e.t));
    expect(new Set(one.events.map((e) => e.layer))).toEqual(new Set(['effects']));
    expect(new Set(one.events.map((e) => e.kind))).toEqual(new Set(['impact']));
    expect(() => validatePlan(one)).not.toThrow();
  });
});
