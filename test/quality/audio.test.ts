import { describe, expect, it } from "vitest";
import { encodeWav, decodeWav } from "../../scripts/quality/audio/wav.ts";
import { analyzeSignal } from "../../scripts/quality/audio/analyzeSignal.ts";

describe("evaluator PCM boundary", () => {
  it("preserves stereo channels within PCM16 quantization", () => {
    const audio = {
      sampleRate: 48000,
      channels: [
        Float32Array.of(0, 0.25, -0.5),
        Float32Array.of(-0.25, 0.5, 0),
      ],
    };
    const decoded = decodeWav(encodeWav(audio));
    for (let c = 0; c < 2; c++)
      for (let i = 0; i < 3; i++)
        expect(
          Math.abs(decoded.channels[c]![i]! - audio.channels[c]![i]!),
        ).toBeLessThan(1 / 32768);
  });
  it("rejects overload and nonfinite audio before writing or judging", () => {
    for (const value of [1, -1, NaN, Infinity])
      expect(() =>
        encodeWav({ sampleRate: 48000, channels: [Float32Array.of(value)] }),
      ).toThrow();
    expect(
      analyzeSignal({ sampleRate: 48000, channels: [new Float32Array(4800)] })
        .passed,
    ).toBe(false);
  });
  it("rejects forged duration, truncated data and unsupported format", () => {
    const wav = encodeWav({
      sampleRate: 48000,
      channels: [new Float32Array(4800)],
    });
    const bad = Buffer.from(wav);
    bad.writeUInt32LE(1_000_000, 40);
    expect(() => decodeWav(bad)).toThrow(/Truncated/);
    expect(() => decodeWav(wav.subarray(0, wav.length - 1))).toThrow();
    bad.writeUInt16LE(3, 20);
    expect(() => decodeWav(bad)).toThrow();
  });
});
