import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createDevice, type Device, type FuseReport, type Resident } from 'typeshade/runtime';
import { Cloud, Grain } from '../src/units/grain.shade.ts';
import { cull, play, spawn } from '../src/kernels/grains.shade.ts';
import { RefCloud, RefGrain, RefScheduler, refHash32, refUniform } from './reference.ts';

// The grains on the CPU tier, with no device: the units built with `new` on the host and held to
// the plain-JavaScript reference bit for bit, and the scheduler's three kernels over Resident
// lists whose counts stay in Residents, block after block, held to the reference scheduler.

const SR = 48000;

const cloudOf = (key: number, density = 10000): Cloud =>
  new Cloud(SR).density(density).lengths(0.02, 0.1).pitches(220, 1760).level(0.02).seed(key);
const refCloudOf = (key: number, density = 10000): RefCloud =>
  new RefCloud(SR).density(density).lengths(0.02, 0.1).pitches(220, 1760).level(0.02).seed(key);

let dev: Device;
beforeAll(async () => {
  dev = await createDevice({ prefer: ['cpu'] });
});
afterAll(async () => {
  await dev.dispose();
});

describe('a grain built with new', () => {
  test('is silent before it starts and once it has ended, and a windowed sine between', () => {
    const grain = new Grain(1000, 480, 0.01, 0.5);
    const ref = new RefGrain(1000, 480, 0.01, 0.5);
    const frames = Array.from({ length: 700 }, (_, i) => 900 + i);
    expect(frames.map((t) => grain.at(t))).toEqual(frames.map((t) => ref.at(t)));
    expect(grain.at(999)).toBe(0);
    expect(grain.at(1000)).toBe(0); // the window starts at 0
    expect(grain.at(1480)).toBe(0);
    expect(frames.some((t) => grain.at(t) !== 0)).toBe(true);
  });

  test('sounds from a frame until its last frame has passed', () => {
    const grain = new Grain(1000, 480, 0.01, 0.5);
    expect(grain.soundsFrom(1479)).toBe(true);
    expect(grain.soundsFrom(1480)).toBe(false);
    expect(grain.soundsFrom(0)).toBe(true);
  });
});

describe('a cloud built with new and its setters', () => {
  test('holds the reference fields', () => {
    const cloud = cloudOf(7);
    const ref = refCloudOf(7);
    expect(cloud).toBeInstanceOf(Cloud);
    expect([cloud.chance, cloud.shortest, cloud.spread, cloud.low, cloud.span, cloud.loudest, cloud.key]).toEqual([
      ref.chance,
      ref.shortest,
      ref.spread,
      ref.low,
      ref.span,
      ref.loudest,
      ref.key,
    ]);
    expect([cloud.shortest, cloud.spread]).toEqual([960, 3840]);
  });

  test('draws the reference words, starts and grains', () => {
    const cloud = cloudOf(7);
    const ref = refCloudOf(7);
    for (let t = 0; t < 4096; t++) {
      const word = cloud.draw(t);
      expect(word).toBe(ref.draw(t));
      expect(cloud.starts(word)).toBe(ref.starts(word));
    }
    const grain = cloud.grain(123, cloud.draw(123));
    const want = ref.grain(123, ref.draw(123));
    expect([grain.start, grain.length, grain.inc, grain.peak]).toEqual([want.start, want.length, want.inc, want.peak]);
    expect(refHash32(0)).toBe(0);
    expect(refUniform(0xffffffff)).toBeLessThan(1);
  });

  test('starts about the density it is given', () => {
    const cloud = cloudOf(3);
    let started = 0;
    for (let t = 0; t < SR * 10; t++) if (cloud.starts(cloud.draw(t))) started++;
    // 10 seconds at 10,000 grains a second: within 1 % of 100,000.
    expect(Math.abs(started - 100000)).toBeLessThan(1000);
  });
});

/** Two lists of `capacity` grains and their counts, on `dev`, as the scheduler swaps them. */
function lists(capacity: number): { grains: Resident<Grain[]>[]; counts: Resident<Uint32Array>[] } {
  const empty = (): Grain[] => Array.from({ length: capacity }, () => new Grain(0, 1, 0, 0));
  return {
    grains: [dev.array(empty()), dev.array(empty())],
    counts: [dev.array(new Uint32Array(1)), dev.array(new Uint32Array(1))],
  };
}

/** Runs `blocks` blocks of the scheduler on the CPU tier, one fuse plan each, as the harness does. */
async function schedule(cloud: Cloud, capacity: number, blocks: number, block: number) {
  const { grains, counts } = lists(capacity);
  const out = dev.array(block, 'f32');
  const results: { out: Float32Array; survivors: number; count: number }[] = [];
  const reports: FuseReport[] = [];
  for (let b = 0; b < blocks; b++) {
    const [cur, prev] = b % 2 === 0 ? [0, 1] : [1, 0];
    const start = b * block;
    let survivors = 0;
    reports.push(
      await dev.fuse(() => {
        cull(grains[cur]!, counts[cur]!, grains[prev]!, counts[prev]!, start);
      }),
    );
    survivors = (await counts[cur]!.read())[0]!;
    reports.push(
      await dev.fuse(() => {
        spawn({ array: grains[cur]!, length: counts[cur]! }, cloud, start, block);
        play(out, grains[cur]!, counts[cur]!, start);
      }),
    );
    results.push({ out: await out.read(), survivors, count: (await counts[cur]!.read())[0]! });
  }
  const last = await grains[(blocks - 1) % 2]!.read();
  return { results, reports, last };
}

describe('the scheduler on the CPU tier', () => {
  test('is the reference scheduler, block after block, bit for bit', async () => {
    const block = 256;
    const { results, last } = await schedule(cloudOf(11), 2048, 24, block);
    const ref = new RefScheduler(refCloudOf(11), 2048);
    for (const [b, got] of results.entries()) {
      const want = ref.block(b * block, block);
      expect(got.survivors).toBe(want.survivors);
      expect(got.count).toBe(want.count);
      expect(got.out).toEqual(want.out);
    }
    // The list holds the grains in the order they started, with no sort.
    const live = last.slice(0, ref.count);
    expect(live.map((g) => g.start)).toEqual(ref.list.map((g) => g.start));
    expect(live.map((g) => [g.length, g.inc, g.peak])).toEqual(ref.list.map((g) => [g.length, g.inc, g.peak]));
    expect(live.every((g, i) => i === 0 || live[i - 1]!.start <= g.start)).toBe(true);
    // About 10,000 grains a second, each 20 to 100 ms: a few hundred alive.
    expect(ref.count).toBeGreaterThan(300);
    expect(ref.count).toBeLessThan(1100);
  });

  test('counts the grains past a full list, keeps what fits and plays what it keeps', async () => {
    const block = 256;
    const capacity = 64;
    const { results } = await schedule(cloudOf(5), capacity, 8, block);
    const ref = new RefScheduler(refCloudOf(5), capacity);
    let over = false;
    for (const [b, got] of results.entries()) {
      const want = ref.block(b * block, block);
      expect(got.count).toBe(want.count);
      expect(got.out).toEqual(want.out);
      over ||= want.count > capacity;
    }
    expect(over).toBe(true);
  });

  test('plans one group for each call on the CPU tier, none fused', async () => {
    const { reports } = await schedule(cloudOf(2), 512, 2, 128);
    const groups = reports.map((r) => r.groups.map((g) => `${g.calls.join('+')}${g.fused ? ' (fused)' : ''}`));
    expect(groups).toEqual([['cull'], ['spawn', 'play'], ['cull'], ['spawn', 'play']]);
    expect(reports.every((r) => r.tier === 'cpu' && r.dispatches === 0 && r.submissions === 0)).toBe(true);
  });
});
