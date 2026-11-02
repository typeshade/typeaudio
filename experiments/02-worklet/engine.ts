// Experiment 2, the engine's own block inside the AudioWorkletGlobalScope: a processor that runs
// `render()` of a bank of voices for each render quantum, one `fuse` plan per quantum on a device
// of the CPU tier (docs/architecture.md, section 8, "Low latency": nothing in the graph changes).
// It imports `typeshade/runtime` for `createDevice`, which the generated modules do not: the
// runtime loads `fuse()`'s planner with a dynamic `import()`, which the scope refuses. `run.ts`
// bundles this file twice, with that import inlined and without.
//
// The scope has no `structuredClone` either, which a `Resident` of objects (the bank) copies its
// value with. With `polyfill`, the processor first installs `cloneData`, the harness's
// workaround, as the scope's `structuredClone`.

import { createDevice } from 'typeshade/runtime';
import { bank, plan, render, type Plan } from '../../src/index.ts';
import { Voice } from '../../src/kernels/synth.shade.ts';
import { QUANTUM, type ProcessorOptions } from './options.ts';
import { census, CUTOFF, Meter, pitchOf, QUALITY, scope, SR, type Outputs } from './scope.ts';

const CENSUS = census();

/** A deep copy of plain data, the values a `Resident` holds (Rule 8.21): numbers, booleans, typed
 *  arrays, arrays and objects of them. The workaround for the scope's missing `structuredClone`. */
export function cloneData<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value;
  if (ArrayBuffer.isView(value)) return (value as unknown as Float32Array).slice() as unknown as T;
  if (Array.isArray(value)) return value.map(cloneData) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = cloneData(v);
  return out as T;
}

class EngineProcessor extends scope.AudioWorkletProcessor {
  private readonly o: ProcessorOptions;
  private readonly meter: Meter;
  private plan: Plan | undefined;
  private pending = false;

  constructor({ processorOptions }: { readonly processorOptions: ProcessorOptions }) {
    super();
    const start = Date.now();
    const o = processorOptions;
    const meter = new Meter(this.port, o.frames);
    this.o = o;
    this.meter = meter;
    const g = globalThis as { structuredClone?: unknown };
    if (o.polyfill === true && g.structuredClone === undefined) g.structuredClone = cloneData;
    // The device is made asynchronously. On the CPU tier nothing it awaits leaves the microtask
    // queue, so the plan exists before the first quantum when the scope drains that queue after
    // the constructor; a quantum that comes before it is silent.
    void (async () => {
      const dev = await createDevice({ prefer: ['cpu'] });
      const voices = bank(
        dev,
        Array.from({ length: o.voices }, (_, v) => new Voice(pitchOf(v), CUTOFF, QUALITY, SR)),
      );
      this.plan = plan(voices, { drive: 1, gain: 1 / o.voices });
      meter.post({ type: 'ready', census: CENSUS, setupMs: Date.now() - start });
    })().catch((e: unknown) => {
      meter.fail('setup', e);
      meter.post({ type: 'ready', census: CENSUS, setupMs: Date.now() - start });
    });
    this.port.onmessage = () => meter.report();
  }

  process(_inputs: Outputs, outputs: Outputs): boolean {
    const start = Date.now();
    const frame = scope.currentFrame;
    const out = outputs[0]![0]!;
    const p = this.plan;
    if (p === undefined || this.o.variant !== 'engine') {
      this.meter.done(frame, start);
      return true;
    }
    if (this.pending) this.meter.unfinished++;
    this.pending = true;
    let filled = false;
    render(p, { frames: QUANTUM, block: QUANTUM }).then(
      (block) => {
        filled = true;
        out.set(block);
        this.pending = false;
        this.meter.done(frame, start);
      },
      (e: unknown) => {
        this.pending = false;
        this.meter.fail('render', e);
        this.meter.done(frame, start);
      },
    );
    if (filled) this.meter.filledOnReturn++;
    return true;
  }
}

scope.registerProcessor('exp02', EngineProcessor);
