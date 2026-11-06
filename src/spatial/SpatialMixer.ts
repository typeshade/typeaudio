import type { SpatialMixerOptions, SpatialTarget } from './types.ts';
import { SpatialVoice } from './SpatialVoice.ts';
import { buffersOverlap } from './buffersOverlap.ts';
import { validateNumber } from './validateNumber.ts';
/** Synchronous mono-source to stereo bus. Reuse buffers and fixed source slots. */
export class SpatialMixer {
  readonly capacity: number;
  readonly sampleRate: number;
  readonly maxFrames: number;
  private readonly voices: SpatialVoice[];
  /** Non-finite input samples replaced with silence, counted per configured source. */
  invalidSamples = 0;
  /** Non-finite mixed channel samples replaced with silence. No limiter is applied. */
  invalidOutputSamples = 0;
  /** Stereo frames with a finite sample outside [-1, 1]. Output remains unclipped. */
  overloadFrames = 0;
  peak = 0;
  constructor(options: SpatialMixerOptions = {}) {
    this.capacity = validateNumber(options.capacity ?? 32, 1, 256, 'capacity');
    this.maxFrames = validateNumber(options.maxFrames ?? 128, 1, 4096, 'maxFrames');
    if (!Number.isInteger(this.capacity) || !Number.isInteger(this.maxFrames))
      throw new RangeError('capacity and maxFrames must be integers.');
    this.sampleRate = validateNumber(options.sampleRate ?? 48000, 8000, 192000, 'sampleRate');
    const seconds = validateNumber(options.smoothingSeconds ?? 0.01, 0.001, 1, 'smoothingSeconds');
    const smoothing = 1 - Math.exp(-1 / (this.sampleRate * seconds));
    this.voices = Array.from({ length: this.capacity }, () => new SpatialVoice(smoothing));
  }
  private voice(slot: number): SpatialVoice {
    if (!Number.isInteger(slot) || slot < 0 || slot >= this.capacity)
      throw new RangeError('Source slot is outside mixer capacity.');
    return this.voices[slot];
  }
  /** Copy a prepared target. Invalid updates leave the previous target intact. */
  setSource(slot: number, target: SpatialTarget): void {
    const voice = this.voice(slot);
    if (!target || target.sampleRate !== this.sampleRate)
      throw new RangeError('Spatial target and mixer sample rates must match.');
    validateNumber(target.left, 0, 16, 'target.left');
    validateNumber(target.right, 0, 16, 'target.right');
    validateNumber(target.pole, 0, 0.9999999, 'target.pole');
    voice.targetLeft = target.left;
    voice.targetRight = target.right;
    voice.targetPole = target.pole;
    if (!voice.prepared) {
      voice.reset();
      voice.prepared = true;
    }
  }
  /** Fade to silence. Keep supplying input during the fade to avoid a hard cut. */
  removeSource(slot: number): void {
    const voice = this.voice(slot);
    voice.targetLeft = voice.targetRight = 0;
  }
  /** Clear a source before reusing its slot. Deliberately discards its tail. */
  clearSource(slot: number): void {
    const voice = this.voice(slot);
    voice.targetLeft = voice.targetRight = voice.targetPole = 0;
    voice.reset();
    voice.prepared = false;
  }
  /** Clear DSP history and counters while preserving all prepared targets. */
  reset(): void {
    for (let slot = 0; slot < this.capacity; slot++) this.voices[slot].reset();
    this.invalidSamples = this.invalidOutputSamples = this.overloadFrames = this.peak = 0;
  }
  /** Replace output[0..frames). Null or absent slots feed silence and drain filter state. */
  process(
    inputs: readonly (Float32Array | null | undefined)[],
    left: Float32Array,
    right: Float32Array,
    frames = left.length,
  ): void {
    if (!Number.isInteger(frames) || frames < 1 || frames > this.maxFrames)
      throw new RangeError('frames must be an integer within mixer maxFrames.');
    if (!(left instanceof Float32Array) || !(right instanceof Float32Array) || left.length < frames || right.length < frames)
      throw new RangeError('Stereo output needs two Float32Array buffers with at least frames samples.');
    if (buffersOverlap(left, right, frames)) throw new RangeError('Stereo output buffers must not overlap.');
    if (inputs.length > this.capacity) throw new RangeError('Input count exceeds mixer capacity.');
    // Validate before clearing output or changing filter history.
    for (let slot = 0; slot < inputs.length; slot++) {
      const input = inputs[slot];
      if (input == null) continue;
      if (!(input instanceof Float32Array) || input.length < frames)
        throw new RangeError('Each input needs a Float32Array with at least frames samples.');
      if (buffersOverlap(input, left, frames) || buffersOverlap(input, right, frames))
        throw new RangeError('Spatial input and output buffers must not overlap.');
    }
    left.fill(0, 0, frames);
    right.fill(0, 0, frames);
    for (let slot = 0; slot < this.capacity; slot++) {
      const voice = this.voices[slot], before = voice.invalidSamples;
      voice.mix(inputs[slot], left, right, frames);
      this.invalidSamples += voice.invalidSamples - before;
    }
    for (let i = 0; i < frames; i++) {
      if (!Number.isFinite(left[i])) { left[i] = 0; this.invalidOutputSamples++; }
      if (!Number.isFinite(right[i])) { right[i] = 0; this.invalidOutputSamples++; }
      const peak = Math.max(Math.abs(left[i]), Math.abs(right[i]));
      if (peak > 1) this.overloadFrames++;
      this.peak = Math.max(this.peak, peak);
    }
  }
}
