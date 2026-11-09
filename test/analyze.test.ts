import { describe, expect, test } from 'vitest';
import plan from '../experiments/08-sound-design/plan.json';
import {
  channelCorrelation,
  checklist,
  detectOnsets,
  DIMENSIONS,
  eventSimilarity,
  integratedLoudness,
  loudnessContrast,
  loudnessCurve,
  mudShare,
  airShare,
  spectralTilt,
  syncErrors,
  truePeak,
} from '../src/analyze/index.ts';
import { validatePlan } from '../src/plan/index.ts';
import { fft64 } from '../experiments/03-fft/signals.ts';

// Each analyzer against a synthetic signal whose answer is known.

const FS = 48000;
const dbfs = (db: number) => 10 ** (db / 20);

function sine(freq: number, seconds: number, amp = 1, phase = 0, fs = FS) {
  const x = new Float32Array(Math.round(seconds * fs));
  for (let i = 0; i < x.length; i++) x[i] = amp * Math.sin(2 * Math.PI * freq * (i / fs) + phase);
  return x;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function white(n: number, seed: number) {
  const r = rng(seed);
  return Float32Array.from({ length: n }, () => 2 * r() - 1);
}

/** Noise whose power density falls as 1 / f^slope (slope 1 is pink), from random phases. */
function shaped(n: number, slope: number, seed: number) {
  const r = rng(seed);
  const z = new Float64Array(2 * n);
  for (let k = 1; k < n / 2; k++) {
    const a = 1 / k ** (slope / 2);
    const ph = 2 * Math.PI * r();
    z[2 * k] = a * Math.cos(ph);
    z[2 * k + 1] = a * Math.sin(ph);
  }
  const t = fft64(z, n, 'inverse');
  const out = new Float32Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(t[2 * i]!));
  for (let i = 0; i < n; i++) out[i] = t[2 * i]! / peak;
  return out;
}

describe('loudness', () => {
  test('a stereo 1 kHz sine at -23 dBFS reads -23 LUFS', () => {
    const s = sine(1000, 5, dbfs(-23));
    expect(integratedLoudness([s, s], FS)).toBeCloseTo(-23, 1);
  });
  test('the gate leaves out the silence', () => {
    const s = sine(1000, 5, dbfs(-23));
    const padded = new Float32Array(10 * FS);
    padded.set(s, 2 * FS);
    // Blocks that hold a part of the sine pass the gate, as BS.1770 says: the result is within 0.5 LU.
    expect(integratedLoudness([padded, padded], FS)).toBeCloseTo(-23, 0);
    expect(integratedLoudness([padded, padded], FS)).toBeGreaterThan(-23.5);
  });
  test('silence is -Infinity', () => {
    expect(integratedLoudness([new Float32Array(FS)], FS)).toBe(-Infinity);
  });
  test('the true peak of a sine between samples is its amplitude', () => {
    // Samples of a sine at fs/4 with phase 45 degrees are +-0.7071 and never reach 1.
    // A fade at both ends keeps the step of a cut-off sine from ringing above its amplitude.
    const s = sine(FS / 4, 0.1, 1, Math.PI / 4);
    for (let i = 0; i < 480; i++) {
      const g = 0.5 - 0.5 * Math.cos((Math.PI * i) / 480);
      s[i]! *= g;
      s[s.length - 1 - i]! *= g;
    }
    const samplePeak = 20 * Math.log10(Math.max(...s.map(Math.abs)));
    expect(samplePeak).toBeCloseTo(-3.01, 1);
    expect(truePeak([s])).toBeCloseTo(0, 1);
  });
  test('the true peak of a sine at -6 dBFS on a sample is -6 dBTP', () => {
    expect(truePeak([sine(FS / 4, 0.1, dbfs(-6))])).toBeCloseTo(-6, 1);
  });
  test('the loudness curve and its contrast follow a step of 20 dB', () => {
    const x = new Float32Array(12 * FS);
    x.set(sine(1000, 6, dbfs(-40)), 0);
    x.set(sine(1000, 6, dbfs(-20)), 6 * FS);
    const curve = loudnessCurve([x], FS);
    expect(curve.length).toBe(10);
    expect(loudnessContrast(curve)).toBeCloseTo(20, 0);
    expect(loudnessContrast(loudnessCurve([sine(1000, 12, dbfs(-30))], FS))).toBeCloseTo(0, 1);
  });
});

describe('spectrum', () => {
  test('white noise has a tilt of 0 dB per octave and pink noise of -3', () => {
    expect(spectralTilt([white(FS * 2, 1)], FS)).toBeCloseTo(0, 0);
    expect(spectralTilt([shaped(2 ** 17, 1, 2)], FS)).toBeCloseTo(-3, 0);
  });
  test('a sine at 300 Hz is in the 200 to 400 Hz share, a sine at 12 kHz in the air share', () => {
    expect(mudShare([sine(300, 1)], FS)).toBeGreaterThan(0.95);
    expect(airShare([sine(300, 1)], FS)).toBeLessThan(0.001);
    expect(airShare([sine(12000, 1)], FS)).toBeGreaterThan(0.95);
  });
  test('the share of white noise is the share of its bandwidth', () => {
    expect(mudShare([white(FS * 2, 3)], FS)).toBeCloseTo(200 / 24000, 2);
    expect(airShare([white(FS * 2, 3)], FS)).toBeCloseTo(14000 / 24000, 2);
  });
});

describe('onsets and sync', () => {
  const clicks = [0.5, 1.2, 2.0, 2.31];
  const x = new Float32Array(3 * FS);
  for (const t of clicks) {
    const at = Math.round(t * FS);
    for (let i = 0; i < 400; i++) x[at + i] = Math.exp(-i / 60) * (i % 2 ? -1 : 1);
  }
  test('finds clicks at their known times, within 2 ms', () => {
    const found = detectOnsets([x], FS);
    expect(found.length).toBe(clicks.length);
    clicks.forEach((t, i) => expect(Math.abs(found[i]! - t)).toBeLessThan(0.002));
  });
  test('finds nothing in silence', () => {
    expect(detectOnsets([new Float32Array(FS)], FS)).toEqual([]);
  });
  test('the sync error is signed, in ms, and null beyond the distance', () => {
    const e = syncErrors([0.52, 1.17, 2.9], [0.5, 1.2, 2.0]);
    expect(e[0]!.errorMs).toBeCloseTo(20, 6);
    expect(e[1]!.errorMs).toBeCloseTo(-30, 6);
    expect(e[2]).toEqual({ onset: 2.9, picture: null, errorMs: null });
  });
});

describe('inter-channel correlation', () => {
  const a = white(FS, 4);
  test('identical, inverted and independent channels', () => {
    expect(channelCorrelation(a, a)).toBeCloseTo(1, 6);
    expect(
      channelCorrelation(
        a,
        a.map((v) => -v),
      ),
    ).toBeCloseTo(-1, 6);
    expect(Math.abs(channelCorrelation(a, white(FS, 5)))).toBeLessThan(0.02);
    expect(channelCorrelation(a, new Float32Array(FS))).toBe(0);
  });
});

describe('similarity', () => {
  const note = (freq: number) => {
    const x = new Float32Array(FS / 2);
    for (let i = 0; i < x.length; i++) {
      let v = 0;
      for (let h = 1; h <= 6; h++) v += Math.sin(2 * Math.PI * freq * h * (i / FS)) / h;
      x[i] = v * Math.exp(-i / 6000);
    }
    return x;
  };
  test('identical events read 1 and a pitch-shifted copy reads less', () => {
    const a = note(300);
    expect(eventSimilarity(a, a, FS).similarity).toBeCloseTo(1, 6);
    const shifted = eventSimilarity(a, note(450), FS);
    expect(shifted.envelope).toBeGreaterThan(0.95);
    expect(shifted.spectrum).toBeLessThan(0.8);
    expect(shifted.similarity).toBeLessThan(0.95);
  });
  test('events with other envelopes read less on the envelope', () => {
    const a = note(300);
    const b = a.map((v, i) => v * Math.exp(i / 6000) * Math.exp(-((i - 12000) ** 2) / 4e6));
    expect(eventSimilarity(a, b, FS).envelope).toBeLessThan(0.5);
  });
});

describe('the checklist report', { timeout: 60000 }, () => {
  const p = validatePlan(plan);
  const n = 30 * FS;
  const noise = white(n, 6).map((v) => v * 0.05);
  test('has the eight dimensions with measures and rules as data', () => {
    const report = checklist({ channels: [noise, noise], sampleRate: FS, plan: p });
    expect(Object.keys(report)).toEqual([...DIMENSIONS]);
    for (const d of DIMENSIONS) {
      for (const v of Object.values(report[d].measures))
        expect(v === null || typeof v === 'number').toBe(true);
      for (const r of report[d].rules) expect(['boolean', 'object']).toContain(typeof r.met);
    }
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });
  test('reads a one-layer render apart from a layered one', () => {
    const one = p.events.filter((e) => e.layer === 'ambience');
    const single = checklist({
      channels: [noise, noise],
      sampleRate: FS,
      plan: { ...p, events: one },
    });
    const layered = checklist({ channels: [noise, noise], sampleRate: FS, plan: p });
    expect(layered.layers.measures.eventsPerHero).toBeGreaterThanOrEqual(3);
    expect(layered.layers.rules[0]!.met).toBe(true);
    expect(single.layers.measures.eventsPerHero).toBeLessThan(3);
    expect(single.layers.rules[0]!.met).toBe(false);
  });
  test('reads the master of a known signal', () => {
    const s = sine(1000, 30, dbfs(-23));
    const r = checklist({ channels: [s, s], sampleRate: FS, plan: p });
    expect(r.master.measures.lufs).toBeCloseTo(-23, 1);
    expect(r.master.rules.find((x) => x.measure === 'lufs')!.met).toBe(true);
    expect(r.master.measures.clippedSamples).toBe(0);
    expect(r.space.measures.correlation).toBeCloseTo(1, 6);
    expect(r.space.rules[0]!.met).toBe(false);
  });
  test('reads the position of a pan that follows the plan', () => {
    const src = structuredClone(plan) as any;
    src.events = Array.from({ length: 8 }, (_, i) => ({
      id: `hit-${i}`,
      t: 1 + 3 * i,
      kind: 'impact',
      layer: 'effects',
      intensity: 0.5,
      position: { x: -0.9 + 0.257 * i, y: 0, distance: 5 },
      macros: {},
    }));
    const q = validatePlan(src);
    const L = new Float32Array(n);
    const R = new Float32Array(n);
    for (const e of q.events) {
      const at = Math.round(e.t * FS);
      const pan = (e.position.x + 1) / 2;
      for (let i = 0; i < 0.3 * FS; i++) {
        const v = 0.1 * Math.sin(2 * Math.PI * 500 * (i / FS));
        L[at + i] = v * (1 - pan);
        R[at + i] = v * pan;
      }
    }
    const followed = checklist({ channels: [L, R], sampleRate: FS, plan: q });
    expect(followed.position.measures.panCorrelation).toBeGreaterThan(0.95);
    expect(followed.position.rules[0]!.met).toBe(true);
    const centred = checklist({ channels: [L, L], sampleRate: FS, plan: q });
    expect(centred.position.measures.panCorrelation).toBeCloseTo(0, 6);
    expect(centred.position.rules[0]!.met).toBe(false);
  });
});

describe('the checklist with stems and a dry render', { timeout: 60000 }, () => {
  const p = validatePlan(plan);
  const n = 30 * FS;
  const dialogue = p.events.filter((e) => e.layer === 'dialogue');

  test('measures ducking in dB from the stems', () => {
    const first = dialogue[0]!;
    const at = Math.round(first.t * FS);
    const len = Math.round((first.duration ?? 1) * FS);
    const voice = new Float32Array(n);
    voice.set(sine(300, first.duration ?? 1, 0.1), at);
    const bed = sine(100, 30, 0.1);
    const ducked = bed.slice();
    for (let i = at; i < Math.min(n, at + len); i++) ducked[i]! *= 0.25; // -12 dB
    const stems = { dialogue: [voice, voice], ambience: [ducked, ducked] };
    const r = checklist({ channels: [ducked, ducked], sampleRate: FS, plan: p, stems });
    expect(r.dynamics.measures.duckingDb).toBeCloseTo(12, 0);
    const flat = checklist({
      channels: [bed, bed],
      sampleRate: FS,
      plan: p,
      stems: { dialogue: [voice, voice], ambience: [bed, bed] },
    });
    expect(flat.dynamics.measures.duckingDb).toBeCloseTo(0, 0);
    expect(r.dynamics.rules.find((x) => x.measure === 'duckingDb')!.met).toBe(true);
    expect(flat.dynamics.rules.find((x) => x.measure === 'duckingDb')!.met).toBe(false);
  });

  describe('the dip before an impact', () => {
    const src = structuredClone(plan) as any;
    src.events = [
      {
        id: 'hit',
        t: 5,
        kind: 'impact',
        layer: 'effects',
        intensity: 0.9,
        position: { x: 0, y: 0, distance: 5 },
        macros: {},
      },
    ];
    const q = validatePlan(src);
    const at = 5 * FS;
    const dip = (c: Parameters<typeof checklist>[0]) => checklist(c).dynamics.measures.dipDb;
    /** A bed at amplitude 0.1; `drop` multiplies it from 0.5 s before the impact. */
    const bed = (drop: number) => {
      const x = sine(100, 8, 0.1);
      for (let i = at - Math.round(0.5 * FS); i < x.length; i++) x[i]! *= drop;
      return x;
    };
    /** A whoosh that swells from silence to 0.2 over the 2 s before the impact. */
    const whoosh = () => {
      const x = sine(700, 8, 0.2);
      for (let i = 0; i < x.length; i++)
        x[i]! *= Math.min(1, Math.max(0, (i - (at - 2 * FS)) / (2 * FS)));
      return x;
    };
    const sum = (a: Float32Array, b: Float32Array) => a.map((v, i) => v + b[i]!);

    test('reads the layers other than the impact layer: a bed that ducks by 10 dB', () => {
      const ducked = bed(10 ** (-10 / 20));
      const tail = new Float32Array(ducked.length);
      const r = dip({
        channels: [sum(ducked, tail)],
        sampleRate: FS,
        plan: q,
        stems: { ambience: [ducked], effects: [tail] },
      });
      expect(r).toBeCloseTo(10, 0);
    });

    test('does not read the swell of a whoosh in the impact layer as a negative dip', () => {
      const flat = bed(1);
      const w = whoosh();
      const stems = { ambience: [flat], effects: [w] };
      const mix = sum(flat, w);
      expect(dip({ channels: [mix], sampleRate: FS, plan: q, stems })).toBeCloseTo(0, 0);
      const r = checklist({ channels: [mix], sampleRate: FS, plan: q, stems });
      expect(r.dynamics.rules.find((x) => x.measure === 'dipDb')!.met).toBe(false);
    });

    test('without stems reads the mix as before: the swell is a negative dip', () => {
      const mix = sum(bed(1), whoosh());
      expect(dip({ channels: [mix], sampleRate: FS, plan: q })!).toBeLessThan(-1);
    });

    test('reads null where the other layers are silent', () => {
      const w = whoosh();
      const r = checklist({
        channels: [w],
        sampleRate: FS,
        plan: q,
        stems: { effects: [w] },
      });
      expect(r.dynamics.measures.dipDb).toBeNull();
      expect(r.dynamics.rules.find((x) => x.measure === 'dipDb')!.met).toBeNull();
      const silent = new Float32Array(w.length);
      expect(
        dip({
          channels: [w],
          sampleRate: FS,
          plan: q,
          stems: { effects: [w], ambience: [silent] },
        }),
      ).toBeNull();
    });
  });

  test('measures the overlap of the layers bands', () => {
    const low = white(n, 1);
    const same = checklist({
      channels: [low, low],
      sampleRate: FS,
      plan: p,
      stems: { effects: [low, low], ambience: [low, low] },
    });
    expect(same.balance.measures.layerOverlap).toBeCloseTo(1, 6);
    const apart = checklist({
      channels: [low, low],
      sampleRate: FS,
      plan: p,
      stems: { effects: [sine(100, 30, 0.5)], ambience: [sine(8000, 30, 0.5)] },
    });
    expect(apart.balance.measures.layerOverlap!).toBeLessThan(0.1);
  });

  test('measures the reverb-to-direct ratio against the dry render', () => {
    const dry = sine(500, 30, 0.1);
    const wet = dry.map((v, i) => v + 0.1 * (dry[i - 480] ?? 0)); // -20 dB
    const r = checklist({ channels: [wet], sampleRate: FS, plan: p, dry: [dry] });
    expect(r.space.measures.reverbRatioDb).toBeCloseTo(-20, 0);
    const none = checklist({ channels: [dry], sampleRate: FS, plan: p, dry: [dry] });
    expect(none.space.rules.find((x) => x.measure === 'reverbRatioDb')!.met).toBe(false);
    expect(
      checklist({ channels: [dry], sampleRate: FS, plan: p }).space.measures.reverbRatioDb,
    ).toBeNull();
  });

  test('reads position on the layer stem, so an overlapping layer does not blur it', () => {
    const src = structuredClone(plan) as any;
    src.events = Array.from({ length: 6 }, (_, i) => ({
      id: `hit-${i}`,
      t: 1 + 3 * i,
      kind: 'impact',
      layer: 'effects',
      intensity: 0.5,
      position: { x: -0.9 + 0.36 * i, y: 0, distance: 5 },
      macros: {},
    }));
    const q = validatePlan(src);
    const L = new Float32Array(n);
    const R = new Float32Array(n);
    for (const e of q.events) {
      const at = Math.round(e.t * FS);
      const pan = (e.position.x + 1) / 2;
      for (let i = 0; i < 0.3 * FS; i++) {
        const v = 0.1 * Math.sin(2 * Math.PI * 500 * (i / FS));
        L[at + i] = v * (1 - pan);
        R[at + i] = v * pan;
      }
    }
    // A loud centred layer under every event: the mix reads as centred, the stem does not.
    const bed = sine(80, 30, 0.8);
    const mixL = L.map((v, i) => v + bed[i]!);
    const mixR = R.map((v, i) => v + bed[i]!);
    const blurred = checklist({ channels: [mixL, mixR], sampleRate: FS, plan: q });
    const stemmed = checklist({
      channels: [mixL, mixR],
      sampleRate: FS,
      plan: q,
      stems: { effects: [L, R], ambience: [bed, bed] },
    });
    expect(stemmed.position.measures.panCorrelation!).toBeGreaterThan(0.95);
    expect(blurred.position.measures.panCorrelation!).toBeLessThan(
      stemmed.position.measures.panCorrelation!,
    );
  });
});
