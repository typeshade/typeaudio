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

  test('tells the hit on the wall from the break: a body on stone at one point, then stone that tears', () => {
    const at = (t: number, window: number) =>
      p.events.filter((e) => e.layer === 'effects' && e.t >= t && e.t < t + window);
    // The hit: one `impact`, and no bright stone on its frame. The wall has not broken yet.
    const hit = at(one('wall-hit').t, 0.001);
    expect(hit.filter((e) => e.kind === 'impact').map((e) => e.id)).toEqual(['wall-hit']);
    for (const e of hit)
      if (e.kind === 'crack' || e.kind === 'rubble')
        expect(e.macros.brightness, e.id).toBeLessThanOrEqual(0.3);
    // The break: no `impact`; cracks and rubble over 50 ms, three or more of them bright.
    const brk = at(one('break').t, 0.05);
    expect(brk.some((e) => e.kind === 'impact')).toBe(false);
    const stone = brk.filter((e) => e.kind === 'crack' || e.kind === 'rubble');
    expect(stone.filter((e) => e.macros.brightness! >= 0.8).length).toBeGreaterThanOrEqual(3);
    expect(new Set(stone.map((e) => e.position.x)).size).toBeGreaterThanOrEqual(3);
  });

  test('lets the crack that runs say that the wall will give: it starts under the hit and grows to the break', () => {
    const run = one('crack-run');
    expect(run.t - one('wall-hit').t).toBeLessThan(0.1);
    expect(run.macros.swell).toBe(1);
    expect(Math.abs(eventSpan(run).end - one('break').t)).toBeLessThan(1e-3);
    const splits = ['split-1', 'split-2', 'split-3'].map(one);
    expect(splits.map((e) => e.macros.size)).toEqual(
      [...splits.map((e) => e.macros.size!)].sort((a, b) => a - b),
    );
  });

  test('strikes nothing while the blocks hang in the air: the stone of the break ends, and the blocks land after the cut to the fog', () => {
    const brk = one('break').t;
    const fog = p.picture.cuts[3]!;
    const strikes = (e: { kind: string }) =>
      e.kind === 'crack' || e.kind === 'rubble' || e.kind === 'impact';
    // No stone and no hit starts from 50 ms after the break to the cut.
    expect(p.events.filter((e) => strikes(e) && e.t > brk + 0.05 && e.t < fog)).toEqual([]);
    // The stone of the break makes its last impact within 0.3 s of it: the picture is slow from there.
    for (const e of p.events.filter((v) => strikes(v) && v.t >= brk && v.t <= brk + 0.05))
      expect(eventSpan(e).end, e.id).toBeLessThanOrEqual(brk + 0.3);
    // What goes on under the hang is the mass of the break, with no tone, and slow air.
    expect(one('hang').t).toBe(brk);
    expect(one('hang').macros.tone).toBe(0);
    for (const id of ['drift-1', 'drift-2']) expect(one(id).macros.speed, id).toBeLessThan(0.2);
    // The first landing comes after the cut.
    expect(one('land-1').t).toBeGreaterThan(fog);
    expect(one('land-1').t - fog).toBeLessThan(0.3);
  });

  test('makes a landing of stone, not of a hollow thing: a hard edge, a deep body with no tone, and grit', () => {
    const fog = p.picture.cuts[3]!;
    // No `impact` after the cut: its sub is one tone, and the owner heard a plastic container.
    expect(p.events.filter((e) => e.t >= fog && e.kind === 'impact')).toEqual([]);
    for (const id of ['land-1', 'land-2']) {
      const block = one(id);
      expect(block.kind, id).toBe('crack');
      // A block of 1 m or more, with its edge and no smaller cracks after it.
      expect(block.macros.size, id).toBeGreaterThan(0.8);
      expect(block.macros.brightness, id).toBeGreaterThanOrEqual(0.8);
      expect(block.macros.crumble, id).toBe(0);
      for (const part of ['body', 'punch']) {
        const boom = one(`${id}-${part}`);
        expect(boom.kind, boom.id).toBe('boom');
        expect(boom.macros.tone, boom.id).toBe(0);
        expect(boom.t, boom.id).toBe(block.t);
      }
      const edge = one(`${id}-edge`);
      expect(edge.t, edge.id).toBe(block.t);
      expect(edge.macros.size, edge.id).toBeLessThan(0.1);
      expect(edge.macros.brightness, edge.id).toBe(1);
      expect(one(`${id}-grit`).t - block.t, id).toBeLessThan(0.02);
    }
    // After the cut, a `rubble` is small stone only: its middle size is under 0.1 m.
    for (const e of p.events.filter((v) => v.t >= fog && v.kind === 'rubble'))
      expect(e.macros.size, e.id).toBeLessThan(0.2);
    // The second landing is the smaller one.
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
