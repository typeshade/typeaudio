import type { GraphVoiceOptions } from "./voiceOptions.ts";
import { validateGraph } from "./validateGraph.ts";
import { graphKey } from "./graphIdentity.ts";
import { graphValues } from "./graphParameters.ts";
import { orderedNodes } from "./orderGraph.ts";
import { type SoundGraph } from "./types.ts";
import { graphKernel, type GraphKernel } from "./registry.ts";
/** Compiled graph execution only. Compiler, imports and allocations stay out of process(). */
export class GraphDsp {
  private key: string;
  private kernel: GraphKernel;
  private state: Float32Array;
  private clock: Uint32Array;
  private current: Float32Array;
  private target: Float32Array;
  private discrete = new Set<number>();
  private scratch = new Float32Array(128);
  private volume: number;
  private targetVolume: number;
  private fade = 0;
  private graph: SoundGraph;
  oneShot = true;
  repeat = false;
  dry = false;
  frames = 0;
  revision = 0;
  invalidSamples = 0;
  constructor(p: GraphVoiceOptions, previous?: GraphDsp) {
    if (!Number.isFinite(p.volume) || p.volume < 0 || p.volume > 1)
      throw new RangeError("Graph volume must be between zero and one.");
    const g = validateGraph(p.graph);
    this.graph = g;
    this.key = graphKey(g);
    this.kernel = graphKernel(this.key);
    this.state = new Float32Array(g.nodes.length * 4);
    this.clock = new Uint32Array(g.nodes.length + 1);
    this.current = graphValues(g);
    this.target = this.current.slice();
    this.volume = this.targetVolume = p.volume;
    this.configureDiscrete(g);
    if (previous) {
      this.clock[0] = previous.clock[0]!;
      const oldNodes = orderedNodes(previous.graph);
      orderedNodes(g).forEach((n, i) => {
        const at = oldNodes.findIndex(
          (old) =>
            old.id === n.id &&
            old.kind === n.kind &&
            old.code === n.code &&
            Object.keys(old.inputs).length === Object.keys(n.inputs).length &&
            Object.entries(old.inputs).every(
              ([port, source]) => n.inputs[port] === source,
            ),
        );
        if (at >= 0) {
          for (let j = 0; j < 4; j++)
            this.state[i * 4 + j] = previous.state[at * 4 + j]!;
          this.clock[i + 1] = previous.clock[at + 1]!;
        }
      });
    }
  }
  private configureDiscrete(g: SoundGraph) {
    this.discrete.clear();
    orderedNodes(g).forEach((n, i) => {
      if (n.kind === "parameter" || n.kind === "noise")
        this.discrete.add(4 + i * 2);
      if (n.kind === "oscillator") this.discrete.add(5 + i * 2);
    });
  }
  update(p: GraphVoiceOptions, _repeat = false, _dry = false) {
    if (!Number.isFinite(p.volume) || p.volume < 0 || p.volume > 1)
      throw new RangeError("Graph volume must be between zero and one.");
    const g = validateGraph(p.graph),
      key = graphKey(g);
    if (key !== this.key)
      throw new Error("Graph structure changes need a new processor state.");
    this.target.set(graphValues(g));
    this.targetVolume = p.volume;
    this.revision++;
  }
  retrigger() {
    this.state.fill(0);
    this.clock.fill(0);
    this.fade = 0;
  }
  process(out: Float32Array, frames = out.length, dryOut?: Float32Array) {
    if (!Number.isInteger(frames) || frames < 1 || frames > 128 || frames > out.length || (dryOut && frames > dryOut.length))
      throw new RangeError("Graph blocks need 1–128 frames and output buffers of that size.");
    const smoothing = 1 - Math.exp(-frames / (48000 * 0.012));
    for (let i = 0; i < this.current.length; i++)
      this.current[i] = this.discrete.has(i)
        ? this.target[i]!
        : this.current[i]! + (this.target[i]! - this.current[i]!) * smoothing;
    this.volume += (this.targetVolume - this.volume) * smoothing;
    this.kernel(this.scratch, this.state, this.clock, this.current, frames);
    for (let i = 0; i < frames; i++) {
      let v = this.scratch[i]!;
      if (!Number.isFinite(v)) {
        v = 0;
        this.invalidSamples++;
      }
      this.fade = Math.min(1, this.fade + 1 / 240);
      v = Math.max(-1, Math.min(1, v * this.volume)) * this.fade;
      out[i] = v;
      if (dryOut) dryOut[i] = v;
    }
    for (let i = 0; i < this.state.length; i++)
      if (!Number.isFinite(this.state[i])) this.state[i] = 0;
    this.frames += frames;
  }
}
