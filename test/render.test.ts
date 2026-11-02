import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createDevice, type Device } from 'typeshade/runtime';
import { bank, explain, plan, render, Voice } from '../src/index.ts';
import { RefVoice, refRender } from './reference.ts';

// `render` on the CPU tier, with no device, held to the reference render bit for bit; the voices'
// state through the `Resident` bank; and the shape of the fuse report of each block.

const SR = 48000;
const SPEC: readonly (readonly [number, number, number])[] = [
  [110, 900, 0.7],
  [165, 1400, 0.9],
  [220, 2000, 1.2],
  [330, 3000, 0.6],
  [55, 400, 2],
];
const voicesOf = (): Voice[] => SPEC.map(([f, c, q]) => new Voice(f, c, q, SR));
const refVoicesOf = (): RefVoice[] => SPEC.map(([f, c, q]) => new RefVoice(f, c, q, SR));

let dev: Device;
beforeAll(async () => {
  dev = await createDevice({ prefer: ['cpu'] });
});
afterAll(async () => {
  await dev.dispose();
});

describe('render on the CPU tier', () => {
  test('is the reference render, with a short last block', async () => {
    const p = plan(bank(dev, voicesOf()), { drive: 1.5, gain: 0.5 });
    const out = await render(p, { frames: 1000, block: 256 });
    const ref = refRender(refVoicesOf(), 1000, 256, 1.5, 0.5);
    expect(out).toEqual(ref);
    expect(p.peak).toBe(Math.max(...ref.map(Math.abs)));
    expect(p.peak).toBeGreaterThan(0);
  });

  test('keeps each voice in its lane of the bank between blocks and between renders', async () => {
    const voices = bank(dev, voicesOf());
    const p = plan(voices, { drive: 2, gain: 0.25 });
    const first = await render(p, { frames: 384, block: 128 });
    const second = await render(p, { frames: 384, block: 128 });
    const refs = refVoicesOf();
    const ref = refRender(refs, 768, 128, 2, 0.25);
    expect([...first, ...second]).toEqual([...ref]);
    // The bank holds each voice's state after 768 frames: `voices[v].tick()` wrote lane `v`.
    const after = await voices.read();
    expect(after.map((v) => v.osc)).toEqual(refs.map((r) => ({ phase: r.osc.phase, inc: r.osc.inc })));
    expect(after.map((v) => v.filter)).toEqual(refs.map((r) => ({ ...r.filter })));
    // The read holds the fields, not instances of the class (docs/compiler-asks.md, N).
    expect(after.some((v) => v instanceof Voice)).toBe(false);
  });

  test('a block holds 1024 frames when the render names none', async () => {
    const p = plan(bank(dev, voicesOf()));
    const out = await render(p, { frames: 2500 });
    expect(out).toEqual(refRender(refVoicesOf(), 2500, 1024, 1, 1));
    expect(p.reports).toHaveLength(3);
  });

  test('refuses a size that is not a whole number of frames', async () => {
    const p = plan(bank(dev, voicesOf()));
    await expect(render(p, { frames: 0, block: 64 })).rejects.toThrow(
      'render(): frames takes a whole number of 1 or more; got 0.',
    );
    await expect(render(p, { frames: 64, block: 1.5 })).rejects.toThrow(
      'render(): block takes a whole number of 1 or more; got 1.5.',
    );
  });

  test('a bank of no instance is refused', () => {
    expect(() => bank(dev, [])).toThrow('bank(): takes at least one instance; got an empty array.');
  });
});

describe('the fuse report of each block', () => {
  test('one plan per block, each call a group of its own on the CPU tier', async () => {
    const p = plan(bank(dev, voicesOf()));
    await render(p, { frames: 600, block: 256 });
    expect(p.reports).toHaveLength(3);
    for (const report of p.reports) {
      expect(report).toMatchObject({ tier: 'cpu', dispatches: 0, submissions: 0 });
      expect(report.groups.map((g) => g.calls)).toEqual([
        ['synth'],
        ['mixdown'],
        ['drive'],
        ['gain'],
        ['peak'],
      ]);
      // The CPU tier fuses nothing and says nothing of why (compiler surface §71).
      expect(report.groups.every((g) => !g.fused && g.why === undefined)).toBe(true);
      expect(report.groups.every((g) => g.workgroupShapes === undefined)).toBe(true);
      // Each group names the tier it ran on (compiler change 0118).
      expect(report.groups.every((g) => g.tier === 'cpu')).toBe(true);
    }
  });

  test('explain says it in words', async () => {
    const p = plan(bank(dev, voicesOf()));
    await render(p, { frames: 512, block: 256 });
    expect(explain(p.reports)).toBe(
      [
        '2 blocks on the CPU tier, each block one fuse plan',
        'the last block: 0 dispatches, 0 submissions',
        '  1. synth: on the CPU tier',
        '  2. mixdown: on the CPU tier',
        '  3. drive: on the CPU tier',
        '  4. gain: on the CPU tier',
        '  5. peak: on the CPU tier',
        'all blocks: 0 dispatches, 0 submissions',
        'The CPU tier runs the calls one after another and fuses none; it is the reference a fused group is held to.',
      ].join('\n'),
    );
  });
});
