// The checklist of docs/sound-design-loop.md: eight dimensions, each with its measures and the rules
// it is held to, as data. The rule thresholds are starting values, held in `DEFAULT_RULES`, that the
// runs of experiment 8 will fit. A measure that the render alone cannot give reads null.

import { eventSpan } from '../plan/types.ts';
import type { PlanEvent, PlanLayer, SoundPlan } from '../plan/types.ts';
import { bands, mono, powerSpectrum } from './dsp.ts';
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
  /**
   * The layers as separate stems, each one channel (mono) or two (left, right), at the render's
   * sample rate. A layer a plan does not use may be absent. With stems, `position` and `variation`
   * read each event on its own layer's stem, and the checklist measures `duckingDb` and
   * `layerOverlap`.
   */
  stems?: Partial<Record<PlanLayer, readonly Float32Array[]>>;
  /**
   * The mix of the same events without the reverb send, scaled by the master's gain, one channel or
   * two. With it, the checklist measures `reverbRatioDb`: the energy of `channels - dry` over the
   * energy of `dry`, in dB.
   */
  dry?: readonly Float32Array[];
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
  duckingDb: [3, null],
  layerOverlap: [null, 0.7],
  reverbRatioDb: [-20, 0],
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

/** The energy of a stem over `[from, to)` seconds, summed over its channels, per frame. */
function stemEnergy(
  stem: readonly Float32Array[],
  sampleRate: number,
  from: number,
  to: number,
): number {
  const a = Math.max(0, Math.round(from * sampleRate));
  const b = Math.min(stem[0]?.length ?? 0, Math.round(to * sampleRate));
  if (b - a < 1) return 0;
  let s = 0;
  for (const c of stem) for (let i = a; i < b; i++) s += c[i]! * c[i]!;
  return s / (b - a);
}

/** The overlap of two band-density profiles: the sum of the smaller share of each band. */
function bandOverlap(a: readonly number[], b: readonly number[]): number {
  const sa = a.reduce((s, v) => s + v, 0);
  const sb = b.reduce((s, v) => s + v, 0);
  if (sa <= 0 || sb <= 0) return NaN;
  let o = 0;
  for (let i = 0; i < a.length; i++) o += Math.min(a[i]! / sa, b[i]! / sb);
  return o;
}

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
  const stems = input.stems;
  /** The stem of an event's layer, or the render where no stem is given. */
  const source = (e: PlanEvent): readonly Float32Array[] => stems?.[e.layer] ?? channels;

  // dynamics: ducking. For each dialogue event, the energy of the other stems in the second before
  // the event against the energy during it, in dB, over the events whose stem sounds.
  function duckingDb(): number | null {
    if (stems?.dialogue === undefined) return null;
    const others = (Object.keys(stems) as PlanLayer[]).filter((l) => l !== 'dialogue');
    const drops: number[] = [];
    for (const e of events.filter((v) => v.layer === 'dialogue')) {
      const { start, end } = eventSpan(e);
      if (start < 1 || end <= start) continue;
      if (stemEnergy(stems.dialogue, sampleRate, start, end) <= 1e-12) continue;
      let before = 0;
      let during = 0;
      for (const l of others) {
        before += stemEnergy(stems[l]!, sampleRate, start - 1, start);
        during += stemEnergy(stems[l]!, sampleRate, start, end);
      }
      if (before > 0 && during > 0) drops.push(10 * Math.log10(before / during));
    }
    return drops.length ? drops.reduce((s, v) => s + v, 0) / drops.length : null;
  }

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
      duckingDb: duckingDb(),
    },
    rules: [],
  };
  dynamics.rules.push(
    rule('contrastLu', dynamics.measures.contrastLu!, R.contrastLu[0], R.contrastLu[1], 'LU'),
    rule('dipDb', dynamics.measures.dipDb!, R.dipDb[0], R.dipDb[1], 'dB'),
  );
  if (stems?.dialogue !== undefined)
    dynamics.rules.push(
      rule('duckingDb', dynamics.measures.duckingDb, R.duckingDb[0], R.duckingDb[1], 'dB'),
    );

  // balance: tilt, the two shares and, with stems, the overlap of the layers' bands.
  function layerOverlap(): number | null {
    if (stems === undefined) return null;
    const profiles: number[][] = [];
    for (const l of Object.keys(stems) as PlanLayer[]) {
      const x = mono(stems[l]!);
      if (stemEnergy(stems[l]!, sampleRate, 0, x.length / sampleRate) <= 1e-12) continue;
      profiles.push(bands(powerSpectrum(x), sampleRate).map((b) => b.density));
    }
    const values: number[] = [];
    for (let i = 0; i < profiles.length; i++)
      for (let j = i + 1; j < profiles.length; j++)
        values.push(bandOverlap(profiles[i]!, profiles[j]!));
    return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
  }
  const balance: Dimension = {
    measures: {
      tiltDbPerOctave: finite(spectralTilt(channels, sampleRate)),
      mudShare: mudShare(channels, sampleRate),
      airShare: airShare(channels, sampleRate),
      layerOverlap: layerOverlap(),
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
  if (stems !== undefined)
    balance.rules.push(
      rule(
        'layerOverlap',
        balance.measures.layerOverlap,
        R.layerOverlap[0],
        R.layerOverlap[1],
        '1',
      ),
    );

  // space: the correlation of the pair and, with the dry render, the reverb-to-direct ratio.
  const correlation = stereo ? channelCorrelation(channels[0]!, channels[1]!) : 1;
  let reverbRatioDb: number | null = null;
  if (input.dry !== undefined) {
    let wet = 0;
    let direct = 0;
    for (let c = 0; c < channels.length; c++) {
      const d = input.dry[Math.min(c, input.dry.length - 1)]!;
      for (let i = 0; i < channels[c]!.length; i++) {
        const w = channels[c]![i]! - (d[i] ?? 0);
        wet += w * w;
        direct += (d[i] ?? 0) * (d[i] ?? 0);
      }
    }
    reverbRatioDb = direct > 0 ? 10 * Math.log10(Math.max(wet, 1e-20) / direct) : null;
  }
  const space: Dimension = {
    measures: { correlation, reverbRatioDb },
    rules: [rule('correlation', correlation, R.correlation[0], R.correlation[1], '1')],
  };
  if (input.dry !== undefined)
    space.rules.push(
      rule('reverbRatioDb', reverbRatioDb, R.reverbRatioDb[0], R.reverbRatioDb[1], 'dB'),
    );

  // position: the balance of the render over each event against the event's screen x.
  const pan: number[] = [];
  const expected: number[] = [];
  for (const e of events) {
    const src = source(e);
    if (src.length < 2) continue;
    const w = window(e, 0.3);
    const l = slice(src[0]!, sampleRate, w.start, w.length);
    const r = slice(src[1]!, sampleRate, w.start, w.length);
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
  let mix32: Float32Array | undefined;
  const monoOf = new Map<PlanLayer, Float32Array>();
  const monoSource = (e: PlanEvent): Float32Array => {
    if (stems?.[e.layer] === undefined) return (mix32 ??= Float32Array.from(m));
    if (!monoOf.has(e.layer)) monoOf.set(e.layer, Float32Array.from(mono(stems[e.layer]!)));
    return monoOf.get(e.layer)!;
  };
  for (const group of byKind.values())
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++) {
        const a = window(group[i]!, 0.3);
        const b = window(group[j]!, 0.3);
        const length = Math.min(a.length, b.length, 1);
        const s = eventSimilarity(
          slice(monoSource(group[i]!), sampleRate, a.start, length),
          slice(monoSource(group[j]!), sampleRate, b.start, length),
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
