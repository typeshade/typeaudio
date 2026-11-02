// Experiment 2 inside the AudioWorkletGlobalScope (docs/experiments.md, section 2): a processor
// that produces each render quantum of 128 frames in one of the ways of `options.ts` (`empty`,
// `kernel`, `host`, `plain`) and counts what it did. `run.ts` bundles this file for the worklet,
// and the page loads the bundle with `audioWorklet.addModule`.
//
// The kernel call is asynchronous from the start (compiler surface §65): it returns a promise,
// and the CPU tier runs the function in a microtask of the kernel queue, so `out` is not filled
// when the call returns. The processor counts that (`filledOnReturn`), and mixes the lanes into
// the output array when the promise settles. The output is held to the `plain` reference by the
// page: where the microtask runs before the browser reads the output array, the samples land in
// their own quantum.

import { configure } from 'typeshade/runtime';
import { synth, Voice } from '../../src/kernels/synth.shade.ts';
import { RefVoice } from '../../test/reference.ts';
import { QUANTUM, type ProcessorOptions } from './options.ts';
import { census, CUTOFF, Meter, mixLanes, pitchOf, QUALITY, scope, SR, type Outputs } from './scope.ts';

/** Read when the bundle is evaluated, before any of its code runs. */
const CENSUS = census();

class Processor extends scope.AudioWorkletProcessor {
  private readonly o: ProcessorOptions;
  private readonly meter: Meter;
  private readonly gain: number;
  /** `kernel` and `host`: the voices, built with `new` on the CPU tier (change 0109). */
  private readonly bank: Voice[] = [];
  /** `plain`: the voices of the plain-JavaScript reference. */
  private readonly refs: RefVoice[] = [];
  /** `kernel`: the lanes `synth` writes, `QUANTUM` frames for each voice. */
  private readonly lanes: Float32Array;
  /** `host` and `plain`: the sum of the voices, frame by frame. */
  private readonly sum = new Float32Array(QUANTUM);
  private pending = false;

  constructor({ processorOptions }: { readonly processorOptions: ProcessorOptions }) {
    super();
    const start = Date.now();
    this.o = processorOptions;
    this.meter = new Meter(this.port, this.o.frames);
    this.gain = Math.fround(1 / this.o.voices);
    this.lanes = new Float32Array(this.o.variant === 'kernel' ? this.o.voices * QUANTUM : 0);
    try {
      if (this.o.tiers !== 'default') configure({ prefer: [this.o.tiers] });
      for (let v = 0; v < this.o.voices; v++) {
        if (this.o.variant === 'kernel' || this.o.variant === 'host') {
          this.bank.push(new Voice(pitchOf(v), CUTOFF, QUALITY, SR));
        } else if (this.o.variant === 'plain') {
          this.refs.push(new RefVoice(pitchOf(v), CUTOFF, QUALITY, SR));
        }
      }
    } catch (e) {
      this.meter.fail('setup', e);
    }
    this.meter.post({ type: 'ready', census: CENSUS, setupMs: Date.now() - start });
    this.port.onmessage = () => this.meter.report();
  }

  process(_inputs: Outputs, outputs: Outputs): boolean {
    const start = Date.now();
    const frame = scope.currentFrame;
    const out = outputs[0]![0]!;
    switch (this.o.variant) {
      case 'empty':
        break;
      case 'kernel':
        this.kernel(out, frame, start);
        return true;
      case 'host':
        this.tick(out, this.bank);
        break;
      case 'plain':
        this.tick(out, this.refs);
        break;
      case 'engine':
        this.meter.fail('process', new Error('the engine variant needs the engine bundle'));
        break;
    }
    this.meter.done(frame, start);
    return true;
  }

  /** Variant (a): one call of the kernel function for the quantum, the lanes mixed when it settles. */
  private kernel(out: Float32Array, frame: number, start: number): void {
    if (this.pending) this.meter.unfinished++;
    this.pending = true;
    // A sentinel: a call that ran before it returned has overwritten it.
    this.lanes[0] = NaN;
    let call: Promise<void>;
    try {
      call = synth(this.lanes, this.bank, QUANTUM);
    } catch (e) {
      this.meter.fail('synth', e);
      return;
    }
    if (!Number.isNaN(this.lanes[0])) this.meter.filledOnReturn++;
    call.then(
      () => {
        mixLanes(out, this.lanes, this.o.voices, this.gain);
        this.pending = false;
        this.meter.done(frame, start);
      },
      (e: unknown) => {
        this.pending = false;
        this.meter.fail('synth', e);
        this.meter.done(frame, start);
      },
    );
  }

  /** Variants (b) and the reference: `tick()` once per voice and per frame, in the order of the voices. */
  private tick(out: Float32Array, voices: readonly { tick(): number }[]): void {
    const f = Math.fround;
    const sum = this.sum;
    sum.fill(0);
    for (const voice of voices) {
      for (let n = 0; n < QUANTUM; n++) sum[n] = f(sum[n]! + voice.tick());
    }
    for (let n = 0; n < QUANTUM; n++) out[n] = f(sum[n]! * this.gain);
  }
}

scope.registerProcessor('exp02', Processor);
