export interface PcmAudio {
  sampleRate: number;
  channels: Float32Array[];
}

/** Encode only finite, unclipped 16-bit PCM. This is also the evaluator's actual input. */
export function encodeWav(audio: PcmAudio): Buffer {
  const { sampleRate, channels } = audio,
    frames = channels[0]?.length ?? 0;
  if (
    !Number.isInteger(sampleRate) ||
    sampleRate < 8000 ||
    sampleRate > 192000 ||
    ![1, 2].includes(channels.length) ||
    !frames ||
    frames > sampleRate * 10 ||
    channels.some((c) => c.length !== frames)
  )
    throw new RangeError("Expected bounded mono/stereo PCM.");
  const data = Buffer.alloc(44 + frames * channels.length * 2),
    stride = channels.length * 2;
  data.write("RIFF");
  data.writeUInt32LE(data.length - 8, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(channels.length, 22);
  data.writeUInt32LE(sampleRate, 24);
  data.writeUInt32LE(sampleRate * stride, 28);
  data.writeUInt16LE(stride, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(data.length - 44, 40);
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < channels.length; c++) {
      const v = channels[c]![i]!;
      if (!Number.isFinite(v) || Math.abs(v) >= 1)
        throw new RangeError("Refuse non-finite or clipped PCM.");
      data.writeInt16LE(
        Math.max(-32768, Math.min(32767, Math.round(v * 32768))),
        44 + i * stride + c * 2,
      );
    }
  return data;
}

/** The workflow reads its own canonical PCM16 files, not arbitrary media containers. */
export function decodeWav(data: Buffer): PcmAudio {
  if (
    data.length < 44 ||
    data.length > 8_000_000 ||
    data.toString("ascii", 0, 4) !== "RIFF" ||
    data.toString("ascii", 8, 12) !== "WAVE" ||
    data.readUInt32LE(4) + 8 !== data.length
  )
    throw new TypeError("Invalid or oversized RIFF/WAVE input.");
  let format: Buffer | undefined, pcm: Buffer | undefined;
  for (let at = 12; at + 8 <= data.length; ) {
    const size = data.readUInt32LE(at + 4),
      end = at + 8 + size;
    if (end > data.length) throw new TypeError("Truncated WAV chunk.");
    const id = data.toString("ascii", at, at + 4);
    if (id === "fmt ") {
      if (format) throw new TypeError("Duplicate WAV format.");
      format = data.subarray(at + 8, end);
    }
    if (id === "data") {
      if (pcm) throw new TypeError("Duplicate WAV data.");
      pcm = data.subarray(at + 8, end);
    }
    at = end + (size % 2);
  }
  if (
    !format ||
    format.length < 16 ||
    !pcm ||
    format.readUInt16LE(0) !== 1 ||
    format.readUInt16LE(14) !== 16
  )
    throw new TypeError("Expected PCM16 WAV.");
  const count = format.readUInt16LE(2),
    sampleRate = format.readUInt32LE(4),
    stride = count * 2;
  if (
    ![1, 2].includes(count) ||
    sampleRate < 8000 ||
    sampleRate > 192000 ||
    format.readUInt16LE(12) !== stride ||
    format.readUInt32LE(8) !== sampleRate * stride ||
    pcm.length % stride ||
    !pcm.length ||
    pcm.length / stride > sampleRate * 10
  )
    throw new RangeError("Invalid PCM dimensions or duration.");
  const channels = Array.from(
    { length: count },
    () => new Float32Array(pcm!.length / stride),
  );
  for (let i = 0; i < channels[0]!.length; i++)
    for (let c = 0; c < count; c++)
      channels[c]![i] = pcm.readInt16LE(i * stride + c * 2) / 32768;
  return { sampleRate, channels };
}
