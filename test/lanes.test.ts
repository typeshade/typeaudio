import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createDevice, type Device } from 'typeshade/runtime';
import { bank } from '../src/bank.ts';
import { BLOCK } from '../src/spatial/room.ts';
import { renderPlan } from '../src/render-plan.ts';
import { validatePlan, type PlanEvent } from '../src/plan/index.ts';
import {
  cloths,
  drones,
  footsteps,
  gather,
  impacts,
  risers,
  shimmers,
  voices,
  whooshes,
  winds,
} from '../src/kinds/lanes.shade.ts';
import { KIND_INDEX, eventKey, makeLane, type Made } from '../src/kinds/make.ts';
import plan from '../experiments/08-sound-design/plan.json';

// One bank and one kernel for each kind (docs/lanes.md, "Step 2"). The kernels run on the CPU tier
// here, over the lanes that `makeLane` builds for the events of the fixture plan. Each lane's rows
// are held to the same lane ticked one frame at a time by the host, which is the arithmetic of the
// kind with no kernel in between.

let dev: Device;
beforeAll(async () => {
  dev = await createDevice({ prefer: ['cpu'] });
});
afterAll(async () => {
  await dev.dispose();
});

const p = validatePlan(plan);
const KINDS = Object.keys(KIND_INDEX);
const SENTINEL = -12345;
const BLOCKS = 3;

/** The lane of `e` as the render builds it: sounding from frame `start` for its length. */
const laneOf = (e: PlanEvent, start: number, stem?: Float32Array): Made => {
  const made = makeLane(e, { sr: 48000, key: eventKey(p.seed, e.id), ...(stem ? { stem } : {}) });
  made.lane.start = start;
  made.lane.end = start + made.length;
  return made;
};

describe('the kernel of each kind', () => {
  // The first event of each kind in the fixture, started at frame 100 so that a block holds the
  // silence before the start; a voice event gets a stem.
  const events = KINDS.map(
    (k) => p.events.find((e) => e.kind === k) ?? { ...p.events[0]!, kind: k },
  );
  const stem = Float32Array.from({ length: 4000 }, (_, i) => Math.sin(i * 0.05));

  test('every kind of the fixture, and the voice, are covered', () => {
    expect(events.map((e) => e.kind)).toEqual(KINDS);
  });

  test('each kernel writes the row of each lane of its bank and no other row of its out', async () => {
    const kernels: Record<string, unknown> = {
      whoosh: whooshes,
      impact: impacts,
      shimmer: shimmers,
      riser: risers,
      wind: winds,
      drone: drones,
      footstep: footsteps,
      cloth: cloths,
    };
    for (const e of events) {
      const kind = e.kind;
      const s = kind === 'voice' ? stem : undefined;
      // Two lanes of the kind: the event, and the event again under another id (another key) and start.
      const build = (): Made[] => [laneOf(e, 100, s), laneOf({ ...e, id: `${e.id}-2` }, 300, s)];
      const lanesBank = bank(dev, build().map((m) => m.lane) as never[]);
      // Five rows: two for the lanes, three that no lane may write.
      const out = dev.array(new Float32Array(5 * BLOCK).fill(SENTINEL));
      const inputs = dev.array(new Float32Array(2 * BLOCK).fill(0.25));
      await dev.fuse(() => {
        if (kind === 'voice') voices(out, lanesBank.instances as never, inputs, BLOCK);
        else (kernels[kind] as (...a: unknown[]) => unknown)(out, lanesBank.instances, BLOCK);
      });
      const got = await out.read();
      // The reference: fresh lanes ticked by the host, one frame at a time.
      build().forEach((m, v) => {
        const tick = tickOf(m);
        for (let n = 0; n < BLOCK; n++) {
          expect(got[v * BLOCK + n], `${kind}, lane ${v}, frame ${n}`).toBe(
            tick(kind === 'voice' ? 0.25 : 0),
          );
        }
      });
      expect(
        Array.from(got.subarray(2 * BLOCK)).every((x) => x === SENTINEL),
        `${kind}: rows 2 to 4 stay as they were`,
      ).toBe(true);
      dev.release(out);
      dev.release(inputs);
    }
  });

  test('gather puts the row of each event in its place in raws, whatever the order of the kinds', async () => {
    // Events 0..5 in an order that mixes two kinds: A B A B B A.
    const kinds = new Uint32Array([0, 1, 0, 1, 1, 0]);
    const slots = new Uint32Array([0, 0, 1, 1, 2, 2]);
    const w = (base: number, rows: number): Float32Array =>
      Float32Array.from({ length: rows * BLOCK }, (_, i) => base + i);
    const w0 = w(1000, 3);
    const w1 = w(5000, 3);
    const rest = Array.from({ length: 7 }, () => dev.array(new Float32Array(BLOCK)));
    const a0 = dev.array(w0);
    const a1 = dev.array(w1);
    const raws = dev.array(6 * BLOCK, 'f32');
    const k = dev.array(kinds);
    const s = dev.array(slots);
    await dev.fuse(() => {
      gather(
        raws,
        k,
        s,
        a0,
        a1,
        rest[0]!,
        rest[1]!,
        rest[2]!,
        rest[3]!,
        rest[4]!,
        rest[5]!,
        rest[6]!,
        BLOCK,
      );
    });
    const got = await raws.read();
    for (let i = 0; i < 6; i++) {
      const src = kinds[i] === 0 ? w0 : w1;
      expect(Array.from(got.subarray(i * BLOCK, (i + 1) * BLOCK))).toEqual(
        Array.from(src.subarray(slots[i]! * BLOCK, (slots[i]! + 1) * BLOCK)),
      );
    }
  });
});

describe('renderPlan with one bank for each kind', { timeout: 120000 }, () => {
  const ev = (id: string, kind: string, t: number, macros: Record<string, number>): unknown => ({
    id,
    t,
    kind,
    layer: 'effects',
    intensity: 0.8,
    position: { x: 0, y: 0, distance: 4 },
    macros,
    duration: 0.3,
  });
  const mini = (events: unknown[]): unknown => ({
    version: 1,
    clip: { duration: 1, fps: 24 },
    scene: {
      room: { size: [6, 8, 3], material: 'fabric' },
      listener: { position: [0, 1.6, 0], yaw: 0 },
    },
    master: { lufs: -23, truePeak: -1 },
    seed: 3,
    picture: { cuts: [], motion: [] },
    events,
  });
  const a = ev('a', 'whoosh', 0.05, { speed: 0.5, brightness: 0.5 });
  const b = ev('b', 'shimmer', 0.1, { density: 0.5, height: 0.5 });
  const c = ev('c', 'whoosh', 0.15, { speed: 0.3, brightness: 0.7 });

  test('a plan with two kinds calls one kernel for each, and none for a kind with no event', async () => {
    const r = await renderPlan(dev, mini([a, b, c]), { guards: false, reverb: false, blocks: 2 });
    const calls = r.reports[0]!.groups.flatMap((g) => g.calls);
    expect(calls.filter((x) => ['whooshes', 'shimmers'].includes(x))).toEqual([
      'whooshes',
      'shimmers',
    ]);
    for (const other of ['impacts', 'risers', 'winds', 'drones', 'footsteps', 'cloths', 'voices'])
      expect(calls).not.toContain(other);
    expect(calls).toContain('gather');
  });

  test("the order of the events does not change an event's sound, and an event of a third kind joins without moving the others", async () => {
    const alone = await renderPlan(dev, mini([a, b]), { guards: false, reverb: false, blocks: 4 });
    const more = await renderPlan(dev, mini([a, b, c]), {
      guards: false,
      reverb: false,
      blocks: 4,
    });
    // The first two events are placed the same, so the stems differ by the third event's sound only
    // from its own start (frame 7200) on.
    const before = Array.from(alone.stems.effects[0].subarray(0, 7200));
    expect(Array.from(more.stems.effects[0].subarray(0, 7200))).toEqual(before);
  });
});

const tickOf = (m: Made): ((x: number) => number) => {
  if (m.kind === 'voice') return (x) => m.lane.tick(x);
  const l = m.lane as unknown as { tick(): number };
  return () => l.tick();
};
