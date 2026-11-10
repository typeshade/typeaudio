import type { FunctionGraphProgram, FunctionDescriptor } from "../program.ts";
import type { FunctionParameter, ScalarValue } from "../types.ts";
import { validateFunctionDocument } from "../validateDocument.ts";
import { validateFunctionConnections } from "../validateConnections.ts";
import { functionKey } from "../functionKey.ts";
import { scalarValue } from "../scalarValue.ts";
import { FunctionCall } from "./FunctionCall.ts";

type Binding =
  | { argument: number; source: FunctionCall }
  | { argument: number; parameter: FunctionParameter };
type Plan = { call: FunctionCall; bindings: Binding[] };

/** Host-independent synchronous mono processing. Construction owns all preparation. */
export class FunctionGraphDsp {
  private readonly calls = new Map<string, FunctionCall>();
  private readonly parameters = new Map<string, FunctionParameter>();
  private readonly block: Plan[] = [];
  private readonly sample: Plan[] = [];
  private readonly output: FunctionCall;
  readonly sampleRate: number;
  frames = 0;
  faultNode: string | undefined;
  fault: unknown;
  constructor(
    program: FunctionGraphProgram,
    options: { sampleRate?: number; previous?: FunctionGraphDsp } = {},
  ) {
    if (
      program.schema !== "typeaudio.function-program" ||
      program.version !== 1
    )
      throw new Error("Unsupported function program.");
    this.sampleRate = options.sampleRate ?? 48000;
    if (
      !Number.isInteger(this.sampleRate) ||
      this.sampleRate < 8000 ||
      this.sampleRate > 192000
    )
      throw new Error("Sample rate must be 8000–192000 Hz.");
    const g = validateFunctionDocument(program.document);
    const descriptors = program.artifacts.map(
      (a) => JSON.parse(JSON.stringify(a.descriptor)) as FunctionDescriptor,
    );
    const order = validateFunctionConnections(g, descriptors);
    for (const p of g.parameters) {
      p.value = scalarValue(p.value, p.type, p.id);
      this.parameters.set(p.id, p);
    }
    for (const id of order) {
      const node = g.nodes.find((n) => n.id === id)!;
      const definition = g.definitions.find((d) => d.id === node.definition)!;
      const index = descriptors.findIndex((d) => d.id === definition.id),
        artifact = program.artifacts[index];
      if (!artifact || artifact.key !== functionKey(g.modules, definition))
        throw new Error(
          `${id}: compiled artifact belongs to different source.`,
        );
      const descriptor = descriptors[index]!;
      const call = new FunctionCall(
        id,
        descriptor,
        artifact.key,
        options.previous?.sampleRate === this.sampleRate &&
        !options.previous.fault
          ? options.previous.calls.get(id)
          : undefined,
      );
      this.calls.set(id, call);
      const plan: Plan = { call, bindings: [] };
      for (const p of descriptor.inputs) {
        const b = node.inputs[p.id];
        if (!b || b.kind === "constant")
          call.args[p.argument] = scalarValue(
            b?.kind === "constant" ? b.value : p.default,
            p.type,
            `${id}.${p.id}`,
          );
        else if (b.kind === "parameter")
          plan.bindings.push({
            argument: p.argument,
            parameter: this.parameters.get(b.parameter)!,
          });
        else
          plan.bindings.push({
            argument: p.argument,
            source: this.calls.get(b.node)!,
          });
      }
      for (const c of descriptor.context)
        call.args[c.argument] = c.value === "sampleRate" ? this.sampleRate : 0;
      (descriptor.output.rate === "block" ? this.block : this.sample).push(
        plan,
      );
    }
    this.output = this.calls.get(g.output.node)!;
    if (options.previous?.sampleRate === this.sampleRate)
      this.frames = options.previous.frames;
  }
  setParameter(id: string, value: ScalarValue) {
    const p = this.parameters.get(id);
    if (!p) throw new Error(`Unknown function parameter: ${id}.`);
    const next = scalarValue(value, p.type, id);
    if (
      (p.min !== undefined && Number(next) < p.min) ||
      (p.max !== undefined && Number(next) > p.max)
    )
      throw new Error(`${id}: value outside its range.`);
    p.value = next;
  }
  reset() {
    for (const call of this.calls.values()) call.reset();
    this.frames = 0;
    this.faultNode = undefined;
    this.fault = undefined;
  }
  private run(plan: Plan, frame: number) {
    for (const b of plan.bindings)
      plan.call.args[b.argument] =
        "source" in b ? b.source.value : b.parameter.value;
    for (const c of plan.call.descriptor.context)
      if (c.value === "time")
        plan.call.args[c.argument] = frame / this.sampleRate;
    this.faultNode = plan.call.id;
    if (!plan.call.run()) throw this.nonFinite;
  }
  private readonly nonFinite = new Error(
    "Function produced a non-finite output or state value.",
  );
  process(out: Float32Array, frames = out.length) {
    if (
      !(out instanceof Float32Array) ||
      !Number.isInteger(frames) ||
      frames < 1 ||
      frames > 128 ||
      frames > out.length
    )
      throw new RangeError("Provide a Float32Array with 1–128 output frames.");
    if (this.fault) {
      out.fill(0, 0, frames);
      this.frames += frames;
      return false;
    }
    try {
      for (const p of this.block) this.run(p, this.frames);
      for (let i = 0; i < frames; i++) {
        for (const p of this.sample) this.run(p, this.frames + i);
        out[i] = this.output.value as number;
      }
      this.faultNode = undefined;
    } catch (error) {
      this.fault = error;
      out.fill(0, 0, frames);
    }
    this.frames += frames;
    return !this.fault;
  }
}
