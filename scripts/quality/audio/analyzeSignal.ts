import type { PcmAudio } from "./wav.ts";

export function analyzeSignal(audio: PcmAudio) {
  let peak = 0,
    energy = 0,
    sum = 0,
    invalid = 0,
    clipped = 0;
  const n = audio.channels.reduce((total, c) => total + c.length, 0);
  for (const channel of audio.channels)
    for (const x of channel) {
      if (!Number.isFinite(x)) {
        invalid++;
        continue;
      }
      peak = Math.max(peak, Math.abs(x));
      energy += x * x;
      sum += x;
      if (Math.abs(x) >= 0.999) clipped++;
    }
  const rms = Math.sqrt(energy / Math.max(n, 1)),
    dc = sum / Math.max(n, 1);
  return {
    frames: audio.channels[0]?.length ?? 0,
    sampleRate: audio.sampleRate,
    channels: audio.channels.length,
    peak,
    rms,
    dc,
    invalid,
    clipped,
    passed:
      n > 0 &&
      invalid === 0 &&
      clipped === 0 &&
      peak > 1e-5 &&
      Math.abs(dc) < 0.02,
    perceptualQuality: "not assessed" as const,
  };
}
