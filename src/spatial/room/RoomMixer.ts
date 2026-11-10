import { SpatialMixer } from '../SpatialMixer.ts';
import { validateNumber } from '../validateNumber.ts';
import { DiffuseTail } from './DiffuseTail.ts';
import { prepareRoom } from './prepareRoom.ts';
import { RoomVoice } from './RoomVoice.ts';
import { validateRoomSource } from './validateRoomSource.ts';
import type { PreparedRoom, RoomMixerOptions, RoomSourceTarget } from './types.ts';

/** Immediate spatial direct path, six delayed reflections per source, one shared room tail. */
export class RoomMixer {
  readonly room: PreparedRoom;
  readonly capacity: number;
  readonly sampleRate: number;
  readonly maxFrames: number;
  readonly maxDelayFrames: number;
  /** Delay-line storage only; excludes small control objects and output buffers. */
  readonly delayBufferBytes: number;
  private readonly direct: SpatialMixer;
  private readonly voices: RoomVoice[];
  private readonly tail: DiffuseTail;
  private readonly send: Float32Array;
  invalidSamples = 0;
  invalidOutputSamples = 0;
  invalidTailSamples = 0;
  overloadFrames = 0;
  peak = 0;
  constructor(room: PreparedRoom, options: RoomMixerOptions = {}) {
    this.room = prepareRoom(room, room.sampleRate);
    if (room.key !== this.room.key) throw new RangeError('Room control data does not match its key.');
    this.capacity = validateNumber(options.capacity ?? 8, 1, 64, 'capacity');
    const seconds = validateNumber(options.smoothingSeconds ?? 0.01, 0.001, 1, 'smoothingSeconds');
    const transition = validateNumber(options.transitionSeconds ?? 0.01, 0.001, 0.1, 'transitionSeconds');
    this.direct = new SpatialMixer({ ...options, capacity: this.capacity, sampleRate: room.sampleRate });
    this.sampleRate = this.direct.sampleRate; this.maxFrames = this.direct.maxFrames;
    this.maxDelayFrames = Math.ceil(2 * Math.max(this.room.max.x - this.room.min.x, this.room.max.y - this.room.min.y,
      this.room.max.z - this.room.min.z) * this.sampleRate / 343);
    const length = this.maxDelayFrames + 2;
    const smoothing = 1 - Math.exp(-1 / (this.sampleRate * seconds));
    this.voices = Array.from({ length: this.capacity }, () => new RoomVoice(length, smoothing, Math.ceil(transition * this.sampleRate)));
    this.tail = new DiffuseTail(this.room);
    this.send = new Float32Array(this.maxFrames);
    this.delayBufferBytes = length * 4 * this.capacity + this.tail.bufferBytes;
  }
  private voice(slot: number): RoomVoice {
    if (!Number.isInteger(slot) || slot < 0 || slot >= this.capacity) throw new RangeError('Source slot is outside room capacity.');
    return this.voices[slot];
  }
  setSource(slot: number, target: RoomSourceTarget): void {
    const voice = this.voice(slot);
    validateRoomSource(target, this.room, this.maxDelayFrames);
    this.direct.setSource(slot, target.direct);
    voice.set(target);
  }
  /** Fade this source's direct path, reflections and future tail sends. Supply input during the fade. */
  removeSource(slot: number): void { this.voice(slot).mute(); this.direct.removeSource(slot); }
  /** Discard this source's history. Energy already in the shared tail continues. */
  clearSource(slot: number): void { this.voice(slot).clear(); this.direct.clearSource(slot); }
  /** Clear all DSP history and counters. Keep prepared source targets. */
  reset(): void {
    this.direct.reset(); this.tail.reset(); this.send.fill(0);
    for (let i = 0; i < this.capacity; i++) this.voices[i].reset();
    this.invalidSamples = this.invalidOutputSamples = this.invalidTailSamples = this.overloadFrames = this.peak = 0;
  }
  /** Synchronous, allocation-free processing. Absent inputs feed silence and drain reflections and tail. */
  process(inputs: readonly (Float32Array | null | undefined)[], left: Float32Array, right: Float32Array, frames = left.length): void {
    const invalidBefore = this.direct.invalidOutputSamples;
    // Direct processing validates all buffers and aliases before changing any DSP state.
    this.direct.process(inputs, left, right, frames);
    this.invalidOutputSamples += this.direct.invalidOutputSamples - invalidBefore;
    this.send.fill(0, 0, frames);
    for (let slot = 0; slot < this.capacity; slot++) {
      const voice = this.voices[slot], before = voice.invalidSamples;
      voice.mix(inputs[slot], left, right, this.send, frames);
      this.invalidSamples += voice.invalidSamples - before;
    }
    this.tail.mix(this.send, left, right, frames);
    this.invalidTailSamples = this.tail.invalidSamples;
    for (let i = 0; i < frames; i++) {
      if (!Number.isFinite(left[i])) { left[i] = 0; this.invalidOutputSamples++; }
      if (!Number.isFinite(right[i])) { right[i] = 0; this.invalidOutputSamples++; }
      const peak = Math.max(Math.abs(left[i]), Math.abs(right[i]));
      if (peak > 1) this.overloadFrames++;
      this.peak = Math.max(this.peak, peak);
    }
  }
}
