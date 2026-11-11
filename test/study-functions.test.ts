// The study's models as typed functions (`src/kinds/functions/study.ts`) against the study's models
// themselves. A function draws other random numbers than numpy, so samples cannot agree; the fixture
// `test/fixtures/study-functions.json` (written by
// `experiments/12-scene1-red-seal/parity/function_fixtures.py` from the study's scripts at commit
// `07670c9`, with numpy's own generator) holds measures that do not depend on them, each averaged
// over 24 seeds here and there:
//
// - the share of each octave band in the energy: within 3 dB in every band that holds at least
//   1/30 of the energy (-15 dB), and 4 dB in the octave at 16 kHz, where the bilinear form of
//   the study's low pass falls toward the Nyquist frequency;
// - for a sound that decays, the level in 20 ms frames against the highest: within 3 dB in every
//   frame down to -30 dB;
// - for the three parts of the red material, which the passage adds in fixed proportions, the RMS
//   level: within 1.5 dB.

import { describe, expect, it } from 'vitest';
import { compileFunctionGraph } from '../src/function-graph/compiler/index.ts';
import { FunctionGraphDsp } from '../src/function-graph/runtime/index.ts';
import type { FunctionDefinition, FunctionGraphDocument } from '../src/function-graph/types.ts';
import { NOISE_MODULE, NOISE_SOURCE } from '../src/kinds/functions/impact.ts';
import {
  RED_CRACKLE_DEFINITION,
  RED_ROAR_DEFINITION,
  RED_RUMBLE_DEFINITION,
  STUDY_BOOM_DEFINITION,
  STUDY_BURST_DEFINITION,
  STUDY_MODULE,
  STUDY_SLIP_DEFINITION,
  STUDY_SOURCE,
  boomGains,
} from '../src/kinds/functions/study.ts';
import { rfft } from '../src/study/fft.ts';
import fixture from './fixtures/study-functions.json';

interface Measure {
  shares: number[];
  env: number[];
  rms: number;
}
const want = fixture as unknown as Record<string, Measure>;
const SR = 48000;
const CENTRES = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const KEYS = Array.from({ length: 24 }, (_, k) => ((11 + 12 * k) * 0x9e3779b9) >>> 0);

function render(
  definition: FunctionDefinition,
  inputs: Record<string, number>,
  frames: number,
): Float64Array {
  const doc: FunctionGraphDocument = {
    schema: 'typeaudio.function-graph',
    version: 1,
    modules: { [NOISE_MODULE]: NOISE_SOURCE, [STUDY_MODULE]: STUDY_SOURCE },
    definitions: [definition],
    nodes: [
      {
        id: 'model',
        definition: definition.id,
        inputs: Object.fromEntries(
          Object.entries(inputs).map(([k, v]) => [k, { kind: 'constant', value: v }]),
        ),
      },
    ],
    parameters: [],
    output: { node: 'model', port: 'out' },
  };
  const program = compileFunctionGraph(doc);
  for (const artifact of program.artifacts) new Function(artifact.code)();
  const dsp = new FunctionGraphDsp(program);
  const pcm = new Float64Array(frames);
  const out = new Float32Array(128);
  for (let at = 0; at < frames; at += 128) {
    const n = Math.min(128, frames - at);
    if (!dsp.process(out, n)) throw dsp.fault;
    for (let i = 0; i < n; i++) pcm[at + i] = out[i]!;
  }
  return pcm;
}

function measure(xs: Float64Array[]): Measure {
  const shares = new Float64Array(CENTRES.length);
  let env: Float64Array | undefined;
  let rms = 0;
  for (const x of xs) {
    const [re, im] = rfft(x);
    let total = 0;
    const e = new Float64Array(CENTRES.length);
    for (let k = 1; k < re.length; k++) {
      const p = re[k]! ** 2 + im[k]! ** 2;
      total += p;
      const f = (k * SR) / x.length;
      CENTRES.forEach((c, j) => {
        if (f >= c / Math.SQRT2 && f < c * Math.SQRT2) e[j] = e[j]! + p;
      });
    }
    e.forEach((v, j) => (shares[j] = shares[j]! + v / total));
    const k = 960;
    const fr = new Float64Array(Math.floor(x.length / k));
    for (let j = 0; j < fr.length; j++) {
      let s = 0;
      for (let i = j * k; i < j * k + k; i++) s += x[i]! ** 2;
      fr[j] = s / k;
    }
    env = env ? env.map((v, j) => v + (fr[j] ?? 0)) : fr;
    rms += x.reduce((s, v) => s + v * v, 0) / x.length;
  }
  const emax = Math.max(...env!);
  return {
    shares: Array.from(shares, (v) => 10 * Math.log10(v / xs.length + 1e-20)),
    env: Array.from(env!, (v) => 10 * Math.log10(v / emax + 1e-20)),
    rms: 10 * Math.log10(rms / xs.length),
  };
}

function expectSpectrum(name: string, got: Measure): void {
  const w = want[name]!;
  w.shares.forEach((v, j) => {
    if (v < -15) return;
    const tolerance = CENTRES[j] === 16000 ? 4 : 3;
    expect(
      Math.abs(got.shares[j]! - v),
      `${name}: the octave at ${CENTRES[j]} Hz, ${got.shares[j]!.toFixed(1)} against ${v.toFixed(1)} dB`,
    ).toBeLessThanOrEqual(tolerance);
  });
}

function expectEnvelope(name: string, got: Measure): void {
  const w = want[name]!;
  w.env.forEach((v, j) => {
    if (v < -30 || j >= got.env.length) return;
    expect(
      Math.abs(got.env[j]! - v),
      `${name}: the frame ${j}, ${got.env[j]!.toFixed(1)} against ${v.toFixed(1)} dB`,
    ).toBeLessThanOrEqual(3);
  });
}

const seconds = 120_000;

describe("the study's models as typed functions", () => {
  it(
    'burst: a band of noise that decays',
    () => {
      for (const [name, lo, hi, tau, rise] of [
        ['burst-low', 35, 140, 0.08, 0.004],
        ['burst-mid', 200, 2000, 0.05, 0.0005],
      ] as const) {
        const n = Math.round(tau * 8 * SR);
        const m = measure(
          KEYS.map((key) => render(STUDY_BURST_DEFINITION, { key, lo, hi, tau, rise, gain: 1 }, n)),
        );
        expectSpectrum(name, m);
        expectEnvelope(name, m);
      }
    },
    seconds,
  );

  it(
    'boom: the body of a heavy hit',
    () => {
      const { aNoise, aTone } = boomGains(88, 0.16);
      const n = Math.round(0.16 * 7 * SR);
      const m = measure(
        KEYS.map((key) =>
          render(STUDY_BOOM_DEFINITION, { key, f: 88, tau: 0.16, aNoise, aTone }, n),
        ),
      );
      expectSpectrum('boom', m);
      expectEnvelope('boom', m);
    },
    seconds,
  );

  it(
    'groan and grind: stick and slip',
    () => {
      const groan = measure(
        KEYS.map((key) =>
          render(
            STUDY_SLIP_DEFINITION,
            {
              key,
              rLo: 110,
              rHi: 240,
              f0: 140,
              f1: 260,
              f2: 470,
              q: 2.5,
              jitter: 0.25,
              burst: 1,
              scrape: 0,
              len: 0.3 * SR,
              gain: 1,
            },
            0.4 * SR,
          ),
        ),
      );
      expectSpectrum('groan', groan);
      const grind = measure(
        KEYS.map((key) =>
          render(
            STUDY_SLIP_DEFINITION,
            {
              key,
              rLo: 60,
              rHi: 200,
              f0: 90,
              f1: 210,
              f2: 480,
              q: 2,
              jitter: 0.6,
              burst: 192,
              scrape: 3.0,
              len: 0.52 * SR,
              gain: 1,
            },
            0.62 * SR,
          ),
        ),
      );
      expectSpectrum('grind', grind);
    },
    seconds,
  );

  it(
    'the red material: rumble, roar and crackle',
    () => {
      for (const tension of [0.3, 0.8]) {
        for (const [name, def] of [
          ['rumble', RED_RUMBLE_DEFINITION],
          ['roar', RED_ROAR_DEFINITION],
          ['crackle', RED_CRACKLE_DEFINITION],
        ] as const) {
          const m = measure(KEYS.map((key) => render(def, { key, tension, gain: 1 }, SR)));
          const id = `${name}-${tension.toFixed(1)}`;
          expectSpectrum(id, m);
          expect(
            Math.abs(m.rms - want[id]!.rms),
            `${id}: RMS ${m.rms.toFixed(1)} against ${want[id]!.rms.toFixed(1)} dB`,
          ).toBeLessThanOrEqual(1.5);
        }
      }
    },
    seconds,
  );
});
