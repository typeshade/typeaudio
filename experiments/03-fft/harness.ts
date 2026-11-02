// Experiment 3 on one tier of the host face (compiler surface §67): each entry called with host
// arrays, which the call reads back into, on the tier `configure({ prefer: [tier] })` requires.
// The page (`browser.ts`) runs it on WebGPU and on WebGL2, and Node (`node.ts`) on the CPU tier,
// where the pin refuses an entry that reaches a barrier (change 0092 is accepted, not implemented).

import { configure, createDevice, type DeviceInfo } from 'typeshade/runtime';
import { fftLargeDevice, fftLargeTable, fftSmallDevice, fftSmallTable } from './fft.shade.ts';
import { scaleProbe, wrapProbe } from './probes.shade.ts';
import {
  DIRECTIONS,
  ENTRIES,
  PROBE_INPUTS,
  SIGNALS,
  inputOf,
  toBase64,
  transformOf,
  twiddleTable,
  type Direction,
  type Size,
  type Variant,
} from './signals.ts';

export type Tier = 'webgpu' | 'webgl2' | 'cpu';

export interface Options {
  readonly tier: Tier;
  readonly sizes: readonly Size[];
  readonly variants: readonly Variant[];
  /** How many times each call runs; the runs are held to one another bit for bit. */
  readonly repeats: number;
}

/** One call of one entry: its output's bits, or the sentence the tier refused it with. */
export interface Call {
  readonly size: Size;
  readonly variant: Variant;
  readonly direction: Direction;
  readonly entry: string;
  /** The output of the first run, base64 of its `f32`s. */
  readonly output?: string;
  /** The runs whose output differs from the first run's in any bit. */
  readonly unstable?: number;
  /** The host time of each run, from the call to the end of its read-back, in milliseconds. */
  readonly ms?: number[];
  readonly refused?: string;
}

/** A probe's output, or the sentence the tier refused it with. */
export interface Probe {
  readonly name: string;
  readonly input: number[];
  readonly factor?: number;
  readonly output?: number[];
  readonly refused?: string;
}

export interface Result {
  readonly tier: Tier;
  readonly info?: DeviceInfo;
  readonly calls: Call[];
  readonly probes: Probe[];
}

/** Calls the entry of `size` and `variant` once, writing into `dst`. */
async function call(
  size: Size,
  variant: Variant,
  direction: Direction,
  src: Float32Array,
  dst: Float32Array,
  twiddles: Float32Array,
): Promise<void> {
  const transform = transformOf(direction, size);
  const workgroups = SIGNALS.length;
  if (size === 1024) {
    if (variant === 'device') await fftSmallDevice({ transform, src, dst }, workgroups);
    else await fftSmallTable({ transform, src, dst, twiddles }, workgroups);
  } else if (variant === 'device') await fftLargeDevice({ transform, src, dst }, workgroups);
  else await fftLargeTable({ transform, src, dst, twiddles }, workgroups);
}

async function probes(): Promise<Probe[]> {
  const out: Probe[] = [];
  const scale = async (input: readonly number[], factor: number): Promise<Probe> => {
    const xs = Float32Array.from(input);
    const ys = new Float32Array(input.length);
    try {
      await scaleProbe({ probe: { factor }, xs, ys }, 1);
      return { name: 'scaleProbe', input: [...xs], factor, output: [...ys] };
    } catch (e) {
      return { name: 'scaleProbe', input: [...xs], factor, refused: String(e) };
    }
  };
  out.push(await scale(PROBE_INPUTS.subnormal, 2 ** 20));
  out.push(await scale(PROBE_INPUTS.normal, 2 ** -20));
  const xs = Float32Array.from(PROBE_INPUTS.wrap);
  const ys = new Float32Array(12);
  try {
    await wrapProbe({ xs, ys }, 1);
    out.push({ name: 'wrapProbe', input: [...xs], output: [...ys] });
  } catch (e) {
    out.push({ name: 'wrapProbe', input: [...xs], refused: String(e) });
  }
  return out;
}

/** Runs every call and probe on `o.tier`; `progress` sees a line for each call. */
export async function runTier(o: Options, progress: (line: string) => void = () => {}): Promise<Result> {
  const prefer = [o.tier];
  configure({ prefer });
  let info: DeviceInfo | undefined;
  try {
    const dev = await createDevice({ prefer });
    info = dev.info;
    await dev.dispose();
  } catch (e) {
    progress(`${o.tier}: no device (${String(e)})`);
  }
  const calls: Call[] = [];
  for (const size of o.sizes) {
    const twiddles = twiddleTable(size);
    for (const variant of o.variants) {
      for (const direction of DIRECTIONS) {
        const entry = ENTRIES[size][variant];
        const src = inputOf(size, direction);
        const outputs: Float32Array[] = [];
        const ms: number[] = [];
        let refused: string | undefined;
        for (let r = 0; r < o.repeats && refused === undefined; r++) {
          const dst = new Float32Array(src.length);
          const start = performance.now();
          try {
            await call(size, variant, direction, src, dst, twiddles);
            ms.push(performance.now() - start);
            outputs.push(dst);
          } catch (e) {
            refused = String(e);
          }
        }
        if (refused !== undefined) {
          progress(`${o.tier} ${entry} ${direction}: refused: ${refused}`);
          calls.push({ size, variant, direction, entry, refused });
          continue;
        }
        const first = new Uint32Array(outputs[0]!.buffer);
        const unstable = outputs.slice(1).filter((y) => {
          const bits = new Uint32Array(y.buffer);
          return bits.some((b, i) => b !== first[i]);
        }).length;
        progress(`${o.tier} ${entry} ${direction}: ${ms.map((t) => t.toFixed(1)).join(', ')} ms`);
        calls.push({ size, variant, direction, entry, output: toBase64(outputs[0]!), unstable, ms });
      }
    }
  }
  const probed = await probes();
  configure({});
  return { tier: o.tier, ...(info === undefined ? {} : { info }), calls, probes: probed };
}
