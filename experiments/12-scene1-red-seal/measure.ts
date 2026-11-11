// The measures of experiment 12: a render against another, as experiment 9 measured its passage
// against the study's. The level each two frames, five bands in each section, and the time of each
// anchored onset.
//
//   bun experiments/12-scene1-red-seal/measure.ts <a.wav> <b.wav> [--from 20] [--to 30] [--offset-b 0]
//
// `--from` and `--to` are picture seconds; each file starts at its own picture second
// (`--start-a`, `--start-b`, default 20 for the study's red passage).

import { readFileSync } from 'node:fs';
import { rfft } from '../../src/study/fft.ts';
import type { Stereo } from '../../src/study/dsp.ts';

export const SR = 48000;
/** One picture frame: 24000/1001 frames a second. */
export const FRAME = 1001 / 24000;

/** A WAV file of 16, 24 or 32-bit integer or 32-bit float samples, as two channels. */
export function readWav(path: string): Stereo {
  const b = readFileSync(path);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let o = 12;
  let fmt = 1;
  let ch = 2;
  let bits = 16;
  while (o < b.length - 8) {
    const id = b.toString('ascii', o, o + 4);
    const size = v.getUint32(o + 4, true);
    if (id === 'fmt ') {
      fmt = v.getUint16(o + 8, true);
      ch = v.getUint16(o + 10, true);
      bits = v.getUint16(o + 22, true);
    } else if (id === 'data') {
      const bps = bits / 8;
      const n = Math.floor(size / (bps * ch));
      const out: Stereo = [new Float64Array(n), new Float64Array(n)];
      for (let i = 0; i < n; i++)
        for (let c = 0; c < 2; c++) {
          const p = o + 8 + (i * ch + Math.min(c, ch - 1)) * bps;
          let x: number;
          if (fmt === 3) x = v.getFloat32(p, true);
          else if (bits === 16) x = v.getInt16(p, true) / 32768;
          else if (bits === 24)
            x =
              ((v.getUint8(p) | (v.getUint8(p + 1) << 8) | (v.getInt8(p + 2) << 16)) >> 0) /
              8388608;
          else x = v.getInt32(p, true) / 2147483648;
          out[c][i] = x;
        }
      return out;
    }
    o += 8 + size + (size % 2);
  }
  throw new Error(`readWav: no data in ${path}`);
}

const mono = (x: Stereo): Float64Array => x[0].map((v, i) => (v + x[1][i]!) / 2);

/** RMS in dBFS of both channels over [a, b) samples. */
export function rmsDb(x: Stereo, a: number, b: number): number {
  let e = 0;
  let n = 0;
  for (const c of x)
    for (let i = Math.max(0, a); i < Math.min(c.length, b); i++) {
      e += c[i]! * c[i]!;
      n++;
    }
  return 10 * Math.log10(Math.max(e / Math.max(1, n), 1e-14));
}

export const BANDS: readonly (readonly [number, number])[] = [
  [30, 120],
  [120, 500],
  [500, 2000],
  [2000, 6000],
  [6000, 16000],
];

/** Five band levels (dB) of the mono sum over [a, b), from one Hann-windowed spectrum. */
export function bandLevels(x: Stereo, a: number, b: number): number[] {
  const m = mono(x).subarray(Math.max(0, a), b);
  const n = m.length;
  const w = m.map((v, i) => v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n)));
  const [re, im] = rfft(w);
  return BANDS.map(([lo, hi]) => {
    let e = 0;
    for (let k = 0; k < re.length; k++) {
      const f = (k * SR) / n;
      if (f >= lo && f < hi) e += re[k]! ** 2 + im[k]! ** 2;
    }
    return 10 * Math.log10(Math.max(e / n, 1e-20));
  });
}

/** The energy of the mono sum in 1 ms steps over 2.5 ms frames, dB, from sample a for n steps. */
function envelope(x: Stereo, a: number, n: number): Float64Array {
  const m = mono(x);
  const e = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    let q = 0;
    const s = a + 48 * j;
    for (let i = Math.max(0, s); i < Math.min(m.length, s + 120); i++) q += m[i]! * m[i]!;
    e[j] = 10 * Math.log10(q / 120 + 1e-14);
  }
  return e;
}

/**
 * The lag of b against a around an anchor, seconds: the shift within +-maxLag of b's energy
 * envelope that best matches a's over 60 ms before and 120 ms after the anchor. A positive lag
 * means b's event comes later. Returns the lag and the rise of a's envelope at the anchor (dB over
 * the 20 ms before it).
 */
export function lag(
  a: Stereo,
  b: Stereo,
  atA: number,
  atB: number,
  maxLag = 0.02,
): { lag: number; rise: number } {
  const L = Math.round(maxLag * 1000);
  const ea = envelope(a, Math.round((atA - 0.06) * SR), 180);
  const eb = envelope(b, Math.round((atB - 0.06 - maxLag) * SR), 180 + 2 * L);
  let best = 0;
  let score = Infinity;
  for (let k = -L; k <= L; k++) {
    let d = 0;
    for (let j = 0; j < 180; j++) d += Math.abs(ea[j]! - eb[j + k + L]!);
    if (d < score) {
      score = d;
      best = k;
    }
  }
  const before = ea.slice(40, 60).reduce((p, q) => p + q, 0) / 20;
  const after = Math.max(...ea.slice(60, 70));
  return { lag: best / 1000, rise: after - before };
}

export interface Section {
  readonly name: string;
  readonly from: number;
  readonly to: number;
}

/** The sections of the study's red passage, picture seconds. */
export const RED_SECTIONS: readonly Section[] = [
  { name: 'flight', from: 20.0, to: 22.3 },
  { name: 'flame', from: 22.31, to: 22.79 },
  { name: 'gather', from: 23.06, to: 23.77 },
  { name: 'cracks', from: 23.81, to: 24.65 },
  { name: 'shell', from: 24.75, to: 25.69 },
  { name: 'rays', from: 25.78, to: 26.31 },
  { name: 'ice', from: 26.32, to: 26.61 },
  { name: 'ice-stands', from: 26.62, to: 28.5 },
  { name: 'smoke', from: 28.53, to: 30.0 },
];

/** The anchored onsets of the red passage, picture seconds. */
export const RED_ONSETS: readonly (readonly [string, number])[] = [
  ['spark-hit1', 21.12],
  ['spark-hit2', 21.8],
  ['rock-burst', 21.98],
  ['flame', 22.31],
  ['target-strike', 23.7],
  ['shell-fracture', 25.692333],
  ['release', 25.77575],
  ['ice', 26.317958],
  ['ice-flash', 26.5265],
];

export interface Comparison {
  readonly frames: { t: number; a: number; b: number }[];
  readonly sections: { name: string; a: number[]; b: number[]; rmsA: number; rmsB: number }[];
  readonly onsets: { name: string; anchor: number; lag: number; rise: number }[];
}

/** Two renders that start at picture seconds `startA` and `startB`, compared over [from, to). */
export function compare(
  a: Stereo,
  b: Stereo,
  {
    startA = 20,
    startB = 20,
    from = 20,
    to = 30,
    sections = RED_SECTIONS,
    onsets = RED_ONSETS,
  } = {},
): Comparison {
  const sa = (t: number) => Math.round((t - startA) * SR);
  const sb = (t: number) => Math.round((t - startB) * SR);
  const frames: Comparison['frames'] = [];
  for (let t = from; t + 2 * FRAME <= to + 1e-9; t += 2 * FRAME)
    frames.push({
      t,
      a: rmsDb(a, sa(t), sa(t + 2 * FRAME)),
      b: rmsDb(b, sb(t), sb(t + 2 * FRAME)),
    });
  return {
    frames,
    sections: sections.map((s) => ({
      name: s.name,
      a: bandLevels(a, sa(s.from), sa(s.to)),
      b: bandLevels(b, sb(s.from), sb(s.to)),
      rmsA: rmsDb(a, sa(s.from), sa(s.to)),
      rmsB: rmsDb(b, sb(s.from), sb(s.to)),
    })),
    onsets: onsets.map(([name, at]) => ({
      name,
      anchor: at,
      ...lag(a, b, at - startA, at - startB),
    })),
  };
}

/** The comparison as text, with the summary statistics of each measure. */
export function report(c: Comparison, labelA = 'a', labelB = 'b'): string {
  const lines: string[] = [];
  const d = c.frames.map((f) => f.a - f.b);
  const absd = d.map(Math.abs).sort((p, q) => p - q);
  const mean = d.reduce((s, v) => s + v, 0) / d.length;
  lines.push(
    `level each two frames (${d.length} windows), ${labelA} - ${labelB}: mean ${mean.toFixed(2)} dB, median |d| ${absd[Math.floor(absd.length / 2)]!.toFixed(2)} dB, 90 % |d| ${absd[Math.floor(absd.length * 0.9)]!.toFixed(2)} dB, max |d| ${absd[absd.length - 1]!.toFixed(2)} dB`,
  );
  lines.push(
    `sections: rms ${labelA} / ${labelB} dB; bands 30-120, 120-500, 500-2k, 2k-6k, 6k-16k: ${labelA} - ${labelB} dB`,
  );
  for (const s of c.sections)
    lines.push(
      `  ${s.name.padEnd(11)} ${s.rmsA.toFixed(1).padStart(6)} / ${s.rmsB.toFixed(1).padStart(6)}   ${s.a.map((v, i) => (v - s.b[i]!).toFixed(1).padStart(5)).join(' ')}`,
    );
  lines.push(
    `onsets: lag of ${labelB} against ${labelA} (ms; + is later), rise of ${labelA} at the anchor (dB)`,
  );
  for (const o of c.onsets)
    lines.push(
      `  ${o.name.padEnd(15)} ${(o.lag * 1000).toFixed(0).padStart(4)} ms  ${o.rise.toFixed(1).padStart(5)} dB`,
    );
  return lines.join('\n');
}

if (import.meta.main) {
  const arg = (name: string, def: number) => {
    const at = process.argv.indexOf(`--${name}`);
    return at < 0 ? def : Number(process.argv[at + 1]);
  };
  const [pa, pb] = process.argv.slice(2).filter((s) => s.endsWith('.wav'));
  const c = compare(readWav(pa!), readWav(pb!), {
    startA: arg('start-a', 20),
    startB: arg('start-b', 20),
    from: arg('from', 20),
    to: arg('to', 30),
  });
  console.log(report(c, 'a', 'b'));
}
