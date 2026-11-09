// The checklist of docs/sound-design-loop.md: eight dimensions, each with its measures and the rules
// it is held to, as data. The rule thresholds are starting values, held in `DEFAULT_RULES`, that the
// runs of experiment 8 will fit. A measure that the render alone cannot give reads null.

import { eventSpan } from '../plan/types.ts';
import type { PlanEvent, SoundPlan } from '../plan/types.ts';
import { mono } from './dsp.ts';
import { channelCorrelation } from './correlation.ts';
import { integratedLoudness, loudnessContrast, loudnessCurve, truePeak } from './loudness.ts';
import { detectOnsets, syncErrors } from './onsets.ts';
import { eventSimilarity } from './similarity.ts';
import { airShare, mudShare, spectralTilt } from './spectrum.ts';

export const DIMENSIONS = [
  'layers',
  'dynamics',
  'balance',
  'space',
  'position',
  'sync',
  'variation',
  'master',
] as const;
export type DimensionName = (typeof DIMENSIONS)[number];

/** One rule: the measure it holds, its bounds (null is open) and whether the measure is inside them. */
export interface Rule {
  measure: string;
  min: number | null;
  max: number | null;
  unit: string;
  /** null when the measure is null. */
  met: boolean | null;
}

export interface Dimension {
  measures: Record<string, number | null>;
  rules: Rule[];
}

export type ChecklistReport = Record<DimensionName, Dimension>;

export interface ChecklistInput {
  /** The render: one channel (mono) or two (left, right). */
  channels: readonly Float32Array[];
  sampleRate: number;
  plan: SoundPlan;
  /** Cuts and motion peaks in seconds. Default: `plan.picture`. */
  picture?: readonly number[];
}

/** The bounds of each rule. */
export const DEFAULT_RULES = {
  layersPerHero: [3, 7],
  heroIntensity: 0.8,
  heroWindow: 0.1,
  contrastLu: [6, null],
  dipDb: [3, null],
  tiltDbPerOctave: [-6, -1],
  mudShare: [null, 0.3],
  airShare: [0.0005, null],
  correlation: [null, 0.9],
  panCorrelation: [0.7, null],
  syncMs: [null, 42],
  similarity: [null, 0.95],
  lufsTolerance: 1,
  crestDb: [6, 20],
} as const;

const rule = (
  measure: string,
  value: number | null,
  min: number | null,
  max: number | null,
  unit: string,
): Rule => ({
  measure,
  min,
  max,
  unit,
  met: value === null ? null : (min === null || value >= min) && (max === null || value <= max),
});

const finite = (v: number): number | null => (Number.isFinite(v) ? v : null);

/** RMS in dB of `x` between `from` and `to` seconds. */
function levelDb(x: Float64Array, sampleRate: number, from: number, to: number): number | null {
  const a = Math.max(0, Math.round(from * sampleRate));
  const b = Math.min(x.length, Math.round(to * sampleRate));
  if (b - a < 1) return null;
  let s = 0;
  for (let i = a; i < b; i++) s += x[i]! * x[i]!;
  return s > 0 ? 10 * Math.log10(s / (b - a)) : -120;
}

function slice(x: Float32Array, sampleRate: number, from: number, length: number): Float32Array {
  const a = Math.max(0, Math.round(from * sampleRate));
  return x.slice(a, Math.min(x.length, a + Math.round(length * sampleRate)));
}

/** The window of an event in the render: its span, or `fallback` seconds for a point. */
const window = (e: PlanEvent, fallback: number) => {
  const { start, end } = eventSpan(e);
  return { start, length: Math.max(end - start, fallback) };
};

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)]! : NaN;
};

/** Scores a render against the eight dimensions. */
export function checklist(input: ChecklistInput): ChecklistReport {
  const { channels, sampleRate, plan } = input;
  const R = DEFAULT_RULES;
  const events = plan.events;
  const m = mono(channels);
  const stereo = channels.length >= 2;

  // layers: what sounds within heroWindow seconds of a hero event.
  const top = Math.max(...events.map((e) => e.intensity));
  const heroes = events.filter((e) => e.intensity >= Math.min(R.heroIntensity, top));
  const stacks = heroes.map((h) => {
    const t = h.t;
    const near = events.filter((e) => {
      const s = eventSpan(e);
      return s.start <= t + R.heroWindow && s.end >= t - R.heroWindow;
    });
    return { events: near.length, layers: new Set(near.map((e) => e.layer)).size };
  });
  const layers: Dimension = {
    measures: {
      heroEvents: heroes.length,
      eventsPerHero: finite(median(stacks.map((s) => s.events))),
      layersPerHero: finite(median(stacks.map((s) => s.layers))),
    },
    rules: [],
  };
  layers.rules.push(
    rule(
      'eventsPerHero',
      layers.measures.eventsPerHero!,
      R.layersPerHero[0],
      R.layersPerHero[1],
      'events',
    ),
  );

  // dynamics: the contrast of the short-term curve, and the dip before each impact.
  const curve = loudnessCurve(channels, sampleRate);
  const dips: number[] = [];
  for (const e of events.filter(
    (v) => v.kind === 'impact' && v.intensity >= Math.min(R.heroIntensity, top),
  )) {
    const { start } = eventSpan(e);
    const before = levelDb(m, sampleRate, start - 2, start - 0.5);
    const lead = levelDb(m, sampleRate, start - 0.5, start - 0.05);
    if (start >= 2 && before !== null && lead !== null) dips.push(before - lead);
  }
  const dynamics: Dimension = {
    measures: {
      contrastLu: finite(loudnessContrast(curve)),
      dipDb: dips.length ? dips.reduce((s, v) => s + v, 0) / dips.length : null,
      duckingDb: null,
    },
    rules: [],
  };
  dynamics.rules.push(
    rule('contrastLu', dynamics.measures.contrastLu!, R.contrastLu[0], R.contrastLu[1], 'LU'),
    rule('dipDb', dynamics.measures.dipDb!, R.dipDb[0], R.dipDb[1], 'dB'),
  );

  // balance: tilt and the two shares. The overlap of the layers' bands needs stems: null.
  const balance: Dimension = {
    measures: {
      tiltDbPerOctave: finite(spectralTilt(channels, sampleRate)),
      mudShare: mudShare(channels, sampleRate),
      airShare: airShare(channels, sampleRate),
      layerOverlap: null,
    },
    rules: [],
  };
  balance.rules.push(
    rule(
      'tiltDbPerOctave',
      balance.measures.tiltDbPerOctave!,
      R.tiltDbPerOctave[0],
      R.tiltDbPerOctave[1],
      'dB/octave',
    ),
    rule('mudShare', balance.measures.mudShare!, R.mudShare[0], R.mudShare[1], '1'),
    rule('airShare', balance.measures.airShare!, R.airShare[0], R.airShare[1], '1'),
  );

  // space: the correlation of the pair. The reverb-to-direct ratio needs the dry render: null.
  const correlation = stereo ? channelCorrelation(channels[0]!, channels[1]!) : 1;
  const space: Dimension = {
    measures: { correlation, reverbRatio: null },
    rules: [rule('correlation', correlation, R.correlation[0], R.correlation[1], '1')],
  };

  // position: the balance of the render over each event against the event's screen x.
  const pan: number[] = [];
  const expected: number[] = [];
  if (stereo)
    for (const e of events) {
      const w = window(e, 0.3);
      const l = slice(channels[0]!, sampleRate, w.start, w.length);
      const r = slice(channels[1]!, sampleRate, w.start, w.length);
      let el = 0;
      let er = 0;
      for (let i = 0; i < l.length; i++) {
        el += l[i]! * l[i]!;
        er += r[i]! * r[i]!;
      }
      if (el + er > 0) {
        pan.push((Math.sqrt(er) - Math.sqrt(el)) / (Math.sqrt(er) + Math.sqrt(el)));
        expected.push(e.position.x);
      }
    }
  const spread = new Set(expected.map((v) => v.toFixed(3))).size;
  const panCorrelation =
    pan.length >= 3 && spread >= 2
      ? channelCorrelation(Float32Array.from(center(pan)), Float32Array.from(center(expected)))
      : null;
  const position: Dimension = {
    measures: { events: pan.length, panCorrelation },
    rules: [rule('panCorrelation', panCorrelation, R.panCorrelation[0], R.panCorrelation[1], '1')],
  };

  // sync: the onsets of the render against the cuts and motion peaks.
  const pictureTimes = input.picture ?? [...plan.picture.cuts, ...plan.picture.motion];
  const errors = syncErrors(detectOnsets(channels, sampleRate), pictureTimes).filter(
    (e) => e.errorMs !== null,
  );
  const abs = errors.map((e) => Math.abs(e.errorMs!));
  const sync: Dimension = {
    measures: {
      pictureTimes: pictureTimes.length,
      anchoredOnsets: errors.length,
      medianAbsErrorMs: abs.length ? median(abs) : null,
    },
    rules: [],
  };
  sync.rules.push(
    rule('medianAbsErrorMs', sync.measures.medianAbsErrorMs!, R.syncMs[0], R.syncMs[1], 'ms'),
  );

  // variation: the most similar pair among the events of one kind.
  let worst: number | null = null;
  const byKind = new Map<string, PlanEvent[]>();
  for (const e of events) byKind.set(e.kind, [...(byKind.get(e.kind) ?? []), e]);
  for (const group of byKind.values())
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++) {
        const a = window(group[i]!, 0.3);
        const b = window(group[j]!, 0.3);
        const length = Math.min(a.length, b.length, 1);
        const s = eventSimilarity(
          slice(Float32Array.from(m), sampleRate, a.start, length),
          slice(Float32Array.from(m), sampleRate, b.start, length),
          sampleRate,
        ).similarity;
        worst = worst === null ? s : Math.max(worst, s);
      }
  const variation: Dimension = {
    measures: { maxSimilarity: worst },
    rules: [rule('maxSimilarity', worst, R.similarity[0], R.similarity[1], '1')],
  };

  // master: LUFS against the plan's target, the true peak against its limit, the crest factor.
  const lufs = finite(integratedLoudness(channels, sampleRate));
  const tp = finite(truePeak(channels));
  let peak = 0;
  let clipped = 0;
  let sum = 0;
  let count = 0;
  for (const c of channels)
    for (let i = 0; i < c.length; i++) {
      const a = Math.abs(c[i]!);
      peak = Math.max(peak, a);
      if (a >= 1) clipped++;
      sum += c[i]! * c[i]!;
      count++;
    }
  const crest = peak > 0 && sum > 0 ? 20 * Math.log10(peak / Math.sqrt(sum / count)) : null;
  const master: Dimension = {
    measures: { lufs, truePeakDbtp: tp, crestDb: crest, clippedSamples: clipped },
    rules: [
      rule(
        'lufs',
        lufs,
        plan.master.lufs - R.lufsTolerance,
        plan.master.lufs + R.lufsTolerance,
        'LUFS',
      ),
      rule('truePeakDbtp', tp, null, plan.master.truePeak, 'dBTP'),
      rule('crestDb', crest, R.crestDb[0], R.crestDb[1], 'dB'),
      rule('clippedSamples', clipped, null, 0, 'samples'),
    ],
  };

  return { layers, dynamics, balance, space, position, sync, variation, master };
}

function center(v: number[]): number[] {
  const mean = v.reduce((s, x) => s + x, 0) / v.length;
  return v.map((x) => x - mean);
}
