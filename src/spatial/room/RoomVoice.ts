import { ReflectionTap } from './ReflectionTap.ts';
import type { RoomSourceTarget } from './types.ts';

/** One bounded history buffer per source, shared by six reflections and the late send. */
export class RoomVoice {
  private readonly buffer: Float32Array;
  private readonly taps: ReflectionTap[];
  private readonly send: ReflectionTap;
  private index = 0;
  private prepared = false;
  invalidSamples = 0;
  constructor(length: number, smoothing: number, transitionFrames: number) {
    this.buffer = new Float32Array(length);
    this.taps = Array.from({ length: 6 }, () => new ReflectionTap(smoothing, transitionFrames));
    this.send = new ReflectionTap(smoothing, transitionFrames);
  }
  set(target: RoomSourceTarget): void {
    for (let i = 0; i < 6; i++) {
      const tap = target.reflections[i];
      this.taps[i].set(tap.delayFrames, tap.left, tap.right, tap.pole);
    }
    this.send.set(target.late.delayFrames, target.late.gain, 0, 0);
    if (!this.prepared) { this.reset(); this.prepared = true; }
  }
  mute(): void {
    for (let i = 0; i < 6; i++) this.taps[i].mute();
    this.send.mute();
  }
  clear(): void { this.mute(); this.reset(); this.prepared = false; }
  reset(): void {
    this.buffer.fill(0); this.index = 0; this.invalidSamples = 0;
    for (let i = 0; i < 6; i++) this.taps[i].reset();
    this.send.reset();
  }
  mix(input: Float32Array | null | undefined, left: Float32Array, right: Float32Array, send: Float32Array, frames: number): void {
    if (!this.prepared) return;
    let index = this.index;
    for (let i = 0; i < frames; i++) {
      let x = input ? input[i] : 0;
      if (!Number.isFinite(x)) { x = 0; this.invalidSamples++; }
      this.buffer[index] = x;
      let l = 0, r = 0;
      for (let k = 0; k < 6; k++) {
        const tap = this.taps[k], sample = tap.tick(this.buffer, index);
        l += sample * tap.left; r += sample * tap.right;
      }
      left[i] += l; right[i] += r;
      const sample = this.send.tick(this.buffer, index);
      send[i] += sample * this.send.left;
      if (++index === this.buffer.length) index = 0;
    }
    this.index = index;
  }
}
