import { writeFile } from 'node:fs/promises';

/** Write interleaved stereo PCM as a 16-bit WAV. Callers check headroom before quantization. */
export async function writeStereoWav(path: string, samples: Float32Array, sampleRate: number): Promise<void> {
  if (samples.length % 2 !== 0) throw new Error('Stereo WAV needs an even sample count.');
  const output = Buffer.alloc(44 + samples.length * 2);
  output.write('RIFF', 0); output.writeUInt32LE(output.length - 8, 4); output.write('WAVEfmt ', 8);
  output.writeUInt32LE(16, 16); output.writeUInt16LE(1, 20); output.writeUInt16LE(2, 22);
  output.writeUInt32LE(sampleRate, 24); output.writeUInt32LE(sampleRate * 4, 28); output.writeUInt16LE(4, 32);
  output.writeUInt16LE(16, 34); output.write('data', 36); output.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    if (!Number.isFinite(samples[i]) || Math.abs(samples[i]) > 1) throw new Error('Invalid or overloaded WAV sample.');
    output.writeInt16LE(Math.round(samples[i] * 32767), 44 + i * 2);
  }
  await writeFile(path, output);
}
