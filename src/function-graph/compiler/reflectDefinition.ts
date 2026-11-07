import type { CompileResult, FuncDecl, ShaderType } from "typeshade";
import type { FunctionDefinition, ScalarType } from "../types.ts";
import type { FunctionDescriptor, FunctionLocation } from "../program.ts";
import { scalarValue } from "../scalarValue.ts";
import { FunctionCompileError } from "./diagnostics.ts";

export function reflectDefinition(
  d: FunctionDefinition,
  module: CompileResult["module"],
  entry: FuncDecl,
): FunctionDescriptor {
  const location: FunctionLocation = {
    file: entry.span?.file ?? d.module,
    line: (entry.span?.line ?? 0) + 1,
    column: (entry.span?.character ?? 0) + 1,
  };
  const fail = (message: string): never => {
    throw new FunctionCompileError([
      { ...location, definition: d.id, message },
    ]);
  };
  const scalar = (type: ShaderType, label: string): ScalarType => {
    if (
      type.kind !== "scalar" ||
      !["f32", "i32", "u32", "bool"].includes(type.scalar)
    )
      return fail(
        `${label}: this CPU audio profile requires f32, i32, u32 or bool.`,
      );
    return type.scalar as ScalarType;
  };
  if (entry.kernel || entry.stage)
    fail(
      "Expose an ordinary processing function, not a dispatch or graphics entry point.",
    );
  if (entry.params.length > 18)
    fail("This profile supports at most 18 processing arguments.");
  const result: FunctionDescriptor = {
    id: d.id,
    version: d.version,
    export: d.export,
    location,
    argumentCount: entry.params.length,
    inputs: [],
    output: { ...d.output, type: scalar(entry.ret, "Return value") },
    context: [],
  };
  for (const [argument, p] of entry.params.entries()) {
    const input = Object.hasOwn(d.inputs, p.name)
      ? d.inputs[p.name]
      : undefined;
    const context =
      d.context && Object.hasOwn(d.context, p.name)
        ? d.context[p.name]
        : undefined;
    const state = d.state?.parameter === p.name;
    if (Number(!!input) + Number(!!context) + Number(state) !== 1)
      fail(`${p.name}: assign exactly one input, context or state binding.`);
    if (state) {
      if (p.type.kind !== "struct" || p.mode !== "inout")
        fail(`${p.name}: state must be an inout<State> parameter.`);
      const name = p.type.kind === "struct" ? p.type.name : "";
      const fields = module.structs.find((s) => s.name === name)?.fields;
      const initializer = module.funcs.find(
        (f) => f.name === d.state!.initializer,
      );
      if (!fields?.length || fields.length > 32)
        fail("This profile supports 1–32 scalar state fields.");
      if (
        !initializer ||
        initializer.params.length ||
        initializer.ret.kind !== "struct" ||
        initializer.ret.name !== name
      )
        fail(
          "Provide a zero-argument initializer returning the declared state type.",
        );
      result.state = {
        argument,
        version: d.state!.version,
        fields: fields!.map((f) => ({
          name: f.name,
          type: scalar(f.type, `State ${f.name}`),
        })),
      };
    } else {
      if (p.mode)
        fail(
          `${p.name}: writable parameters must be the declared instance state.`,
        );
      const type = scalar(p.type, p.name);
      if (context) {
        if (type !== "f32") fail(`${p.name}: time and sampleRate need f32.`);
        if (context === "time" && d.output.rate !== "sample")
          fail("Sample time requires a sample-rate function.");
        result.context.push({ argument, value: context! });
      } else {
        if (input!.role === "audio" && type !== "f32")
          fail(`${p.name}: mono audio requires f32.`);
        if (d.output.rate === "block" && input!.rate !== "block")
          fail(
            `${p.name}: a block-rate function cannot consume sample-rate input.`,
          );
        if (input!.default !== undefined)
          scalarValue(input!.default, type, `${d.id}.${p.name}`);
        result.inputs.push({ ...input!, name: p.name, type, argument });
      }
    }
  }
  for (const name of [
    ...Object.keys(d.inputs),
    ...Object.keys(d.context ?? {}),
    ...(d.state ? [d.state.parameter] : []),
  ])
    if (!entry.params.some((p) => p.name === name))
      fail(`${name}: no such parameter in ${d.export}.`);
  if (result.output.role === "audio" && result.output.type !== "f32")
    fail("Mono audio output must return f32.");
  return result;
}
