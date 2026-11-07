import {
  prepareRoom,
  prepareRoomSource,
  RoomMixer,
} from "../../../src/spatial/room/index.ts";
import type { PcmAudio } from "../audio/wav.ts";

export const COLUMN_ROOM = {
  min: { x: -9, y: -3, z: -12 },
  max: { x: 9, y: 9, z: 8 },
  walls: {
    xMin: { reflection: 0.62, damping: 0.55 },
    xMax: { reflection: 0.71, damping: 0.44 },
    yMin: { reflection: 0.82, damping: 0.38 },
    yMax: { reflection: 0.57, damping: 0.61 },
    zMin: { reflection: 0.68, damping: 0.52 },
    zMax: { reflection: 0.73, damping: 0.48 },
  },
  earlyGain: 0.55,
  lateGain: 0.2,
  decaySeconds: 1.65,
};
export const COLUMN_LISTENER = { position: { x: 0, y: 0, z: 0 } };
export const COLUMN_POSITION = { x: 1.3, y: 0.4, z: -3.2 };

export function spatialColumn(pcm: Float32Array, send: number): PcmAudio {
  const room = prepareRoom(COLUMN_ROOM, 48000),
    mixer = new RoomMixer(room, { capacity: 1, maxFrames: 128 });
  const target = prepareRoomSource(room, COLUMN_LISTENER, {
    position: COLUMN_POSITION,
    referenceDistance: 1.5,
    rolloff: 0.5,
    airAbsorption: 0.04,
    spread: 0.2,
  });
  mixer.setSource(0, {
    ...target,
    reflections: target.reflections.map((r) => ({
      ...r,
      left: r.left * send,
      right: r.right * send,
    })),
    late: { ...target.late, gain: target.late.gain * send },
  });
  const channels = [new Float32Array(pcm.length), new Float32Array(pcm.length)];
  const input = new Float32Array(128),
    left = input.slice(),
    right = input.slice();
  for (let at = 0; at < pcm.length; at += 128) {
    const count = Math.min(128, pcm.length - at);
    input.fill(0);
    input.set(pcm.subarray(at, at + count));
    mixer.process([input], left, right, count);
    for (let i = 0; i < count; i++) {
      channels[0]![at + i] = left[i]!;
      channels[1]![at + i] = right[i]!;
    }
  }
  if (
    mixer.invalidSamples ||
    mixer.invalidOutputSamples ||
    mixer.invalidTailSamples
  )
    throw new Error("Invalid room output.");
  // The studio's scene output has a 10 ms onset and 50 ms end taper, with highpass disabled here.
  for (const channel of channels)
    for (let i = 0; i < channel.length; i++)
      channel[i]! *= Math.min(1, i / 480, (channel.length - 1 - i) / 2400);
  return { sampleRate: 48000, channels };
}
