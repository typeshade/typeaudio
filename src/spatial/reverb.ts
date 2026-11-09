// The reverb send's convolution on a device: experiment 5's uniform partitioned convolution by
// overlap-add, with the transform as the kernel functions of `fft.shade.ts` so that every tier runs
// it, for two channels at once (a left and a right impulse response, so the wet pair is decorrelated).
// The partitions' spectra are made once. Each block is `pad`, the forward stages, `store`,
// `accumulate2`, the inverse stages and `overlap2`: 28 calls inside the block's `fuse` scope.

import type { Device, Resident } from 'typeshade/runtime';
import { pad, store } from '../../experiments/05-convolution/convolution.shade.ts';
import { twiddleTable } from '../../experiments/03-fft/signals.ts';
import { accumulate2, fftStage, overlap2 } from './fft.shade.ts';

const FRAMES = 1024;
const POINTS = 2048;
const STAGES = 11;

type Floats = Resident<Float32Array>;

export class Reverb {
  /** The partitions in each channel's impulse response. */
  readonly partitions: number;
  private readonly spectra: Floats;
  private readonly twiddles: Floats;
  private readonly line: Floats;
  private readonly tail: Floats;
  private readonly padded: Floats;
  private readonly fx: Floats;
  private readonly fy: Floats;
  private readonly sum: Floats;
  private readonly ix: Floats;
  private readonly iy: Floats;
  /** The wet block: the left channel's 1,024 frames, then the right's. */
  readonly wet: Floats;
  private slot = 0;

  private constructor(
    readonly dev: Device,
    partitions: number,
    spectra: Floats,
    twiddles: Floats,
  ) {
    this.partitions = partitions;
    this.spectra = spectra;
    this.twiddles = twiddles;
    this.line = dev.array(partitions * POINTS * 2, 'f32');
    this.tail = dev.array(2 * FRAMES, 'f32');
    this.padded = dev.array(POINTS * 2, 'f32');
    this.fx = dev.array(POINTS * 2, 'f32');
    this.fy = dev.array(POINTS * 2, 'f32');
    this.sum = dev.array(2 * POINTS * 2, 'f32');
    this.ix = dev.array(2 * POINTS * 2, 'f32');
    this.iy = dev.array(2 * POINTS * 2, 'f32');
    this.wet = dev.array(2 * FRAMES, 'f32');
  }

  /** Transforms the partitions of `left` and `right` on `dev`, and returns the reverb ready for block 0. */
  static async create(dev: Device, left: Float32Array, right: Float32Array): Promise<Reverb> {
    const partitions = Math.ceil(Math.max(left.length, right.length) / FRAMES);
    const parts = new Float32Array(2 * partitions * POINTS * 2);
    [left, right].forEach((ir, c) => {
      for (let i = 0; i < ir.length; i++) {
        const p = Math.floor(i / FRAMES);
        parts[((c * partitions + p) * POINTS + (i % FRAMES)) * 2] = ir[i]!;
      }
    });
    const src = dev.array(parts);
    const spectra = dev.array(2 * partitions * POINTS * 2, 'f32');
    const scratch = dev.array(2 * partitions * POINTS * 2, 'f32');
    const twiddles = dev.array(twiddleTable(POINTS));
    for (let k = 0; k < STAGES; k++) {
      const [out, inp] = stagePair(k, src, spectra, scratch);
      await fftStage(out, inp, twiddles, 1 << k, POINTS / 2 / (1 << k), -1, 1);
    }
    await dev.wait();
    dev.release(src);
    dev.release(scratch);
    return new Reverb(dev, partitions, spectra, twiddles);
  }

  /** Queues one block's calls: `send` is the 1,024 frames of the mono send. Call inside `dev.fuse`. */
  block(send: Floats): void {
    const slot = this.slot;
    this.slot = (slot + 1) % this.partitions;
    pad(this.padded, send);
    for (let k = 0; k < STAGES; k++) {
      const [out, inp] = stagePair(k, this.padded, this.fx, this.fy);
      void fftStage(out, inp, this.twiddles, 1 << k, POINTS / 2 / (1 << k), -1, 1);
    }
    store(this.line, this.fx, slot);
    accumulate2(this.sum, this.line, this.spectra, slot, this.partitions);
    for (let k = 0; k < STAGES; k++) {
      const [out, inp] = stagePair(k, this.sum, this.ix, this.iy);
      void fftStage(
        out,
        inp,
        this.twiddles,
        1 << k,
        POINTS / 2 / (1 << k),
        1,
        k === STAGES - 1 ? 1 / POINTS : 1,
      );
    }
    overlap2(this.wet, this.tail, this.ix);
  }

  /** Frees the reverb's arrays. */
  release(): void {
    for (const a of [
      this.spectra,
      this.twiddles,
      this.line,
      this.tail,
      this.padded,
      this.fx,
      this.fy,
      this.sum,
      this.ix,
      this.iy,
      this.wet,
    ])
      this.dev.release(a);
  }
}

/** The arrays of stage `k`: stage 0 reads `src` and writes `x`, then the stages alternate `x` to `y` and back. */
function stagePair(k: number, src: Floats, x: Floats, y: Floats): [Floats, Floats] {
  if (k === 0) return [x, src];
  return k % 2 === 1 ? [y, x] : [x, y];
}
