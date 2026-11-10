import { describe, expect, test } from 'vitest';
import plan from '../experiments/08-sound-design/plan.json';
import force from '../experiments/09-force-passage/plan.json';
import { eventSpan, KINDS, LAYERS, validatePlan, MAX_EVENTS } from '../src/plan/index.ts';

// The plan format (docs/sound-design-loop.md). Each refusal is one sentence that names the event and
// the field. No renderer reads the plan here.

const clone = () => structuredClone(plan) as any;
const refused = (edit: (p: any) => void) => {
  const p = clone();
  edit(p);
  try {
    validatePlan(p);
  } catch (e) {
    return (e as Error).message;
  }
  return null;
};

describe('the fixture plan', () => {
  const valid = validatePlan(plan);

  test('is valid, in five layers, with about 20 events', () => {
    expect(valid.events.length).toBeGreaterThanOrEqual(20);
    expect(valid.events.length).toBeLessThanOrEqual(30);
    expect(new Set(valid.events.map((e) => e.layer))).toEqual(new Set(LAYERS));
    expect(valid.clip.duration).toBe(30);
  });

  test('sorts events by time and fills every macro', () => {
    const times = valid.events.map((e) => e.t);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    for (const e of valid.events)
      expect(Object.keys(e.macros).sort()).toEqual(Object.keys(KINDS[e.kind]!.macros).sort());
  });

  test('puts the picture times inside the clip', () => {
    expect(valid.picture.cuts.length).toBeGreaterThan(0);
    expect(valid.picture.motion.length).toBeGreaterThan(0);
  });
});

describe('the validator', () => {
  test('refuses an unknown kind', () => {
    expect(refused((p) => (p.events[0].kind = 'thunder'))).toMatch(
      /^Event "wind-bed": field "kind" must be one of/,
    );
  });
  test('refuses an unknown layer', () => {
    expect(refused((p) => (p.events[0].layer = 'bass'))).toMatch(
      /^Event "wind-bed": field "layer" must be one of/,
    );
  });
  test('refuses a layer that does not match the kind', () => {
    expect(refused((p) => (p.events[0].layer = 'music'))).toBe(
      'Event "wind-bed": field "layer" must be "ambience" for kind "wind".',
    );
  });
  test('refuses a macro the kind does not define', () => {
    expect(refused((p) => (p.events[0].macros.sparkle = 0.1))).toMatch(
      /^Event "wind-bed": field "macros.sparkle" is not a macro/,
    );
  });
  test('refuses a value out of range', () => {
    expect(refused((p) => (p.events[0].intensity = 1.5))).toBe(
      'Event "wind-bed": field "intensity" must be a number from 0 to 1.',
    );
    expect(refused((p) => (p.events[0].position.x = -2))).toMatch(/field "position.x"/);
    expect(refused((p) => (p.events[0].macros.gust = 2))).toMatch(/field "macros.gust"/);
    expect(refused((p) => (p.events[0].t = Number.NaN))).toMatch(/field "t"/);
  });
  test('refuses an event outside the clip', () => {
    expect(refused((p) => (p.events[0].t = 31))).toMatch(/^Event "wind-bed": field "t"/);
    expect(refused((p) => (p.events[0].t = 5))).toMatch(
      /^Event "wind-bed": field "t" or "duration" ends the sound after the clip ends at 30 s/,
    );
    const early = refused((p) => {
      const e = p.events.find((v: any) => v.id === 'whoosh-a');
      e.t = 0.2;
    });
    expect(early).toMatch(
      /^Event "whoosh-a": field "duration" starts the sound before the clip starts/,
    );
  });
  test('refuses a repeated id', () => {
    expect(refused((p) => (p.events[1].id = p.events[0].id))).toMatch(
      /field "id" is used by an earlier event/,
    );
  });
  test('refuses more than the fixed number of events', () => {
    expect(
      refused((p) => {
        p.events = Array.from({ length: MAX_EVENTS + 1 }, (_, i) => ({
          ...p.events[0],
          id: `e${i}`,
        }));
      }),
    ).toBe(`Plan: field "events" holds at most ${MAX_EVENTS} events.`);
  });
  // The fixture with its first event only, so that no event starts inside a silence of these tests.
  const withFirst = (edit: (q: any) => void) => (q: any) => {
    q.events = [{ ...q.events[0], t: 0, duration: 1 }];
    edit(q);
  };
  const accepted = (edit: (q: any) => void) => {
    const q = clone();
    withFirst(edit)(q);
    return validatePlan(q);
  };
  test('takes silences, sorts them, and refuses one that overlaps another or runs past the clip', () => {
    expect(
      accepted(
        (q) =>
          (q.silences = [
            { t: 20, duration: 0.5 },
            { t: 4, duration: 0.2 },
          ]),
      ).silences,
    ).toEqual([
      { t: 4, duration: 0.2 },
      { t: 20, duration: 0.5 },
    ]);
    expect(validatePlan(plan).silences).toEqual([]);
    expect(
      refused(
        withFirst(
          (q) =>
            (q.silences = [
              { t: 4, duration: 0.5 },
              { t: 4.2, duration: 0.5 },
            ]),
        ),
      ),
    ).toBe('Silence at 4.2 s: field "t" lies inside the silence from 4 to 4.5 s.');
    expect(refused(withFirst((q) => (q.silences = [{ t: 29.9, duration: 0.5 }])))).toBe(
      'Silence 0: field "duration" ends the silence after the clip ends at 30 s.',
    );
    expect(refused(withFirst((q) => (q.silences = [{ t: 4, duration: 0.001 }])))).toBe(
      'Silence 0: field "duration" must be a number from 0.01 to 10.',
    );
    expect(refused(withFirst((q) => (q.silences = { t: 4, duration: 1 })))).toBe(
      'Plan: field "silences" must be a list of silences.',
    );
  });
  test('refuses an event that starts inside a silence, and takes one that starts at its end', () => {
    const at10 = (silences: unknown) =>
      withFirst((q) => {
        q.events[0].t = 10;
        q.silences = silences;
      });
    // The first event of the fixture file.
    const id = 'wind-bed';
    expect(refused(at10([{ t: 9.5, duration: 0.5 }]))).toBeNull();
    expect(refused(at10([{ t: 10, duration: 0.5 }]))).toBe(
      `Event "${id}": field "t" starts the sound inside the silence from 10 to 10.5 s; a sound starts before a silence or at its end.`,
    );
    expect(refused(at10([{ t: 9.75, duration: 0.5 }]))).toBe(
      `Event "${id}": field "t" starts the sound inside the silence from 9.75 to 10.25 s; a sound starts before a silence or at its end.`,
    );
  });
  test('refuses a bad scene, version and material', () => {
    expect(refused((p) => (p.version = 2))).toMatch(/field "version"/);
    expect(refused((p) => (p.scene.room.material = 'cheese'))).toMatch(/field "room.material"/);
    expect(refused((p) => (p.clip.duration = 0))).toMatch(/^Clip: field "duration"/);
  });
  test('takes the defaults of an optional field', () => {
    const p = clone();
    delete p.master;
    delete p.seed;
    delete p.events[0].macros;
    const v = validatePlan(p);
    expect(v.master).toEqual({ lufs: -23, truePeak: -1 });
    expect(v.seed).toBe(0);
    expect(v.events.find((e) => e.id === 'wind-bed')!.macros).toEqual({ gust: 0.5, howl: 0.5 });
  });
});

describe('the plan of experiment 9, the force passage', () => {
  const p = validatePlan(force);
  const one = (id: string) => p.events.find((e) => e.id === id)!;

  test('is valid, and holds the four kinds that experiment 9 added', () => {
    expect(p.clip.duration).toBe(15.7);
    const kinds = new Set(p.events.map((e) => e.kind));
    for (const kind of ['crack', 'boom', 'rubble', 'roar'])
      expect(kinds.has(kind), kind).toBe(true);
  });

  test('has two silences: one that ends where the strike starts, and one frame that ends where the hit on the wall starts', () => {
    expect(p.silences).toHaveLength(2);
    const [first, second] = p.silences;
    expect(Math.abs(first!.t + first!.duration - one('strike').t)).toBeLessThan(1e-6);
    expect(one('stare').t).toBeLessThan(first!.t);
    expect(one('stare').t + one('stare').duration!).toBeGreaterThan(first!.t);
    expect(second!.duration).toBeCloseTo(1001 / 24000, 5);
    expect(Math.abs(second!.t + second!.duration - one('wall-hit').t)).toBeLessThan(1e-6);
    // The rush arrives where the second silence starts.
    expect(eventSpan(one('rush')).end).toBeLessThanOrEqual(second!.t);
    expect(second!.t - eventSpan(one('rush')).end).toBeLessThan(0.01);
  });

  test('puts the strike, the blast, the hit on the wall and the break in their order', () => {
    const order = ['strike', 'blast', 'wall-hit', 'split-1', 'break', 'land-1'];
    const times = order.map((id) => one(id).t);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    // The blast is two frames after the strike: her hair snaps, then she is thrown.
    expect(one('blast').t - one('strike').t).toBeCloseTo(2002 / 24000, 5);
  });

  test('lets the hit on the wall lead: it is the largest event, and the air of the blast ends before the frame of silence', () => {
    const hit = one('wall-hit');
    expect(hit.kind).toBe('impact');
    expect(hit.intensity).toBe(1);
    expect(Math.max(...p.events.map((e) => e.intensity))).toBe(hit.intensity);
    const flight = p.events.filter((e) => e.t >= one('blast').t && e.t < hit.t);
    expect(flight.length).toBeGreaterThanOrEqual(4);
    for (const e of flight) {
      expect(e.intensity, e.id).toBeLessThan(0.6);
      if (e.kind === 'roar') expect(eventSpan(e).end, e.id).toBeLessThanOrEqual(p.silences[1]!.t);
    }
  });

  test('tells the hit on the wall from the break: one hit at one point with its stone, then three bursts over time and width', () => {
    const t = one('wall-hit').t;
    const hit = p.events.filter((e) => e.layer === 'effects' && e.t >= t && e.t < t + 0.006);
    expect(hit.filter((e) => e.kind === 'impact').map((e) => e.id)).toEqual(['wall-hit']);
    expect(hit.length).toBeGreaterThanOrEqual(6);
    // The break: three bursts, each later, lower and at another place.
    const tears = ['break', 'break-2', 'break-3'].map(one);
    expect(tears[2]!.t - tears[0]!.t).toBeGreaterThanOrEqual(0.1);
    for (let i = 1; i < tears.length; i++) {
      expect(tears[i]!.t, tears[i]!.id).toBeGreaterThan(tears[i - 1]!.t);
      expect(tears[i]!.intensity, tears[i]!.id).toBeLessThan(tears[i - 1]!.intensity);
    }
    expect(new Set(tears.map((e) => e.position.x)).size).toBe(3);
    expect(tears[0]!.intensity).toBeLessThan(one('wall-hit').intensity);
  });

  test('uses no crack and no rubble after the hit on the wall: no band that rings', () => {
    // The owner heard the stone kinds as plastic when they are dull and as a steel bin that is
    // kicked when they are bright. After the frame of the hit the plan holds an `impact` whose sub
    // rests at 35 Hz, a `boom` with no tone under 100 Hz, and a `roar`.
    const after = p.events.filter((e) => e.t > one('wall-hit').t + 0.01 && e.layer === 'effects');
    expect(after.filter((e) => e.kind === 'crack' || e.kind === 'rubble')).toEqual([]);
    for (const e of after.filter((v) => v.kind === 'impact')) expect(e.macros.weight, e.id).toBe(1);
    for (const e of after.filter((v) => v.kind === 'boom')) {
      expect(e.macros.tone, e.id).toBe(0);
      expect(140 * 0.4 ** e.macros.size!, e.id).toBeLessThan(100);
    }
    // The three splits before the break grow.
    const splits = ['split-1', 'split-2', 'split-3'].map(one);
    expect(splits.map((e) => e.intensity)).toEqual(
      [...splits.map((e) => e.intensity)].sort((a, b) => a - b),
    );
  });

  test('makes the hit on the wall hard and dense: an edge of stone, a wide burst, a deep body with no tone', () => {
    const t = one('wall-hit').t;
    // The sub of the `impact` rests at 40.5 Hz or under: no pitch that the ear follows.
    expect(one('wall-hit').macros.weight).toBeGreaterThanOrEqual(0.9);
    for (const id of ['wall-body', 'wall-punch', 'wall-thump']) {
      expect(one(id).kind, id).toBe('boom');
      expect(one(id).macros.tone, id).toBe(0);
      expect(one(id).t, id).toBe(t);
    }
    // The stone: a large block and a small hard edge, both at full brightness.
    expect(one('wall-stone').macros.size).toBeGreaterThan(0.95);
    expect(one('wall-stone').macros.brightness).toBe(1);
    expect(one('wall-edge').macros.size).toBeLessThan(0.1);
    expect(one('wall-edge').macros.brightness).toBe(1);
    // The burst is short: a quarter of a second or less.
    expect(one('wall-burst').kind).toBe('roar');
    expect(one('wall-burst').duration).toBeLessThanOrEqual(0.25);
    // The hall answers after the time the sound takes to come back.
    expect(one('hall-answer').position.distance).toBeGreaterThanOrEqual(10);
    expect(one('hall-answer').t).toBeGreaterThan(t);
  });

  test('strikes nothing while the blocks hang in the air: the stone of the break ends, and the blocks land after the cut to the fog', () => {
    const brk = one('break').t;
    const fog = p.picture.cuts[3]!;
    const strikes = (e: { kind: string }) =>
      e.kind === 'crack' || e.kind === 'rubble' || e.kind === 'impact';
    // No stone and no hit starts from 0.15 s after the break to the cut.
    expect(p.events.filter((e) => strikes(e) && e.t > brk + 0.15 && e.t < fog)).toEqual([]);
    // The stone of the break makes its last impact within 0.35 s of it: the picture is slow from there.
    for (const e of p.events.filter((v) => strikes(v) && v.t >= brk && v.t <= brk + 0.15))
      expect(eventSpan(e).end, e.id).toBeLessThanOrEqual(brk + 0.35);
    // What goes on under the hang is the mass of the break, with no tone, and slow air.
    expect(one('hang').t).toBe(brk);
    expect(one('hang').macros.tone).toBe(0);
    for (const id of ['drift-1', 'drift-2']) expect(one(id).macros.speed, id).toBeLessThan(0.2);
    // The first landing comes after the cut.
    expect(one('land-1').t).toBeGreaterThan(fog);
    expect(one('land-1').t - fog).toBeLessThan(0.3);
  });

  test('holds a mass from the blast to the fog: a wide roar under every sound that leads, and no tone', () => {
    const fog = p.picture.cuts[3]!;
    const hush = p.silences[1]!;
    const roars = p.events.filter((e) => e.kind === 'roar').map(eventSpan);
    // From the blast to half a second past the cut to the fog, a roar sounds at every twentieth of
    // a second, but in the frame of silence.
    for (let t = one('blast').t + 0.03; t < fog + 0.5; t += 0.05) {
      if (t >= hush.t - 0.03 && t <= hush.t + hush.duration + 0.03) continue;
      expect(
        roars.some((r) => r.start <= t && t < r.end),
        `no roar at ${t.toFixed(2)} s`,
      ).toBe(true);
    }
    // No tone that the ear follows: no cloth (its grains ring), no howl in the air, and the sub of
    // the blast rests at 35 Hz.
    expect(p.events.filter((e) => e.kind === 'cloth')).toEqual([]);
    for (const e of p.events.filter((v) => v.kind === 'wind')) expect(e.macros.howl, e.id).toBe(0);
    expect(one('blast').macros.weight).toBe(1);
  });

  test('makes a landing from the four layers of the owner: the ground, the hit that tears, the crush, the ring of the hall', () => {
    for (const id of ['land-1', 'land-2']) {
      const hit = one(id);
      expect(hit.kind, id).toBe('impact');
      // 1. The ground comes first: a body with no tone at 56 Hz, 30 ms before the hit.
      const ground = one(`${id}-ground`);
      expect(hit.t - ground.t, id).toBeCloseTo(0.03, 5);
      expect(ground.macros.tone, id).toBe(0);
      expect(140 * 0.4 ** ground.macros.size!, id).toBeLessThan(60);
      // 2. The hit tears: the widest burst of an `impact`, and a bright roar of under 0.3 s.
      expect(hit.macros.crack, id).toBe(1);
      expect(one(`${id}-tear`).macros.brightness, id).toBe(1);
      expect(one(`${id}-tear`).duration, id).toBeLessThan(0.3);
      // 3. The crush follows it, far lower, and wanders.
      const crush = one(`${id}-crush`);
      expect(crush.t, id).toBeGreaterThan(hit.t);
      expect(crush.intensity, id).toBeLessThan(0.5 * hit.intensity);
      expect(crush.macros.motion, id).toBe(1);
      // 4. The hall rings for seconds: a dark roar, and the far wall that answers.
      expect(one(`${id}-ring`).duration, id).toBeGreaterThanOrEqual(2);
      expect(one(`${id}-ring`).macros.brightness, id).toBeLessThanOrEqual(0.2);
      expect(one(`${id}-answer`).position.distance, id).toBeGreaterThanOrEqual(10);
    }
    expect(one('land-2').intensity).toBeLessThan(one('land-1').intensity);
  });

  test('keeps the landings out of the picture: what is loud after the cut to the fog stands 6 m or more away', () => {
    const fog = p.picture.cuts[3]!;
    const late = p.events.filter((e) => e.t >= fog && e.layer === 'effects');
    expect(late.length).toBeGreaterThanOrEqual(4);
    for (const e of late)
      if (e.intensity > 0.3) expect(e.position.distance, e.id).toBeGreaterThanOrEqual(6);
  });
});
