import type { FuseReport, Resident } from 'typeshade/runtime';
import type { Bank } from './bank.ts';
import { synth, type Voice } from './kernels/synth.shade.ts';
import { mixdown } from './kernels/mixdown.shade.ts';
import { drive, gain } from './kernels/bus.shade.ts';
import { peak } from './kernels/meter.shade.ts';

/** The settings of a plan. */
export interface PlanOptions {
  /** The drive into the soft clipper, `tanh(x * drive)`. 1 by default. */
  readonly drive?: number;
  /** The master gain, linear. 1 by default. */
  readonly gain?: number;
}

/**
 * What `render` plays: a bank of voices, mixed to one bus, soft-clipped and scaled. The plan also
 * keeps what the last `render` left: the fuse report of each block, which `explain` reads, and
 * the peak the meter measured.
 */
export interface Plan {
  /** The voices, one lane each. */
  readonly voices: Bank<Voice>;
  /** The drive into the soft clipper. */
  readonly drive: number;
  /** The master gain, linear. */
  readonly gain: number;
  /** The fuse report of each block of the last render, in order. Empty before the first. */
  readonly reports: readonly FuseReport[];
  /** The largest magnitude of the last render's output, 0 before the first. */
  readonly peak: number;
}

/** The plan as `render` writes it. */
interface PlanState {
  readonly voices: Bank<Voice>;
  readonly drive: number;
  readonly gain: number;
  reports: FuseReport[];
  peak: number;
}

/** The size of a render. */
export interface RenderOptions {
  /** How many frames to render. */
  readonly frames: number;
  /**
   * How many frames one block holds. Each block runs as one `fuse` plan; the last may be shorter.
   * 1024 by default, decision D5 of `docs/architecture.md`, until experiment 1 replaces it.
   */
  readonly block?: number;
}

/** The frames of a block when a render names none (decision D5). */
export const DEFAULT_BLOCK = 1024;

/** A plan of `voices` with the settings of `options`. */
export function plan(voices: Bank<Voice>, options: PlanOptions = {}): Plan {
  const state: PlanState = {
    voices,
    drive: finite('plan()', 'drive', options.drive ?? 1),
    gain: finite('plan()', 'gain', options.gain ?? 1),
    reports: [],
    peak: 0,
  };
  return state;
}

/**
 * Renders `frames` frames of `plan` and resolves to them, block after block. Each block is one
 * `dev.fuse()` scope (docs/architecture.md, section 3): the voices write their lanes (shape V),
 * the lanes are mixed to a bus (shape G), the bus is driven and scaled into the master (shape F,
 * each stage into a new array) and metered (shape R). The intermediates are scratch arrays, which
 * a fused group holds as locals; the master is a `Resident`, read once per block. The voices'
 * state stays on the device, so a second `render` continues where the first stopped.
 *
 * @throws `RangeError` for a `frames` or a `block` that is not a whole number of 1 or more.
 */
export async function render(plan: Plan, options: RenderOptions): Promise<Float32Array> {
  const frames = whole('render()', 'frames', options.frames);
  const block = whole('render()', 'block', options.block ?? DEFAULT_BLOCK);
  const state = plan as PlanState;
  const { voices } = state;
  const dev = voices.device;
  const out = new Float32Array(frames);
  const reports: FuseReport[] = [];
  const masters = new Map<number, Resident<Float32Array>>();
  let loudest = 0;
  try {
    for (let at = 0; at < frames; at += block) {
      const n = Math.min(block, frames - at);
      let master = masters.get(n);
      if (master === undefined) {
        master = dev.array(n, 'f32');
        masters.set(n, master);
      }
      const bus = master;
      let meter: Promise<number> | undefined;
      const report = await dev.fuse((scope) => {
        const lanes = scope.scratch(voices.size * n);
        const mixed = scope.scratch(n);
        const driven = scope.scratch(n);
        synth(lanes, voices.instances, n);
        mixdown(mixed, lanes, voices.size, n);
        drive(driven, mixed, state.drive);
        gain(bus, driven, state.gain);
        meter = peak(bus);
      });
      out.set(await bus.read(), at);
      loudest = Math.max(loudest, await meter!);
      reports.push(report);
    }
  } finally {
    for (const master of masters.values()) dev.release(master);
  }
  state.reports = reports;
  state.peak = loudest;
  return out;
}

function whole(at: string, name: string, v: number): number {
  if (!Number.isInteger(v) || v < 1) {
    throw new RangeError(`${at}: ${name} takes a whole number of 1 or more; got ${String(v)}.`);
  }
  return v;
}

function finite(at: string, name: string, v: number): number {
  if (!Number.isFinite(v)) {
    throw new RangeError(`${at}: ${name} takes a finite number; got ${String(v)}.`);
  }
  return v;
}
