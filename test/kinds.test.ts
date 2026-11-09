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
import { Cue } from '../src/kinds/cue.shade.ts';
import { Svf, svfCoef } from '../src/units/svf.shade.ts';
import { Cloud, Grain } from '../src/units/grain.shade.ts';
import { eventKey, makeCue } from '../src/kinds/make.ts';
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
  refNoise,
  refSvfCoef,
} from './reference-kinds.ts';
import { noise } from '../src/kinds/noise.shade.ts';
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

describe('a cue', () => {
  test('is silent before its start and from its end, and plays its kind between', () => {
    const cue = new Cue();
    cue.kind = 1;
    cue.start = 100;
    cue.end = 700;
    cue.impact = new Impact().shape(5, 0.0011, 2, 0.0005, 0.00004, 0.0003, 0.3, 60, 0.8, 0.9, 0.5);
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
    const got = run(900, () => cue.tick(0));
    const want = [
      ...Array.from({ length: 100 }, () => 0),
      ...run(600, () => ref.tick()),
      ...Array.from({ length: 200 }, () => 0),
    ];
    expect(got).toEqual(want);
  });
  test('a voice cue with no stem is silent, with a stem plays it', () => {
    const cue = new Cue();
    cue.kind = 8;
    cue.end = 10;
    cue.stem = new Stem().shape(2);
    expect(run(10, () => cue.tick(0))).toEqual(Array.from({ length: 10 }, () => 0));
    const again = new Cue();
    again.kind = 8;
    again.end = 10;
    again.stem = new Stem().shape(2);
    expect(Array.from({ length: 4 }, (_, i) => again.tick(0.25 * i))).toEqual([0, 0.5, 1, 1.5]);
  });
});

describe('the cues of a plan', () => {
  const p = validatePlan(plan);
  const sound = (e: PlanEvent, key = eventKey(p.seed, e.id)): number[] => {
    const { cue, length } = makeCue(e, { sr: SR, key });
    cue.end = length;
    return run(Math.min(length, 6000), () => cue.tick(0));
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
      const f = makeCue(slow, { sr: SR, key: Math.imul(key, 2654435761) >>> 0 }).cue.footstep;
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
      const c = makeCue(cloth, { sr: SR, key: Math.imul(key, 2654435761) >>> 0 }).cue.cloth;
      expect([c.g0, c.g1, c.g2, c.g3, c.g4, c.g5, c.g6, c.g7].some((g) => g.peak > 0)).toBe(true);
    }
  }, 30000);

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
      return { length: makeCue(e, { sr: SR, key: 1 }).length, y: sound(e, 1) };
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
    const { cue, length } = makeCue(e, { sr: SR, key });
    cue.end = length;
    return Float32Array.from(run(Math.min(length, SR), () => cue.tick(0)));
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
