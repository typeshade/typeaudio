// The input stems of the `voice` events. The repository holds no recorded speech, so the harness
// synthesizes a stand-in for each: a glottal buzz through two formants under a syllabic envelope.
// It is deterministic, and it stands for the stem of the picture that the plan's host would supply
// (a deviation of experiment 8, in its record).

import type { SoundPlan } from '../../src/plan/index.ts';

/** A mono stem of `seconds` at `sr`, from `seed`: a stand-in for speech, peaking near 0.3. */
export function speechStem(seconds: number, sr: number, seed: number): Float32Array {
  const n = Math.round(seconds * sr);
  const out = new Float32Array(n);
  const pitch = 105 + 25 * ((seed >>> 0) % 7) / 6;
  const syllable = 3.2 + 0.2 * ((seed >>> 3) % 5);
  // Two resonators (a vowel's first two formants) on a sawtooth buzz.
  const formants = [
    { f: 620, q: 6 },
    { f: 1250, q: 8 },
  ].map(({ f, q }) => {
    const w = (2 * Math.PI * f) / sr;
    const r = Math.exp(-Math.PI * (f / q) / sr);
    return { a1: 2 * r * Math.cos(w), a2: -r * r, z1: 0, z2: 0, gain: 1 - r };
  });
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    phase = (phase + pitch * (1 + 0.04 * Math.sin(2 * Math.PI * 5 * t)) / sr) % 1;
    const buzz = 2 * phase - 1;
    let y = 0;
    for (const r of formants) {
      const v = r.gain * buzz + r.a1 * r.z1 + r.a2 * r.z2;
      r.z2 = r.z1;
      r.z1 = v;
      y += v;
    }
    const gate = Math.sin(Math.PI * Math.min(1, (t * syllable) % 1)) ** 2;
    const edge = Math.min(1, t / 0.03, (seconds - t) / 0.05);
    out[i] = y * gate * Math.max(edge, 0);
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < n; i++) out[i]! *= 0.3 / peak;
  return out;
}

/** The stems of every `voice` event of `plan`, by event id. */
export function stemsOf(plan: SoundPlan, sr: number): Record<string, Float32Array> {
  const stems: Record<string, Float32Array> = {};
  plan.events.forEach((e, i) => {
    if (e.kind === 'voice') stems[e.id] = speechStem(e.duration ?? 1, sr, i + 1);
  });
  return stems;
}
