import { describe, expect, test } from 'vitest';
import { Whoosh } from '../src/kinds/whoosh.shade.ts';
import { Impact } from '../src/kinds/impact.shade.ts';
import { Shimmer } from '../src/kinds/shimmer.shade.ts';
import { Riser } from '../src/kinds/riser.shade.ts';
import { Wind } from '../src/kinds/wind.shade.ts';
import { Drone } from '../src/kinds/drone.shade.ts';
import { Footstep } from '../src/kinds/footstep.shade.ts';
import { Cloth } from '../src/kinds/cloth.shade.ts';
import { Stem } from '../src/kinds/voice.shade.ts';
import { StoneBand, Stones } from '../src/kinds/stones.shade.ts';
import { Boom } from '../src/kinds/boom.shade.ts';
import { Roar } from '../src/kinds/roar.shade.ts';
import { ImpactLane, VoiceLane } from '../src/kinds/lanes.shade.ts';
import { Svf, svfCoef } from '../src/units/svf.shade.ts';
import { Cloud, Grain } from '../src/units/grain.shade.ts';
import {
  eventKey,
  KIND_PEAK,
  makeLane,
  ROAR_BANDS,
  STONE_BANDS,
  type Made,
} from '../src/kinds/make.ts';
import { validatePlan, type PlanEvent } from '../src/plan/index.ts';
import plan from '../experiments/08-sound-design/plan.json';
import { RefCloud, RefGrain } from './reference.ts';
import {
  RefCloth,
  RefDrone,
  RefFootstep,
  RefImpact,
  RefRiser,
  RefShimmer,
  RefStem,
  RefSvf,
  RefWhoosh,
  RefWind,
  RefBoom,
  RefRoar,
  RefStoneBand,
  RefStones,
  refNoise,
  refSmooth,
  refSvfCoef,
} from './reference-kinds.ts';
import { noise, smooth } from '../src/kinds/noise.shade.ts';
import { eventSimilarity } from '../src/analyze/index.ts';

// Each kind on the CPU tier, built with `new` on the host (compiler change 0109) and held to the
// plain-JavaScript reference bit for bit. `Math.sin`, `Math.exp` and `Math.cos` are the same
// functions on both sides, and both round every operation to an `f32` (compiler Rule 11.7).

const SR = 48000;
const run = (n: number, tick: () => number): number[] => Array.from({ length: n }, () => tick());
const energy = (x: number[]): number => x.reduce((s, v) => s + v * v, 0);

describe('the shared pieces', () => {
  test('noise is a hash of the key and the frame', () => {
    expect(
      run(
        500,
        (() => {
          let i = 0;
          return () => noise(7, i++);
        })(),
      ),
    ).toEqual(Array.from({ length: 500 }, (_, i) => refNoise(7, i)));
    expect(noise(7, 3)).not.toBe(noise(8, 3));
  });
  test('Svf and svfCoef', () => {
    const a = new Svf().damping(0.6);
    const r = new RefSvf().damping(0.6);
    const xs = Array.from({ length: 800 }, (_, i) => Math.sin(i * 0.2) + (i < 4 ? 2 : 0));
    expect(xs.map((x) => a.step(x, svfCoef(1000 + x * 50, SR)))).toEqual(
      xs.map((x) => r.step(x, refSvfCoef(Math.fround(1000 + x * 50), SR))),
    );
    expect(a.low).toBe(r.low);
    expect(svfCoef(20000, SR)).toBe(Math.fround(1.2));
  });
});

describe('a kind built with new ticks as the reference does', () => {
  const N = 6000;
  test('whoosh', () => {
    const w = new Whoosh().shape(SR, 4000, 250, 2.5, 0.6, 0.6, 0.8, 99);
    const r = new RefWhoosh().shape(SR, 4000, 250, 2.5, 0.6, 0.6, 0.8, 99);
    const got = run(N, () => w.tick());
    expect(got).toEqual(run(N, () => r.tick()));
    expect(energy(got)).toBeGreaterThan(0);
  });
  test('impact', () => {
    const args = [5, 0.0011, 2, 0.0005, 0.00004, 0.0003, 0.3, 60, 0.8, 0.9, 0.5] as const;
    const i = new Impact().shape(...args);
    const r = new RefImpact().shape(...args);
    const got = run(N, () => i.tick());
    expect(got).toEqual(run(N, () => r.tick()));
    expect(energy(got.slice(0, 60))).toBeGreaterThan(0);
  });
  test('shimmer', () => {
    const s = new Shimmer().shape(SR, 1500, 4.5, 0.00004, 0.005, 0.3);
    const r = new RefShimmer().shape(SR, 1500, 4.5, 0.00004, 0.005, 0.3);
    expect(run(N, () => s.tick())).toEqual(run(N, () => r.tick()));
  });
  test('riser', () => {
    const args = [SR, 5000, 0.004, 1.2, 400, 1.5, 0.3, 2, 11] as const;
    const s = new Riser().shape(...args);
    const r = new RefRiser().shape(...args);
    expect(run(N, () => s.tick())).toEqual(run(N, () => r.tick()));
  });
  test('wind', () => {
    const args = [SR, 8000, 2000, 450, 0.8, 0.3, 0.6, 0.5, 0.7, 0.2, 0.1, 0.3, 21] as const;
    const s = new Wind().shape(...args);
    const r = new RefWind().shape(...args);
    expect(run(N, () => s.tick())).toEqual(run(N, () => r.tick()));
  });
  test('drone', () => {
    const args = [SR, 9000, 3000, 55, 0.004, 400, 0.6] as const;
    const s = new Drone().shape(...args);
    const r = new RefDrone().shape(...args);
    expect(run(N, () => s.tick())).toEqual(run(N, () => r.tick()));
  });
  test('footstep and cloth, with grains drawn from the cloud of experiment 6', () => {
    const cloud = new Cloud(SR)
      .density(300)
      .lengths(0.004, 0.02)
      .pitches(900, 3000)
      .level(0.3)
      .seed(5);
    const refCloud = new RefCloud(SR)
      .density(300)
      .lengths(0.004, 0.02)
      .pitches(900, 3000)
      .level(0.3)
      .seed(5);
    const names = ['g0', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7'] as const;
    const step = new Footstep();
    const cloth = new Cloth();
    const rStep = new RefFootstep();
    const rCloth = new RefCloth();
    let slot = 0;
    for (let t = 0; t < 4000 && slot < 8; t++) {
      const word = cloud.draw(t);
      expect(refCloud.draw(t)).toBe(word);
      if (cloud.starts(word)) {
        const g = cloud.grain(t, word);
        const rg = refCloud.grain(t, refCloud.draw(t));
        step[names[slot]!] = g;
        cloth[names[slot]!] = g;
        rStep.grains[slot] = new RefGrain(rg.start, rg.length, rg.inc, rg.peak);
        rCloth.grains[slot] = new RefGrain(rg.start, rg.length, rg.inc, rg.peak);
        slot++;
      }
    }
    expect(slot).toBe(8);
    cloth.lp.k = 0.4;
    (rCloth.lp as { k: number }).k = Math.fround(0.4);
    const got = run(4000, () => step.tick());
    expect(got).toEqual(run(4000, () => rStep.tick()));
    expect(energy(got)).toBeGreaterThan(0);
    expect(run(4000, () => cloth.tick())).toEqual(run(4000, () => rCloth.tick()));
    expect(new Grain(0, 1, 0, 0).at(5)).toBe(0);
  });
  test('voice scales its stem, and is silent with none', () => {
    const s = new Stem().shape(0.5);
    const r = new RefStem().shape(0.5);
    const x = [0.1, -0.7, 0.3333, 1];
    expect(x.map((v) => s.at(v))).toEqual(x.map((v) => r.at(v)));
    expect(s.at(0)).toBe(0);
  });
});

// The four kinds of experiment 9 (docs/experiments.md, section 9): `crack` and `rubble` on the unit
// `Stones`, `boom` and `roar`. Each ticks as its plain-JavaScript reference does, bit for bit.
describe('the kinds of experiment 9 tick as the reference does', { timeout: 120000 }, () => {
  const N = 6000;
  const setBands = (s: Stones | RefStones): void => {
    const bands = [s.b0, s.b1, s.b2, s.b3, s.b4];
    STONE_BANDS.forEach((b, i) => {
      bands[i]!.set(
        svfCoef(b.hz, SR),
        1.2,
        Math.exp(-1 / (b.tau * SR)),
        b.hz / 54.6,
        b.edge,
        b.gain * 0.4,
      );
    });
  };
  test('smooth is the noise of the whole frames on both sides, joined by a smoothstep', () => {
    const xs = Array.from({ length: 400 }, (_, i) => i * 0.037);
    expect(xs.map((x) => smooth(9, x))).toEqual(xs.map((x) => refSmooth(9, x)));
    expect(smooth(9, 3)).toBe(noise(9, 3));
    expect(Math.abs(smooth(9, 3.5) - (noise(9, 3) + noise(9, 4)) / 2)).toBeLessThan(1e-6);
  });
  test('a band of the stones: an impact raises its envelope, and the envelope decays', () => {
    const b = new StoneBand().set(svfCoef(180, SR), 1.2, 0.999, 180 / 54.6, 0.5, 2);
    const r = new RefStoneBand().set(refSvfCoef(180, SR), 1.2, 0.999, 180 / 54.6, 0.5, 2);
    b.hit(0.8, 0.3, 0.4);
    r.hit(0.8, 0.3, 0.4);
    expect(b.env).toBe(r.env);
    expect(b.env).toBeGreaterThan(0);
    const raised = b.env;
    const xs = Array.from({ length: 500 }, (_, i) => refNoise(3, i));
    expect(xs.map((x) => b.tick(x))).toEqual(xs.map((x) => r.tick(x)));
    expect(b.env).toBe(r.env);
    expect(b.env).toBeLessThan(raised * 0.999 ** 400);
  });
  test('stones with a first impact and smaller ones after it (a crack)', () => {
    const args = [41, 14400, 0, 0, 0.002, 0.09, 1.2, 1, 0, 0.3, 0.46, 0.6] as const;
    const a = new Stones().shape(...args);
    const r = new RefStones().shape(...args);
    setBands(a);
    setBands(r);
    const got = run(N, () => a.tick());
    expect(got).toEqual(run(N, () => r.tick()));
    expect(energy(got)).toBeGreaterThan(0);
    expect(got[0]).not.toBe(0);
  });
  test('stones that grow in rate and in size (rubble)', () => {
    const args = [43, 4800, 0.0002, 0.004, 0.001, 0.2, 1.3, 0.35, 0.65, 0.25, 0, 0.5] as const;
    const a = new Stones().shape(...args);
    const r = new RefStones().shape(...args);
    setBands(a);
    setBands(r);
    const got = run(N, () => a.tick());
    expect(got).toEqual(run(N, () => r.tick()));
    expect(energy(got)).toBeGreaterThan(0);
    // No impact at the first frame: the unit is silent until the first one falls.
    expect(got[0]).toBe(0);
  });
  test('boom', () => {
    const args = [5, 0.0127, 1.4, 0.00225, 0.08, 0.00005, 0.00003, 288, 9, 0.3] as const;
    const b = new Boom().shape(...args);
    const r = new RefBoom().shape(...args);
    const got = run(N, () => b.tick());
    expect(got).toEqual(run(N, () => r.tick()));
    expect(energy(got)).toBeGreaterThan(0);
  });
  test('roar', () => {
    const a = new Roar().shape(9, 5000, 1200, 0.6, 0.65, 0.8);
    const r = new RefRoar().shape(9, 5000, 1200, 0.6, 0.65, 0.8);
    for (const x of [a, r]) {
      const bands = [x.b0, x.b1, x.b2, x.b3];
      ROAR_BANDS.forEach((b, i) => {
        bands[i]!.set(svfCoef(b.hz, SR), b.damp, b.gain, b.depth, b.rate / SR);
      });
    }
    const got = run(N, () => a.tick());
    expect(got).toEqual(run(N, () => r.tick()));
    expect(energy(got)).toBeGreaterThan(0);
    // It has fallen to silence at the end of its length.
    expect(got[5000]).toBe(0);
  });
});

// What the macros of the four kinds do, on the lanes `makeLane` builds.
describe('the macros of the kinds of experiment 9', { timeout: 120000 }, () => {
  const event = (kind: string, macros: Record<string, number>, duration?: number): PlanEvent => ({
    id: `${kind}-a`,
    t: 0,
    kind,
    layer: 'effects',
    intensity: 1,
    position: { x: 0, y: 0, distance: 2 },
    macros,
    sync: 'onset',
    ...(duration === undefined ? {} : { duration }),
  });
  const sound = (e: PlanEvent, key: number, frames = 24000): number[] => {
    const made = makeLane(e, { sr: SR, key });
    made.lane.end = made.length;
    return run(Math.min(made.length, frames), () => tickOf(made)(0));
  };
  /** The energy of `y` after a one-pole highpass at `hz`, over its whole energy. */
  const above = (y: number[], hz: number): number => {
    const k = 1 - Math.exp((-2 * Math.PI * hz) / SR);
    let z = 0;
    let hi = 0;
    for (const v of y) {
      z += k * (v - z);
      hi += (v - z) * (v - z);
    }
    return hi / energy(y);
  };
  const keys = [11, 12, 13, 14, 15, 16];
  const mean = (f: (key: number) => number): number =>
    keys.reduce((s, k) => s + f(k), 0) / keys.length;

  test('a crack of a larger size is lower', () => {
    const share = (size: number): number =>
      mean((k) => above(sound(event('crack', { size, brightness: 0.4, crumble: 0 }), k), 400));
    expect(share(0.15)).toBeGreaterThan(2 * share(0.85));
  });
  test('a crack with crumble has more sound after its first impact than one with none', () => {
    const late = (crumble: number): number =>
      mean((k) => {
        const y = sound(event('crack', { size: 0.6, brightness: 0.4, crumble }, 0.5), k);
        return energy(y.slice(9600, 21600));
      });
    expect(late(1)).toBeGreaterThan(3 * late(0));
  });
  test('a boom of a larger size is lower, and a longer decay lasts longer', () => {
    const crossings = (size: number): number => {
      const y = sound(event('boom', { size, decay: 0.6, tone: 1 }), 21, 12000);
      let n = 0;
      for (let i = 1; i < y.length; i++) if (y[i - 1]! < 0 !== y[i]! < 0) n++;
      return n;
    };
    expect(crossings(0.1)).toBeGreaterThan(1.5 * crossings(0.9));
    const late = (decay: number): number => {
      const y = sound(event('boom', { size: 0.5, decay, tone: 0.5 }), 22, 48000);
      return energy(y.slice(14400)) / energy(y);
    };
    expect(late(0.9)).toBeGreaterThan(5 * late(0.2));
  });
  test('rubble of a higher density has more energy, and its swell moves the energy late or early', () => {
    const e = (density: number, swell: number): PlanEvent =>
      event('rubble', { size: 0.5, density, brightness: 0.3, swell }, 0.4);
    const total = (density: number): number => mean((k) => energy(sound(e(density, 0.5), k)));
    expect(total(0.9)).toBeGreaterThan(3 * total(0.3));
    const lateShare = (swell: number): number =>
      mean((k) => {
        const y = sound(e(0.9, swell), k);
        return energy(y.slice(9600, 19200)) / energy(y.slice(0, 19200));
      });
    expect(lateShare(1)).toBeGreaterThan(lateShare(0) + 0.3);
  });
  test('a brighter roar has more of its energy above 1.5 kHz, and a roar ends at its length', () => {
    const e = (brightness: number): PlanEvent =>
      event('roar', { brightness, motion: 0.5, swell: 0.5 }, 0.3);
    const share = (brightness: number): number => mean((k) => above(sound(e(brightness), k), 1500));
    expect(share(1)).toBeGreaterThan(2 * share(0));
    const made = makeLane(e(0.5), { sr: SR, key: 5 });
    expect(made.length).toBe(Math.round(0.3 * SR));
  });
  test('each of the four kinds has its median peak within 1.5 dB of KIND_PEAK at intensity 1 and its default macros', () => {
    const median = (xs: number[]): number =>
      [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
    const defaults: Record<string, Record<string, number>> = {
      crack: { size: 0.5, brightness: 0.5, crumble: 0.5 },
      boom: { size: 0.5, decay: 0.5, tone: 0.5 },
      rubble: { size: 0.5, density: 0.5, brightness: 0.5, swell: 0.5 },
      roar: { brightness: 0.5, motion: 0.5, swell: 0.5 },
    };
    for (const [kind, macros] of Object.entries(defaults)) {
      const peaks = Array.from({ length: 32 }, (_, k) => {
        const y = sound(event(kind, macros), Math.imul(k + 1, 2654435761) >>> 0, 48000);
        return Math.max(...y.map(Math.abs));
      });
      const db = 20 * Math.log10(median(peaks) / KIND_PEAK);
      expect(Math.abs(db), `${kind}: ${median(peaks)}`).toBeLessThan(1.5);
      // Twice the intensity is twice the peak: the level is linear in it.
      const half = sound({ ...event(kind, macros), intensity: 0.5 }, 99, 4800);
      const full = sound(event(kind, macros), 99, 4800);
      expect(Math.max(...half.map(Math.abs)) * 2).toBeCloseTo(Math.max(...full.map(Math.abs)), 4);
    }
  }, 120000);
});

describe('a lane', () => {
  test('is silent before its start and from its end, and plays its kind between', () => {
    const lane = new ImpactLane();
    lane.start = 100;
    lane.end = 700;
    lane.impact = new Impact().shape(5, 0.0011, 2, 0.0005, 0.00004, 0.0003, 0.3, 60, 0.8, 0.9, 0.5);
    const ref = new RefImpact().shape(
      5,
      0.0011,
      2,
      0.0005,
      0.00004,
      0.0003,
      0.3,
      60,
      0.8,
      0.9,
      0.5,
    );
    const got = run(900, () => lane.tick());
    const want = [
      ...Array.from({ length: 100 }, () => 0),
      ...run(600, () => ref.tick()),
      ...Array.from({ length: 200 }, () => 0),
    ];
    expect(got).toEqual(want);
  });
  test('a voice lane with no stem is silent, with a stem plays it', () => {
    const lane = new VoiceLane();
    lane.end = 10;
    lane.stem = new Stem().shape(2);
    expect(run(10, () => lane.tick(0))).toEqual(Array.from({ length: 10 }, () => 0));
    const again = new VoiceLane();
    again.end = 10;
    again.stem = new Stem().shape(2);
    expect(Array.from({ length: 4 }, (_, i) => again.tick(0.25 * i))).toEqual([0, 0.5, 1, 1.5]);
  });
});

/** The tick of a lane of any kind; only a voice lane takes an argument. */
const tickOf = (m: Made): ((x: number) => number) => {
  if (m.kind === 'voice') return (x) => m.lane.tick(x);
  const l = m.lane as unknown as { tick(): number };
  return () => l.tick();
};

describe('the lanes of a plan', () => {
  const p = validatePlan(plan);
  const sound = (e: PlanEvent, key = eventKey(p.seed, e.id)): number[] => {
    const made = makeLane(e, { sr: SR, key });
    const { lane, length } = made;
    lane.end = length;
    return run(Math.min(length, 6000), () => tickOf(made)(0));
  };

  test('every kind of the fixture sounds, with a finite peak under 2', () => {
    const kinds = new Set<string>();
    p.events.forEach((e) => {
      if (e.kind === 'voice') return;
      const y = sound(e);
      kinds.add(e.kind);
      expect(y.every(Number.isFinite)).toBe(true);
      expect(energy(y)).toBeGreaterThan(0);
      expect(Math.max(...y.map(Math.abs))).toBeLessThan(2);
    });
    expect([...kinds].sort()).toEqual(
      ['cloth', 'drone', 'footstep', 'impact', 'riser', 'shimmer', 'whoosh', 'wind'].sort(),
    );
  });

  test('repeated events of one kind differ through their keys, and the same key repeats', () => {
    const steps = p.events.filter((e) => e.kind === 'footstep');
    const a = sound(steps[0]!);
    const b = sound({ ...steps[0]! }, eventKey(p.seed, steps[1]!.id));
    expect(a).not.toEqual(b);
    expect(sound(steps[0]!)).toEqual(a);
  });

  test('every footstep has a thud and a crunch, and every cloth a grain, whatever the key', () => {
    const base = p.events.find((e) => e.kind === 'footstep')!;
    const cloth = p.events.find((e) => e.kind === 'cloth')!;
    // The thud's draw starts no grain in its window for about 1 key in 9 at pace 1.
    const slow = { ...base, macros: { ...base.macros, pace: 1 } };
    for (let key = 1; key <= 150; key++) {
      const f = (
        makeLane(slow, { sr: SR, key: Math.imul(key, 2654435761) >>> 0 }) as Made & {
          kind: 'footstep';
        }
      ).lane.footstep;
      expect(
        [f.g0, f.g1, f.g2].some((g) => g.peak > 0),
        `thud, key ${key}`,
      ).toBe(true);
      expect(
        [f.g3, f.g4, f.g5, f.g6, f.g7].some((g) => g.peak > 0),
        `crunch, key ${key}`,
      ).toBe(true);
    }
    for (let key = 1; key <= 100; key++) {
      const c = (
        makeLane(cloth, { sr: SR, key: Math.imul(key, 2654435761) >>> 0 }) as Made & {
          kind: 'cloth';
        }
      ).lane.cloth;
      expect([c.g0, c.g1, c.g2, c.g3, c.g4, c.g5, c.g6, c.g7].some((g) => g.peak > 0)).toBe(true);
    }
  }, 90000);

  test('no event of footstep or cloth has more than two grains of one cloud sounding at once', () => {
    const step = p.events.find((e) => e.kind === 'footstep')!;
    const cloth = p.events.find((e) => e.kind === 'cloth')!;
    const grains = (e: typeof step, key: number): { start: number; length: number }[][] => {
      const made = makeLane(e, { sr: SR, key });
      const g = (
        u: Record<string, { peak: number; start: number; length: number }>,
        names: string[],
      ) => names.map((n) => u[n]!).filter((x) => x.peak > 0);
      if (made.kind === 'footstep') {
        const f = made.lane.footstep as unknown as Record<string, never>;
        return [g(f, ['g0', 'g1', 'g2']), g(f, ['g3', 'g4', 'g5', 'g6', 'g7'])];
      }
      const c = (made as Made & { kind: 'cloth' }).lane.cloth as unknown as Record<string, never>;
      return [g(c, ['g0', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7'])];
    };
    for (const e of [step, cloth]) {
      for (let k = 1; k <= 200; k++) {
        const key = Math.imul(k, 2654435761) >>> 0;
        const once = grains(e, key);
        expect(grains(e, key), `${e.kind}, key ${k}, repeats`).toEqual(once);
        for (const cloud of once) {
          for (const x of cloud) {
            const n = cloud.filter(
              (o) => o.start <= x.start && o.start + o.length > x.start,
            ).length;
            expect(n, `${e.kind}, key ${k}`).toBeLessThanOrEqual(2);
          }
        }
      }
    }
  }, 90000);

  test('a whoosh with a higher brightness has more energy above 3 kHz', () => {
    const base = p.events.find((e) => e.kind === 'whoosh')!;
    const hi = (m: number): number => {
      const y = sound({ ...base, macros: { ...base.macros, brightness: m } }, 1);
      let prev = 0;
      let e = 0;
      for (const v of y) {
        e += (v - prev) ** 2; // a first difference: a high-pass
        prev = v;
      }
      return e / energy(y);
    };
    expect(hi(0.9)).toBeGreaterThan(hi(0.1));
  });

  test.each([
    ['whoosh', 'speed'],
    ['riser', 'length'],
  ])('a %s sounds for the duration whatever its %s macro', (kind, macro) => {
    const base = { ...p.events.find((e) => e.kind === kind)!, duration: 0.2 };
    const at = (v: number): { length: number; y: number[] } => {
      const e = { ...base, macros: { ...base.macros, [macro]: v } };
      return { length: makeLane(e, { sr: SR, key: 1 }).length, y: sound(e, 1) };
    };
    const lo = at(0.1);
    const hi = at(0.9);
    expect(lo.length).toBe(Math.round(0.2 * SR));
    expect(hi.length).toBe(lo.length);
    expect(lo.y.length).toBe(hi.y.length);
    expect(lo.y).not.toEqual(hi.y);
  });
});

describe('the variation of repeated events (the `variation` guard, bound 0.95)', () => {
  const p = validatePlan(plan);
  // The event rendered alone on the CPU tier, for up to one second: the length `eventSimilarity` reads.
  const alone = (e: PlanEvent, key: number): Float32Array => {
    const made = makeLane(e, { sr: SR, key });
    const { lane, length } = made;
    lane.end = length;
    return Float32Array.from(run(Math.min(length, SR), () => tickOf(made)(0)));
  };

  // Each event of the fixture's kind, with its own macros and its own key, rendered alone. The
  // fixture has one cloth, so a second cloth is the same event under another id.
  // Not `impact` and `whoosh`: rendered alone, two of their events with the same macros stay above
  // 0.95 inside the macro ranges (impact-a and impact-c read 0.986, whoosh-b and whoosh-c 0.955).
  // The guard reads them in the mix, where the fixture's pairs read below the bound (pull request #49).
  test.each(['footstep', 'cloth'])(
    'the %s events of the fixture are less similar than 0.95 to one another, and a key repeats its bits',
    (kind) => {
      const events = p.events.filter((e) => e.kind === kind);
      if (events.length === 1) events.push({ ...events[0]!, id: `${kind}-2` });
      const takes = events.map((e) => alone(e, eventKey(p.seed, e.id)));
      for (let i = 0; i < takes.length; i++)
        for (let j = i + 1; j < takes.length; j++)
          expect(
            eventSimilarity(takes[i]!, takes[j]!, SR).similarity,
            `${events[i]!.id} and ${events[j]!.id}`,
          ).toBeLessThan(0.95);
      expect(alone(events[0]!, eventKey(p.seed, events[0]!.id))).toEqual(takes[0]);
    },
    30000,
  );

  test.each(['footstep', 'cloth', 'impact', 'whoosh'])(
    'two %s events with the same macros that differ only in their key differ in their bits',
    (kind) => {
      const base = p.events.find((e) => e.kind === kind)!;
      const a = alone(base, eventKey(p.seed, 'take-a'));
      expect(a).toEqual(alone(base, eventKey(p.seed, 'take-a')));
      expect(a).not.toEqual(alone(base, eventKey(p.seed, 'take-b')));
    },
    30000,
  );
});

describe('the level of an event follows its intensity, not its draw', () => {
  const p = validatePlan(plan);
  // The event rendered alone on the CPU tier over its whole length: the peak before the spatial chain.
  const peakOf = (e: PlanEvent, key: number): number => {
    const made = makeLane(e, { sr: SR, key });
    const { lane, length } = made;
    lane.end = length;
    const tick = tickOf(made);
    let peak = 0;
    for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(tick(0)));
    return peak;
  };
  const closeTo = (peak: number, intensity: number): boolean =>
    Math.abs(peak - intensity * KIND_PEAK) <= 1e-4 * intensity * KIND_PEAK;

  test.each(['footstep', 'cloth'])(
    'a %s has the peak intensity times KIND_PEAK for 200 keys at intensity 1 and 20 at its own, and a key repeats its samples',
    (kind) => {
      const base = p.events.find((e) => e.kind === kind)!;
      for (const intensity of [1, base.intensity]) {
        const e = { ...base, intensity };
        // The scale is linear in the intensity: 20 keys show that the event's own intensity is used.
        for (let k = 1; k <= (intensity === 1 ? 200 : 20); k++) {
          const key = Math.imul(k, 2654435761) >>> 0;
          const peak = peakOf(e, key);
          expect(
            closeTo(peak, intensity),
            `${kind}, intensity ${intensity}, key ${k}: ${peak}`,
          ).toBe(true);
        }
      }
      const key = eventKey(p.seed, base.id);
      expect(peakOf(base, key)).toBe(peakOf(base, key));
    },
    120000,
  );

  test.each(['footstep', 'cloth'])(
    'a %s has a finite peak intensity times KIND_PEAK at the corners of its macros',
    (kind) => {
      const base = p.events.find((e) => e.kind === kind)!;
      const names = Object.keys(base.macros);
      for (let corner = 0; corner < 2 ** names.length; corner++) {
        const macros = Object.fromEntries(names.map((n, i) => [n, (corner >> i) & 1]));
        const e = { ...base, macros };
        for (let k = 1; k <= 20; k++) {
          const peak = peakOf(e, Math.imul(k, 2654435761) >>> 0);
          expect(Number.isFinite(peak), `${kind}, corner ${corner}, key ${k}`).toBe(true);
          expect(closeTo(peak, e.intensity), `${kind}, corner ${corner}, key ${k}: ${peak}`).toBe(
            true,
          );
        }
      }
    },
    120000,
  );

  // `wind` is not held: its level follows its `gust` macro (a peak of 0.443 at gust 0.3, 1.105 at gust 0.8).
  // `voice` has no kernel level: it plays its stem.
  test('every fixture event but wind and voice has its peak within 2 dB of intensity times KIND_PEAK', () => {
    const lo = KIND_PEAK * 10 ** (-2 / 20);
    const hi = KIND_PEAK * 10 ** (2 / 20);
    for (const e of p.events) {
      if (e.kind === 'wind' || e.kind === 'voice') continue;
      const ratio = peakOf(e, eventKey(p.seed, e.id)) / e.intensity;
      expect(ratio, `${e.id}`).toBeGreaterThanOrEqual(lo);
      expect(ratio, `${e.id}`).toBeLessThanOrEqual(hi);
    }
  }, 120000);
});
