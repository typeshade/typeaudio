export const SAMPLE_RATE = 48000;
export const SHAPES = ['Sine', 'Saw', 'Square', 'Triangle'] as const;
export interface Patch {
  shapeA: number; shapeB: number; blend: number; frequency: number; transpose: number;
  detune: number; voices: number; spread: number; cutoff: number; resonance: number;
  filter: boolean; attack: number; decay: number; sustain: number; release: number;
  duration: number; drive: number; distortion: boolean; delay: boolean; delayTime: number;
  feedback: number; delayMix: number; reverb: boolean; room: number; reverbMix: number;
  volume: number;
}
export interface RenderRequest { patch: Patch; backend: 'cpu' | 'webgpu'; }
export const DEFAULT: Patch = {
  shapeA: 1, shapeB: 0, blend: 0.35, frequency: 220, transpose: 0,
  detune: 7, voices: 2, spread: 9, cutoff: 2200, resonance: 0.8,
  filter: true, attack: 0.02, decay: 0.25, sustain: 0.55, release: 0.35,
  duration: 1.5, drive: 1.4, distortion: true, delay: false, delayTime: 0.25,
  feedback: 0.35, delayMix: 0.3, reverb: false, room: 0.6, reverbMix: 0.25, volume: 0.4,
};
export const PRESETS: Record<string, { name: string; description: string; patch: Patch }> = {
  warm: { name: 'Warm lead', description: 'Saw + sine · soft filter', patch: { ...DEFAULT } },
  bass: { name: 'Sub bass', description: 'Low sine · short release', patch: { ...DEFAULT, shapeA: 0, shapeB: 2, frequency: 65.4, blend: 0.12, voices: 1, cutoff: 500, attack: 0.005, decay: 0.2, sustain: 0.7, release: 0.12, drive: 1.8 } },
  glass: { name: 'Glass keys', description: 'Sine fifth · echo & room', patch: { ...DEFAULT, shapeA: 0, shapeB: 0, transpose: 19, blend: 0.3, frequency: 329.63, voices: 1, cutoff: 8000, attack: 0.005, decay: 0.5, sustain: 0.05, release: 0.5, distortion: false, delay: true, reverb: true } },
  pad: { name: 'Slow pad', description: 'Detuned saws · long envelope', patch: { ...DEFAULT, shapeA: 1, shapeB: 1, blend: 0.5, detune: -9, voices: 4, spread: 22, cutoff: 1500, attack: 0.65, decay: 0.6, sustain: 0.7, release: 1.2, duration: 2, reverb: true, reverbMix: 0.4 } },
  pluck: { name: 'Resonant pluck', description: 'Triangle · sharp filter', patch: { ...DEFAULT, shapeA: 3, shapeB: 1, blend: 0.25, cutoff: 1300, resonance: 3.5, attack: 0.003, decay: 0.15, sustain: 0.02, release: 0.15, delay: true, feedback: 0.45 } },
  pulse: { name: 'Pulse stack', description: 'Square octaves · driven', patch: { ...DEFAULT, shapeA: 2, shapeB: 2, transpose: -12, blend: 0.4, voices: 2, frequency: 164.81, cutoff: 3200, resonance: 1.5, drive: 2.5, attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.25 } },
};
export const LIMITS: Record<string, [number, number]> = {
  shapeA:[0,3],shapeB:[0,3],blend:[0,1],frequency:[30,1200],transpose:[-24,24],
  detune:[-50,50],voices:[1,8],spread:[0,40],cutoff:[80,16000],resonance:[0.5,8],
  attack:[0.002,1],decay:[0.01,1.5],sustain:[0,1],release:[0.02,2],duration:[0.5,4],
  drive:[0.2,5],delayTime:[0.05,0.75],feedback:[0,0.75],delayMix:[0,0.7],
  room:[0.1,0.9],reverbMix:[0,0.7],volume:[0,0.7],
};
/** Strict validation for stored/imported patches and worker requests. */
export function validatePatch(value: unknown): Patch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('A patch must be an object.');
  const data = value as Record<string, unknown>;
  const result = { ...DEFAULT };
  for (const key of Object.keys(DEFAULT) as (keyof Patch)[]) {
    const v = data[key];
    if (typeof DEFAULT[key] === 'boolean') {
      if (typeof v !== 'boolean') throw new Error(`${key} must be on or off.`);
    } else {
      const [low, high] = LIMITS[key]!;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < low || v > high) throw new Error(`${key} must be between ${low} and ${high}.`);
      if (['shapeA','shapeB','voices','transpose'].includes(key) && !Number.isInteger(v)) throw new Error(`${key} must be a whole number.`);
    }
    (result as unknown as Record<string, unknown>)[key] = v;
  }
  return result;
}
export function envelopeAt(t: number, p: Patch): number {
  const held = (time: number): number => time < p.attack ? time / p.attack :
    time < p.attack + p.decay ? 1 - (1 - p.sustain) * (time - p.attack) / p.decay : p.sustain;
  return t < 0 ? 0 : t < p.duration ? held(t) : held(p.duration) * Math.max(0, 1 - (t - p.duration) / p.release);
}
/** Feedback delay on rendered PCM. The returned tail is bounded to two seconds. */
export function delayPcm(input: Float32Array, p: Patch, sr = SAMPLE_RATE): Float32Array {
  const out = new Float32Array(input.length + 2 * sr);
  const line = new Float32Array(Math.max(1, Math.round(p.delayTime * sr)));
  for (let i = 0; i < out.length; i++) {
    const dry = input[i] ?? 0, tap = line[i % line.length]!;
    line[i % line.length] = dry + tap * p.feedback;
    out[i] = dry * (1 - p.delayMix) + tap * p.delayMix;
  }
  return out;
}
/** Four damped combs followed by two allpasses: a small mono Schroeder room. */
export function reverbPcm(input: Float32Array, p: Patch, sr = SAMPLE_RATE): Float32Array {
  const out = new Float32Array(input.length + 2 * sr);
  const lengths = [0.0297,0.0371,0.0411,0.0437].map(t => Math.round(t * sr * (0.6 + p.room)));
  const lines = lengths.map(n => new Float32Array(n));
  const damp = new Float32Array(4);
  const allpasses = [0.005,0.0017].map(t => new Float32Array(Math.round(t * sr)));
  for (let i = 0; i < out.length; i++) {
    const dry = input[i] ?? 0;
    let wet = 0;
    lines.forEach((line, j) => {
      const tap = line[i % line.length]!;
      damp[j] = tap * 0.65 + damp[j]! * 0.35;
      line[i % line.length] = dry + damp[j]! * (0.55 + p.room * 0.35);
      wet += tap * 0.25;
    });
    for (const line of allpasses) {
      const tap = line[i % line.length]!;
      const next = tap - wet * 0.5;
      line[i % line.length] = wet + tap * 0.5;
      wet = next;
    }
    out[i] = dry * (1 - p.reverbMix) + wet * p.reverbMix;
  }
  return out;
}
/** Make the comparison and export the same length, with a short final tail fade. */
export function finishPcm(raw: Float32Array, p: Patch, sr = SAMPLE_RATE): { dry: Float32Array; wet: Float32Array } {
  let processed = raw.slice();
  if (p.delay) processed = delayPcm(processed, p, sr);
  if (p.reverb) processed = reverbPcm(processed, p, sr);
  const dry = new Float32Array(processed.length); dry.set(raw);
  const edge = Math.min(Math.round(sr * 0.03), processed.length);
  for (let i = 0; i < processed.length; i++) {
    dry[i]! *= p.volume;
    processed[i]! *= p.volume;
    if (i >= processed.length - edge) processed[i]! *= (processed.length - 1 - i) / edge;
  }
  return { dry, wet: processed };
}
/** A Hann-windowed FFT of a stable section, returned in dBFS. */
export function spectrum(samples: Float32Array): Float32Array {
  const n = 2048, real = new Float64Array(n), imag = new Float64Array(n);
  const start = Math.min(Math.floor(samples.length / 5), Math.max(0, samples.length - n));
  for (let i = 0; i < n; i++) real[i] = (samples[start + i] ?? 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)));
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [real[i], real[j]] = [real[j]!, real[i]!];
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = -2 * Math.PI / size;
    for (let at = 0; at < n; at += size) for (let j = 0; j < size / 2; j++) {
      const a = at + j, b = a + size / 2, c = Math.cos(angle * j), s = Math.sin(angle * j);
      const re = real[b]! * c - imag[b]! * s, im = real[b]! * s + imag[b]! * c;
      real[b] = real[a]! - re; imag[b] = imag[a]! - im;
      real[a]! += re; imag[a]! += im;
    }
  }
  return Float32Array.from(real.slice(0, n / 2), (x, i) => 20 * Math.log10(Math.max(1e-6, Math.hypot(x, imag[i]!) * 4 / n)));
}
