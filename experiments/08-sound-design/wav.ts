// A WAV file of 32-bit float samples, stereo or mono: the format the harness writes the stems and
// the mix in.

/** The bytes of a WAV file of `channels` (equal lengths) at `sampleRate`. */
export function wavBytes(channels: readonly Float32Array[], sampleRate: number): Uint8Array {
  const frames = channels[0]?.length ?? 0;
  const n = channels.length;
  const data = frames * n * 4;
  const buffer = new ArrayBuffer(44 + data);
  const v = new DataView(buffer);
  const text = (at: number, s: string): void => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  };
  text(0, 'RIFF');
  v.setUint32(4, 36 + data, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 3, true); // IEEE float
  v.setUint16(22, n, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * n * 4, true);
  v.setUint16(32, n * 4, true);
  v.setUint16(34, 32, true);
  text(36, 'data');
  v.setUint32(40, data, true);
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < n; c++) v.setFloat32(44 + (i * n + c) * 4, channels[c]![i]!, true);
  return new Uint8Array(buffer);
}
