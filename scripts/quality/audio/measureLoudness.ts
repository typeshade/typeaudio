import { spawnSync } from "node:child_process";

/** FFmpeg measures input BS.1770 loudness and oversampled true peak; it writes no render. */
export function measureLoudness(path: string) {
  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostats",
      "-i",
      path,
      "-af",
      "loudnorm=I=-24:TP=-3:LRA=7:print_format=json",
      "-f",
      "null",
      "-",
    ],
    { encoding: "utf8", timeout: 30000, maxBuffer: 1_000_000 },
  );
  if (result.error || result.status !== 0)
    throw new Error(
      "FFmpeg loudness measurement failed. Install ffmpeg and check the WAV.",
    );
  const start = result.stderr.lastIndexOf("{"),
    end = result.stderr.indexOf("}", start);
  if (start < 0 || end < start)
    throw new Error("FFmpeg did not return loudness measurements.");
  const json = result.stderr.slice(start, end + 1);
  const data = JSON.parse(json),
    lufs = Number(data.input_i),
    truePeakDb = Number(data.input_tp);
  if (!Number.isFinite(lufs) || !Number.isFinite(truePeakDb))
    throw new Error("Loudness is undefined for silent or invalid audio.");
  return {
    lufs,
    truePeakDb,
    method: "FFmpeg loudnorm input BS.1770 measurement" as const,
  };
}
