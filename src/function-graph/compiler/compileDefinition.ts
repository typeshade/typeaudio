import { readFunction } from "./readFunction.ts";
import type { FunctionDefinition } from "../types.ts";
import type { FunctionArtifact } from "../program.ts";
import { FunctionCompileError } from "./diagnostics.ts";
import { reflectDefinition } from "./reflectDefinition.ts";
import { prepareCpuFunction } from "./prepareCpuFunction.ts";
import { functionKey } from "../functionKey.ts";

export function compileFunctionDefinition(
  modules: Record<string, string>,
  definition: FunctionDefinition,
): FunctionArtifact {
  const { module, entry } = readFunction(modules, definition);
  const descriptor = reflectDefinition(definition, module, entry);
  const key = functionKey(modules, definition);
  try {
    return {
      key,
      descriptor,
      ...prepareCpuFunction(
        module,
        entry.name,
        definition.state?.initializer,
        key,
      ),
    };
  } catch (error) {
    throw new FunctionCompileError([
      {
        ...descriptor.location,
        definition: definition.id,
        message: error instanceof Error ? error.message : String(error),
      },
    ]);
  }
}
