import { roomWalls } from './roomWalls.ts';
import type { PreparedRoom } from './types.ts';

/** Four-line, orthogonal feedback delay network. Allocations occur only during construction. */
export class DiffuseTail {
  private readonly lines: Float32Array[];
  private readonly indices = new Uint32Array(4);
  private readonly filtered = new Float64Array(4);
  private readonly feedback: Float64Array;
  private readonly pole: number;
  private readonly gain: number;
  /** Recovered non-finite send samples or float32 feedback writes. */
  invalidSamples = 0;
  constructor(room: PreparedRoom) {
    const scale = Math.max(0.5, Math.min(3, Math.cbrt((room.max.x - room.min.x) * (room.max.y - room.min.y) * (room.max.z - room.min.z)) / 6));
    this.lines = [0.0297, 0.0371, 0.0411, 0.0437].map(seconds => new Float32Array(Math.round(seconds * scale * room.sampleRate)));
    this.feedback = Float64Array.from(this.lines, line => Math.pow(10, -3 * line.length / (room.sampleRate * room.decaySeconds)));
    const damping = roomWalls.reduce((sum, wall) => sum + room.walls[wall].damping, 0) / 6;
    const cutoff = Math.min(20000, room.sampleRate * 0.45) * Math.pow(0.025, damping);
    this.pole = damping === 0 ? 0 : Math.exp(-2 * Math.PI * cutoff / room.sampleRate);
    this.gain = room.lateGain;
  }
  get bufferBytes(): number { return this.lines.reduce((sum, line) => sum + line.byteLength, 0); }
  reset(): void {
    for (let i = 0; i < 4; i++) this.lines[i].fill(0);
    this.indices.fill(0); this.filtered.fill(0); this.invalidSamples = 0;
  }
  private write(line: number, value: number): void {
    let sample = Math.fround(value);
    if (!Number.isFinite(sample)) { sample = 0; this.invalidSamples++; }
    this.lines[line][this.indices[line]] = Math.abs(sample) < 1e-30 ? 0 : sample;
    if (++this.indices[line] === this.lines[line].length) this.indices[line] = 0;
  }
  mix(input: Float32Array, left: Float32Array, right: Float32Array, frames: number): void {
    // The room cannot change. A disabled tail needs no processing or retained history.
    if (this.gain === 0) return;
    for (let i = 0; i < frames; i++) {
      let x = input[i];
      if (!Number.isFinite(x)) { x = 0; this.invalidSamples++; }
      for (let k = 0; k < 4; k++) {
        const sample = this.lines[k][this.indices[k]];
        this.filtered[k] += (sample - this.filtered[k]) * (1 - this.pole);
        if (Math.abs(this.filtered[k]) < 1e-30) this.filtered[k] = 0;
      }
      const a = this.filtered[0], b = this.filtered[1], c = this.filtered[2], d = this.filtered[3];
      left[i] += (a + b - c - d) * 0.5 * this.gain;
      right[i] += (a - b + c - d) * 0.5 * this.gain;
      this.write(0, x * 0.5 + (a + b + c + d) * 0.5 * this.feedback[0]);
      this.write(1, x * 0.5 + (a - b + c - d) * 0.5 * this.feedback[1]);
      this.write(2, x * 0.5 + (a + b - c - d) * 0.5 * this.feedback[2]);
      this.write(3, x * 0.5 + (a - b - c + d) * 0.5 * this.feedback[3]);
    }
  }
}
