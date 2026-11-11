// The kinds as typed function definitions (`src/kinds/functions/`) against the kinds' references
// (`test/reference-kinds.ts`), which `test/kinds.test.ts` holds to the kinds on the CPU tier. A
// function that sounds the same is what lets the site's editor open the engine's sounds.

import { describe, expect, it } from 'vitest';
import { compileFunctionGraph } from '../src/function-graph/compiler/index.ts';
import { FunctionGraphDsp } from '../src/function-graph/runtime/index.ts';
import type { FunctionGraphDocument } from '../src/function-graph/types.ts';
import {
  IMPACT_DEFINITION,
  IMPACT_MODULE,
  IMPACT_SOURCE,
  NOISE_MODULE,
  NOISE_SOURCE,
} from '../src/kinds/functions/impact.ts';
import { BOOM_DEFINITION, BOOM_MODULE, BOOM_SOURCE } from '../src/kinds/functions/boom.ts';
import { RefBoom, RefImpact } from './reference-kinds.ts';

function run(doc: FunctionGraphDocument, frames: number): Float32Array {
  const program = compileFunctionGraph(doc);
  for (const artifact of program.artifacts) new Function(artifact.code)();
  const dsp = new FunctionGraphDsp(program);
  const pcm = new Float32Array(frames);
  const out = new Float32Array(128);
  for (let at = 0; at < frames; at += 128) {
    const n = Math.min(128, frames - at);
    if (!dsp.process(out, n)) throw dsp.fault;
    pcm.set(out.subarray(0, n), at);
  }
  return pcm;
}

/** A document of one kind with its shape as constants. */
function document(
  module: string,
  source: string,
  definition: FunctionGraphDocument['definitions'][number],
  shape: Record<string, number>,
): FunctionGraphDocument {
  return {
    schema: 'typeaudio.function-graph',
    version: 1,
    modules: { [NOISE_MODULE]: NOISE_SOURCE, [module]: source },
    definitions: [definition],
    nodes: [
      {
        id: 'kind',
        definition: definition.id,
        inputs: Object.fromEntries(
          Object.entries(shape).map(([k, v]) => [k, { kind: 'constant', value: v }]),
        ),
      },
    ],
    parameters: [],
    output: { node: 'kind', port: 'out' },
  };
}

/** The function's output against the reference, within 1e-4 of the reference's peak. */
function expectSame(fn: Float32Array, tick: () => number): void {
  let worst = 0;
  let peak = 0;
  for (let i = 0; i < fn.length; i++) {
    const r = tick();
    worst = Math.max(worst, Math.abs(fn[i]! - r));
    peak = Math.max(peak, Math.abs(r));
  }
  expect(peak).toBeGreaterThan(0.01);
  expect(worst / peak).toBeLessThan(1e-4);
}

describe('the kinds as functions', () => {
  it('impact sounds as the kind does, sample for sample', () => {
    const sr = 48000;
    const shape = {
      key: 0x9e3779b9,
      base: 62 / sr,
      drop: 2.1,
      dropRate: 1 / (0.041 * sr),
      subDecay: 1 / (0.31 * sr),
      noiseDecay: 1 / (0.13 * sr),
      noiseK: 0.31,
      clickLen: 88,
      aSub: 0.8,
      aNoise: 0.85,
      aClick: 0.6,
    };
    const doc: FunctionGraphDocument = {
      schema: 'typeaudio.function-graph',
      version: 1,
      modules: { [NOISE_MODULE]: NOISE_SOURCE, [IMPACT_MODULE]: IMPACT_SOURCE },
      definitions: [IMPACT_DEFINITION],
      nodes: [
        {
          id: 'hit',
          definition: 'impact',
          inputs: Object.fromEntries(
            Object.entries(shape).map(([k, v]) => [k, { kind: 'constant', value: v }]),
          ),
        },
      ],
      parameters: [],
      output: { node: 'hit', port: 'out' },
    };
    const frames = sr;
    const fn = run(doc, frames);
    const ref = new RefImpact().shape(
      shape.key,
      shape.base,
      shape.drop,
      shape.dropRate,
      shape.subDecay,
      shape.noiseDecay,
      shape.noiseK,
      shape.clickLen,
      shape.aSub,
      shape.aNoise,
      shape.aClick,
    );
    let worst = 0;
    let peak = 0;
    for (let i = 0; i < frames; i++) {
      const r = ref.tick();
      worst = Math.max(worst, Math.abs(fn[i]! - r));
      peak = Math.max(peak, Math.abs(r));
    }
    expect(peak).toBeGreaterThan(0.1);
    expect(worst / peak).toBeLessThan(1e-4);
  });

  it('boom sounds as the kind does, sample for sample', () => {
    const sr = 48000;
    const shape = {
      key: 0x1234567,
      coef: Math.min(2 * Math.sin((Math.PI * 95) / sr), 1.2),
      damp: 0.35,
      base: 95 / sr,
      glide: 0.08,
      glideRate: 1 / (0.4 * sr),
      decay: 1 / (0.6 * sr),
      rise: 288,
      aNoise: 0.9,
      aTone: 0.25,
    };
    const fn = run(document(BOOM_MODULE, BOOM_SOURCE, BOOM_DEFINITION, shape), sr);
    const ref = new RefBoom().shape(
      shape.key,
      shape.coef,
      shape.damp,
      shape.base,
      shape.glide,
      shape.glideRate,
      shape.decay,
      shape.rise,
      shape.aNoise,
      shape.aTone,
    );
    expectSame(fn, () => ref.tick());
  });
});
