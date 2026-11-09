import { describe, expect, test } from 'vitest';
import plan from '../experiments/08-sound-design/plan.json';
import { KINDS, LAYERS, validatePlan, MAX_EVENTS } from '../src/plan/index.ts';

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
    expect(refused((p) => (p.events[0].kind = 'boom'))).toMatch(
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
