/** Apply a short playback fade without changing the engine's measured peak. */
export function fade(samples: Float32Array, sampleRate: number): Float32Array {
  const out = samples.slice();
  const edge = Math.min(Math.floor(sampleRate * 0.01), Math.floor(out.length / 2));
  for (let i = 0; i < edge; i++) {
    out[i]! *= i / edge;
    out[out.length - 1 - i]! *= i / edge;
  }
  return out;
}

/** Encode mono PCM as a 16-bit WAV, clamping to the format's range. */
export function wav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (at: number, value: string): void => {
    for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i));
  };
  text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(44 + i * 2, Math.round(x * (x < 0 ? 32768 : 32767)), true);
  }
  return buffer;
}
export interface Settings {
  backend: 'cpu' | 'webgpu'; frequency: number; voices: number;
  cutoff: number; drive: number; duration: number; preset: string;
}
export function frequencies(settings: Settings): number[] {
  return Array.from({ length: settings.voices }, (_, i) => settings.frequency *
    (settings.preset === 'bright' ? 2 ** ([0, 7, 12, 19][i % 4]! / 12) :
      2 ** ((i - (settings.voices - 1) / 2) * 7 / 1200)));
}
