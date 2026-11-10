import { SpatialMixer } from '../../../src/spatial/index.ts';
import type { SpatialTarget } from '../../../src/spatial/index.ts';
interface Options {
  processorOptions: { first: SpatialTarget; second: SpatialTarget; switchFrame: number };
}
interface ProcessorBase { readonly port: MessagePort }
const scope = globalThis as unknown as {
  sampleRate: number;
  AudioWorkletProcessor: new () => ProcessorBase;
  registerProcessor(name: string, processor: new (options: Options) => ProcessorBase): void;
};
class SpatialCheck extends scope.AudioWorkletProcessor {
  private readonly mixer = new SpatialMixer({ capacity: 1, sampleRate: scope.sampleRate });
  private readonly second: SpatialTarget;
  private readonly switchFrame: number;
  private frame = 0;
  constructor(options: Options) {
    super();
    this.second = options.processorOptions.second;
    this.switchFrame = options.processorOptions.switchFrame;
    this.mixer.setSource(0, options.processorOptions.first);
  }
  process(inputs: readonly (readonly Float32Array[])[], outputs: readonly (readonly Float32Array[])[]): boolean {
    if (this.frame === this.switchFrame) this.mixer.setSource(0, this.second);
    const channels = outputs[0];
    this.mixer.process(inputs[0], channels[0], channels[1], channels[0].length);
    this.frame += channels[0].length;
    return true;
  }
}
scope.registerProcessor('typeaudio-spatial-check', SpatialCheck);
