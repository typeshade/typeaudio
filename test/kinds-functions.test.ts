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
import {
  ROAR_BAND_DEFINITION,
  ROAR_MIX_DEFINITION,
  ROAR_MODULE,
  ROAR_SOURCE,
} from '../src/kinds/functions/roar.ts';
import {
  STONE_BAND_DEFINITION,
  STONE_CLOCK_DEFINITION,
  STONE_MIX_DEFINITION,
  STONES_MODULE,
  STONES_SOURCE,
} from '../src/kinds/functions/stones.ts';
import { RefBoom, RefImpact, RefRoar, RefStones } from './reference-kinds.ts';
import { kindNodes } from '../src/kinds/functions/fromEvent.ts';
import { eventKey, makeLane } from '../src/kinds/make.ts';
import type { PlanEvent } from '../src/plan/index.ts';
import wallHit from '../experiments/10-seven-questions/store/wall-hit.json';

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

  it('roar, as four band nodes and a mix, sounds as the kind does', () => {
    const sr = 48000;
    const key = 0xabcdef1;
    const bands = [55, 300, 1100, 3000].map((fc, i) => ({
      coef: Math.min(2 * Math.sin((Math.PI * fc) / sr), 1.2),
      damp: 0.6 + 0.1 * i,
      gain: [1, 0.8, 0.6, 0.5][i]!,
      depth: 0.3 + 0.2 * i,
      rate: (3 + i) / sr,
    }));
    const mix = { len: 0.8 * sr, att: 1200, low: 0.6, hold: 0.65, gain: 0.9 };
    const constant = (value: number) => ({ kind: 'constant' as const, value });
    const doc: FunctionGraphDocument = {
      schema: 'typeaudio.function-graph',
      version: 1,
      modules: { [NOISE_MODULE]: NOISE_SOURCE, [ROAR_MODULE]: ROAR_SOURCE },
      definitions: [ROAR_BAND_DEFINITION, ROAR_MIX_DEFINITION],
      nodes: [
        ...bands.map((b, i) => ({
          id: `band${i}`,
          definition: 'roarBand',
          inputs: {
            key: constant((key ^ (201 + i)) >>> 0),
            coef: constant(b.coef),
            damp: constant(b.damp),
            gain: constant(b.gain),
            depth: constant(b.depth),
            rate: constant(b.rate),
          },
        })),
        {
          id: 'mix',
          definition: 'roarMix',
          inputs: {
            ...Object.fromEntries(
              [0, 1, 2, 3].map((i) => [
                `b${i}`,
                { kind: 'connection' as const, node: `band${i}`, port: 'out' },
              ]),
            ),
            ...Object.fromEntries(Object.entries(mix).map(([k, v]) => [k, constant(v)])),
          },
        },
      ],
      parameters: [],
      output: { node: 'mix', port: 'out' },
    };
    const fn = run(doc, sr);
    const ref = new RefRoar().shape(key, mix.len, mix.att, mix.low, mix.hold, mix.gain);
    [ref.b0, ref.b1, ref.b2, ref.b3].forEach((band, i) => {
      const b = bands[i]!;
      band.set(b.coef, b.damp, b.gain, b.depth, b.rate);
    });
    expectSame(fn, () => ref.tick());
  });

  it('stones, as two clocks, five band nodes and a mix, sound as the kind does', () => {
    const sr = 48000;
    const key = 0x5eed123;
    const clock = {
      key,
      len: 0.6 * sr,
      rateA: 40 / sr,
      rateB: 80 / sr,
      rateC: 120 / sr,
      sizeLo: 0.05,
      sizeLog: Math.log(20),
      grow0: 1,
      grow1: 0.5,
      first: 0.4,
      firstSize: 0.5,
    };
    const bright = 0.6;
    const bands = [70, 180, 480, 1300, 3400].map((fc, i) => ({
      coef: Math.min(2 * Math.sin((Math.PI * fc) / sr), 1.2),
      damp: 0.5,
      keep: Math.exp(-1 / ((0.4 / (i + 1)) * sr)),
      ratio: fc / 54.6,
      edge: [0, 0.05, 0.15, 0.35, 0.6][i]!,
      gain: [1.6, 1.1, 0.9, 0.8, 0.7][i]!,
    }));
    const constant = (value: number) => ({ kind: 'constant' as const, value });
    const wire = (node: string) => ({ kind: 'connection' as const, node, port: 'out' });
    const clockInputs = (part: number) =>
      Object.fromEntries([
        ['part', constant(part)],
        ...Object.entries(clock).map(([k, v]) => [k, constant(v)]),
      ]);
    const doc: FunctionGraphDocument = {
      schema: 'typeaudio.function-graph',
      version: 1,
      modules: { [NOISE_MODULE]: NOISE_SOURCE, [STONES_MODULE]: STONES_SOURCE },
      definitions: [STONE_CLOCK_DEFINITION, STONE_BAND_DEFINITION, STONE_MIX_DEFINITION],
      nodes: [
        { id: 'level', definition: 'stoneClock', inputs: clockInputs(0) },
        { id: 'size', definition: 'stoneClock', inputs: clockInputs(1) },
        ...bands.map((b, i) => ({
          id: `band${i}`,
          definition: 'stoneBand',
          inputs: {
            amp: wire('level'),
            size: wire('size'),
            key: constant((key ^ (101 + i)) >>> 0),
            coef: constant(b.coef),
            damp: constant(b.damp),
            keep: constant(b.keep),
            ratio: constant(b.ratio),
            edge: constant(b.edge),
            gain: constant(b.gain),
            bright: constant(bright),
          },
        })),
        {
          id: 'mix',
          definition: 'stoneMix',
          inputs: Object.fromEntries([0, 1, 2, 3, 4].map((i) => [`b${i}`, wire(`band${i}`)])),
        },
      ],
      parameters: [],
      output: { node: 'mix', port: 'out' },
    };
    const fn = run(doc, sr);
    const ref = new RefStones().shape(
      key,
      clock.len,
      clock.rateA,
      clock.rateB,
      clock.rateC,
      clock.sizeLo,
      clock.sizeLog,
      clock.grow0,
      clock.grow1,
      bright,
      clock.first,
      clock.firstSize,
    );
    [ref.b0, ref.b1, ref.b2, ref.b3, ref.b4].forEach((band, i) => {
      const b = bands[i]!;
      band.set(b.coef, b.damp, b.keep, b.ratio, b.edge, b.gain);
    });
    expectSame(fn, () => ref.tick());
  });

  it('every event of the accepted wall hit, as function nodes, sounds as its lane does', () => {
    const sr = 48000;
    const events = wallHit.events as unknown as PlanEvent[];
    expect(events.length).toBe(12);
    for (const e of events) {
      const key = eventKey(11, e.id);
      const made = makeLane(e, { sr, key });
      const nodes = kindNodes(made, 'kind');
      const doc: FunctionGraphDocument = {
        schema: 'typeaudio.function-graph',
        version: 1,
        modules: nodes.modules,
        definitions: nodes.definitions,
        nodes: nodes.nodes,
        parameters: [],
        output: nodes.output,
      };
      const frames = Math.min(made.length, sr);
      const fn = run(doc, frames);
      const fresh = makeLane(e, { sr, key }) as { lane: Record<string, { tick(): number }> };
      const unit = Object.values(fresh.lane).find(
        (v) =>
          typeof v === 'object' &&
          v !== null &&
          typeof (v as { tick?: unknown }).tick === 'function',
      )!;
      expectSame(fn, () => unit.tick());
    }
  });
});
