import { prepareRoomSource, RoomMixer } from '../../src/spatial/room/index.ts';
import type { PreparedRoom } from '../../src/spatial/room/types.ts';
import type { ListenerPose, Vector3 } from '../../src/spatial/types.ts';
import { curveAt } from './curveAt.ts';
import type { Layer, Study } from './types.ts';

export interface RenderedLayer { layer: Layer; pcm: Float32Array }

/** Render one bus without resetting the hall between events or camera cuts. */
export function renderRoomStem(study: Study, sources: RenderedLayer[], room: PreparedRoom, listener: ListenerPose) {
  const rate = 48000, blockSize = 128;
  const origin = Math.floor(Math.min(study.range[0] - 1, ...study.layers.map(l => l.start)) * rate);
  const first = Math.round(study.range[0] * rate) - origin;
  const end = Math.round((study.range[1] + study.tailSeconds) * rate) - origin;
  const output = new Float32Array((end - first) * 2);
  const mixer = new RoomMixer(room, { capacity: sources.length, maxFrames: blockSize });
  const inputs = sources.map(() => new Float32Array(blockSize));
  const left = new Float32Array(blockSize), right = left.slice();
  const starts = sources.map(s => Math.round(s.layer.start * rate) - origin);
  const gains = sources.map(s => 10 ** (s.layer.gainDb / 20));
  function setPosition(slot: number, age: number) {
    const layer = sources[slot].layer;
    const coordinates = [1, 2, 3].map(axis => curveAt(layer.position.map(p => [p[0], p[axis]]), age));
    const position: Vector3 = { x: coordinates[0], y: coordinates[1], z: coordinates[2] };
    const target = prepareRoomSource(room, listener, {
      position, referenceDistance: 1.5, rolloff: .5, airAbsorption: .04, spread: layer.spread,
    });
    mixer.setSource(slot, { ...target,
      reflections: target.reflections.map(t => ({ ...t, left: t.left * layer.roomSend, right: t.right * layer.roomSend })),
      late: { ...target.late, gain: target.late.gain * layer.roomSend },
    });
  }
  sources.forEach((_, slot) => setPosition(slot, 0));
  for (let at = 0; at < end; at += blockSize) {
    const count = Math.min(blockSize, end - at);
    for (let slot = 0; slot < sources.length; slot++) {
      const { layer, pcm } = sources[slot], offset = at - starts[slot];
      if (at % 512 === 0 && offset >= 0 && offset < pcm.length) setPosition(slot, offset / rate);
      const input = inputs[slot];
      for (let i = 0; i < count; i++) {
        const index = offset + i;
        input[i] = index < 0 || index >= pcm.length ? 0 : pcm[index] * gains[slot] * curveAt(layer.gain, index / rate);
      }
    }
    mixer.process(inputs, left, right, count);
    for (let i = 0; i < count; i++) {
      const destination = at + i - first;
      if (destination >= 0) { output[destination * 2] = left[i]; output[destination * 2 + 1] = right[i]; }
    }
  }
  if (mixer.invalidSamples || mixer.invalidOutputSamples || mixer.invalidTailSamples || mixer.overloadFrames)
    throw new Error('Invalid or overloaded stem in ' + study.id);
  return { pcm: output, peak: mixer.peak, delayBufferBytes: mixer.delayBufferBytes };
}
