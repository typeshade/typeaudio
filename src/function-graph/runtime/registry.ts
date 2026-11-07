import { createCodegenRuntime } from "typeshade/runtime/internal";
import type { ScalarValue } from "../types.ts";

export type FunctionState = Record<string, ScalarValue>;
export interface FunctionExecutable {
  invoke(args: (ScalarValue | FunctionState)[]): ScalarValue;
  initialize(): FunctionState | undefined;
  state(args: (ScalarValue | FunctionState)[], index: number): FunctionState;
}
type Factory = (
  runtime: ReturnType<typeof createCodegenRuntime>,
) => FunctionExecutable;
const factories = new Map<string, Factory>();
const scope = globalThis as unknown as {
  __typeaudioRegisterFunction: (key: string, factory: Factory) => void;
};
scope.__typeaudioRegisterFunction = (key, factory) => {
  if (factories.size >= 64 && !factories.has(key))
    factories.delete(factories.keys().next().value!);
  factories.set(key, factory);
};
/** Registration modules are trusted compiler output, never imported project source. */
export function instantiateFunction(key: string) {
  const factory = factories.get(key);
  if (!factory)
    throw new Error(
      "Load the compiled function registration module before preparing audio.",
    );
  return factory(createCodegenRuntime());
}
