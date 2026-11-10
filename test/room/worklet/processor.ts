import { RoomMixer } from '../../../src/spatial/room/index.ts';
import type { PreparedRoom, RoomSourceTarget } from '../../../src/spatial/room/index.ts';

interface Options {
  processorOptions: { room: PreparedRoom; targets: RoomSourceTarget[]; switchFrames: number[] };
}
interface ProcessorBase { readonly port: MessagePort }
const scope = globalThis as unknown as {
  sampleRate: number;
  AudioWorkletProcessor: new () => ProcessorBase;
  registerProcessor(name: string, processor: new (options: Options) => ProcessorBase): void;
};
class RoomCheck extends scope.AudioWorkletProcessor {
  private readonly mixer: RoomMixer;
  private readonly targets: RoomSourceTarget[];
  private readonly switchFrames: number[];
  private frame = 0;
  private event = 0;
  constructor(options: Options) {
    super();
    const { room, targets, switchFrames } = options.processorOptions;
    if (room.sampleRate !== scope.sampleRate) throw new Error('Room sample rate mismatch.');
    this.mixer = new RoomMixer(room, { capacity: 1 });
    this.targets = targets; this.switchFrames = switchFrames;
    this.mixer.setSource(0, targets[0]);
  }
  process(inputs: readonly (readonly Float32Array[])[], outputs: readonly (readonly Float32Array[])[]): boolean {
    if (this.frame === this.switchFrames[this.event]) this.mixer.setSource(0, this.targets[++this.event]);
    const channels = outputs[0];
    this.mixer.process(inputs[0], channels[0], channels[1], channels[0].length);
    this.frame += channels[0].length;
    return true;
  }
}
scope.registerProcessor('typeaudio-room-check', RoomCheck);
