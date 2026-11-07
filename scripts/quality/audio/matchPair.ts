import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { decodeWav, encodeWav } from "./wav.ts";
import { measureLoudness } from "./measureLoudness.ts";

/** Static gain only. Lower the shared target when either input needs peak headroom. */
export async function matchPair(a: string, b: string, directory: string) {
  const inputs = [a, b].map((path) => ({ path, ...measureLoudness(path) }));
  const target = Math.min(-24, ...inputs.map((v) => v.lufs - 3 - v.truePeakDb));
  const outputs = [];
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]!,
      gainDb = target - input.lufs,
      gain = 10 ** (gainDb / 20);
    const original = await readFile(input.path),
      pcm = decodeWav(original);
    for (const channel of pcm.channels)
      for (let n = 0; n < channel.length; n++) channel[n]! *= gain;
    const wav = encodeWav(pcm),
      path = join(directory, `${i === 0 ? "A" : "B"}.wav`);
    await writeFile(path, wav, { flag: "wx" });
    const measured = measureLoudness(path);
    outputs.push({
      path,
      sha256: createHash("sha256").update(wav).digest("hex"),
      sourceSha256: createHash("sha256").update(original).digest("hex"),
      gainDb,
      ...measured,
    });
  }
  if (Math.abs(outputs[0]!.lufs - outputs[1]!.lufs) > 0.25)
    throw new Error(
      "Static loudness matching exceeds 0.25 LU. Do not compare this pair automatically.",
    );
  return { targetLufs: target, inputs, outputs };
}
