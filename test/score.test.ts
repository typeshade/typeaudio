import { describe, expect, test } from 'vitest';
import { LAYERS, validatePlan } from '../src/plan/index.ts';
import type { Rendered } from '../src/render-plan.ts';
import { scoreRenders } from '../experiments/08-sound-design/score.ts';
import { onePlan } from '../src/render-plan.ts';
import plan from '../experiments/08-sound-design/plan.json';

// The checklist of experiment 8 is scored by one function that both arms call (`score.ts`). The
// test gives it the same arrays twice, as copies, the way the CPU arm and a page tier would hold
// them, and asserts the same scores, and that the inputs are not changed by the call.

type Stereo = [Float32Array, Float32Array];

/** A seeded, low-level noise of `n` frames, so that every measure has something to read. */
function noise(n: number, seed: number): Float32Array {
  let s = seed >>> 0 || 1;
  return Float32Array.from({ length: n }, () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s / 2 ** 32 - 0.5) * 0.2;
  });
}

function renderOf(frames: number, seed: number): Rendered {
  const stereo = (k: number): Stereo => [noise(frames, seed + k), noise(frames, seed + k + 100)];
  const stems = Object.fromEntries(LAYERS.map((l, i) => [l, stereo(i)])) as Rendered['stems'];
  const mix = stereo(50);
  const dry = stereo(60);
  return {
    sampleRate: 48000,
    frames,
    stems,
    wet: stereo(70),
    dry,
    mix,
    master: { lufsBefore: -29, normalizeDb: 6, limiterMinDb: 0 },
    blockMs: [],
    reports: [],
    reverbPrepareMs: 0,
    tier: 'cpu',
    placed: [],
  };
}

const copyStereo = (s: readonly Float32Array[]): Stereo => [
  Float32Array.from(s[0]!),
  Float32Array.from(s[1]!),
];

function copyRender(r: Rendered): Rendered {
  return {
    ...r,
    stems: Object.fromEntries(LAYERS.map((l) => [l, copyStereo(r.stems[l])])) as Rendered['stems'],
    wet: copyStereo(r.wet),
    dry: copyStereo(r.dry),
    mix: copyStereo(r.mix),
  };
}

describe('scoreRenders', () => {
  test('gives the same scores for the same arrays, whichever arm holds them', () => {
    const sound = validatePlan(plan);
    const flat = onePlan(sound);
    const one = renderOf(sound.clip.duration * 48000, 1);
    const layered = renderOf(sound.clip.duration * 48000, 2);

    const before = copyRender(layered);
    const first = scoreRenders(sound, flat, one, layered);
    // The second call holds copies, as a page tier would after its own render.
    const second = scoreRenders(sound, flat, copyRender(one), copyRender(layered));

    expect(second).toEqual(first);
    // The call changes none of its inputs.
    expect(layered.mix).toEqual(before.mix);
    expect(layered.stems).toEqual(before.stems);
    expect(first.events).toEqual({ oneLayer: flat.events.length, layered: sound.events.length });
    expect(first.verdicts.length).toBeGreaterThan(0);
  }, 120_000);
});
