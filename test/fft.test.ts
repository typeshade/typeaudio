import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { fftSmallTable } from '../experiments/03-fft/fft.shade.ts';
import { oracleOf } from '../experiments/03-fft/oracle.ts';
import {
  accuracy,
  fft64,
  signal,
  subnormals,
  transformOf,
  twiddleTable,
} from '../experiments/03-fft/signals.ts';

// Experiment 3's entry on the CPU, held to the f64 reference (docs/experiments.md, section 3;
// docs/records/03-fft-container.md). At the pin the host's CPU tier refuses an entry that reaches a
// barrier, so the entry runs on the compiler's oracle, whose `dispatch` runs it in the passes the
// WebGL2 tier runs. When the pin moves past the implementation of compiler change 0092, the first
// test fails: the CPU tier then runs the entry, and the experiment's CPU arm moves to it.

const N = 1024;
const source = readFileSync(new URL('../experiments/03-fft/fft.shade.ts', import.meta.url), 'utf8');

describe('the 1,024-point FFT entry on the CPU', () => {
  test('the host CPU tier refuses it at the pin: it reaches a barrier', async () => {
    const src = signal('noise', N);
    const dst = new Float32Array(src.length);
    await expect(
      fftSmallTable({ transform: transformOf('forward', N), src, dst, twiddles: twiddleTable(N) }, 1),
    ).rejects.toThrow(
      /fftSmallTable\(\) needs WebGPU: it reaches workgroupBarrier\(\) at fft\.shade\.ts:\d+, and a barrier has no CPU tier/,
    );
  });

  const oracle = oracleOf(source);

  test('the oracle transforms noise and an impulse within the reference by the f32 rounding', () => {
    const src = new Float32Array(4 * N);
    src.set(signal('noise', N));
    src.set(signal('impulse', N), 2 * N);
    const y = oracle.run('fftSmallTable', 'forward', N, 2, src, twiddleTable(N));
    const r = fft64(src, N, 'forward');
    const noise = accuracy(y.subarray(0, 2 * N), r.subarray(0, 2 * N));
    expect(noise.relRms).toBeLessThan(2e-7);
    expect(noise.maxPeakUlp).toBeLessThan(4);
    // The impulse at n = 1 transforms to the twiddles, each the table's correctly rounded value.
    const impulse = accuracy(y.subarray(2 * N), r.subarray(2 * N));
    expect(impulse.exact).toBe(2 * N);
  });

  test('the oracle keeps the subnormals of a quiet inverse transform, which a driver may flush', () => {
    const spectrum = Float32Array.from(fft64(signal('quiet', N), N, 'forward'));
    const y = oracle.run('fftSmallTable', 'inverse', N, 1, spectrum, twiddleTable(N));
    const r = fft64(spectrum, N, 'inverse');
    expect(accuracy(y, r).relRms).toBeLessThan(2e-7);
    expect(subnormals(y).subnormal).toBeGreaterThan(N);
  });
});
