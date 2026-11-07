import type { FunctionDescriptor } from "../program.ts";
import type { ScalarValue } from "../types.ts";
import { scalarValue } from "../scalarValue.ts";
import { instantiateFunction, type FunctionState } from "./registry.ts";

/** One call instance owns its typed state and reusable argument storage. */
export class FunctionCall {
  readonly executable: ReturnType<typeof instantiateFunction>;
  readonly args: (ScalarValue | FunctionState)[];
  private readonly initial: FunctionState | undefined;
  value: ScalarValue = 0;
  constructor(
    readonly id: string,
    readonly descriptor: FunctionDescriptor,
    key: string,
    previous?: FunctionCall,
  ) {
    this.executable = instantiateFunction(key);
    this.args = new Array(descriptor.argumentCount).fill(0);
    const schema = descriptor.state;
    if (schema) {
      const state = this.executable.initialize();
      if (!state || typeof state !== "object" || Array.isArray(state))
        throw new Error(`${id}: initializer must return typed state.`);
      for (const f of schema.fields)
        state[f.name] = scalarValue(
          Object.hasOwn(state, f.name) ? state[f.name] : undefined,
          f.type,
          `${id}.state.${f.name}`,
        );
      this.initial = { ...state };
      if (
        previous?.descriptor.id === descriptor.id &&
        previous.descriptor.state?.version === schema.version &&
        JSON.stringify(previous.descriptor.state.fields) ===
          JSON.stringify(schema.fields)
      ) {
        const old = previous.args[
          previous.descriptor.state.argument
        ] as FunctionState;
        for (const f of schema.fields) state[f.name] = old[f.name]!;
      }
      this.args[schema.argument] = state;
    }
  }
  run() {
    this.value = this.executable.invoke(this.args);
    if (this.descriptor.state) {
      this.args[this.descriptor.state.argument] = this.executable.state(
        this.args,
        this.descriptor.state.argument,
      );
      const state = this.args[this.descriptor.state.argument] as FunctionState;
      for (const field of this.descriptor.state.fields)
        if (
          typeof state[field.name] !== "boolean" &&
          !Number.isFinite(state[field.name])
        )
          return false;
    }
    return typeof this.value === "boolean" || Number.isFinite(this.value);
  }
  reset() {
    const schema = this.descriptor.state;
    if (schema && this.initial) {
      const state = this.args[schema.argument] as FunctionState;
      for (const field of schema.fields)
        state[field.name] = this.initial[field.name]!;
    }
    this.value = 0;
  }
}
