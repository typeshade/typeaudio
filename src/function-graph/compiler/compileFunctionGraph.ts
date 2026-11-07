import type { FunctionGraphProgram } from "../program.ts";
import { validateFunctionDocument } from "../validateDocument.ts";
import { validateFunctionConnections } from "../validateConnections.ts";
import { compileFunctionDefinition } from "./compileDefinition.ts";

/** Control-thread operation. Source modules and audio bindings pass one compiler path. */
export function compileFunctionGraph(raw: unknown): FunctionGraphProgram {
  const document = validateFunctionDocument(raw);
  const artifacts = document.definitions.map((d) =>
    compileFunctionDefinition(document.modules, d),
  );
  const order = validateFunctionConnections(
    document,
    artifacts.map((a) => a.descriptor),
  );
  return {
    schema: "typeaudio.function-program",
    version: 1,
    document,
    artifacts,
    order,
  };
}
