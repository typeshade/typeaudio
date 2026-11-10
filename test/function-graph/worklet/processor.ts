import { FunctionGraphDsp } from "../../../src/function-graph/runtime/index.ts";
import type { FunctionGraphProgram } from "../../../src/function-graph/program.ts";

interface Options {
  processorOptions: { program: FunctionGraphProgram };
}
interface Base {
  readonly port: MessagePort;
}
const scope = globalThis as unknown as {
  sampleRate: number;
  AudioWorkletProcessor: new () => Base;
  registerProcessor: (
    name: string,
    processor: new (options: Options) => Base,
  ) => void;
};

class FunctionGraphCheck extends scope.AudioWorkletProcessor {
  private readonly dsp: FunctionGraphDsp;
  private frame = 0;
  constructor(options: Options) {
    super();
    this.dsp = new FunctionGraphDsp(options.processorOptions.program, {
      sampleRate: scope.sampleRate,
    });
  }
  process(
    _inputs: readonly (readonly Float32Array[])[],
    outputs: readonly (readonly Float32Array[])[],
  ) {
    if (this.frame === 2048) this.dsp.setParameter("pitch", 420);
    if (this.frame === 4096) this.dsp.setParameter("strength", 0.3);
    if (this.frame === 6144) this.dsp.reset();
    const ok = this.dsp.process(outputs[0]![0]!);
    if (!ok) throw this.dsp.fault;
    this.frame += outputs[0]![0]!.length;
    return true;
  }
}
scope.registerProcessor("typeaudio-function-check", FunctionGraphCheck);
