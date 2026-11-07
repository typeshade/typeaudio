import ts from "typescript";
import type { CompileResult } from "typeshade";
// Measured pinned adapter, pending compiler proposal 0122 and allocation issue #961.
import { generateModuleJs } from "../../../node_modules/typeshade/src/core/cpu-codegen.ts";
import { SCALAR_FUNCTIONS } from "../../graph/scalarFunctions.ts";
import { compiledFunctions } from "./compiledFunctions.ts";
import { reachableFunctions } from "./reachableFunctions.ts";
import { adaptCpuFunctions } from "./adaptCpuFunctions.ts";
import { auditCpuFunction } from "./auditCpuFunction.ts";

export function prepareCpuFunction(
  module: CompileResult["module"],
  entry: string,
  initializer: string | undefined,
  key: string,
) {
  if (module.bindings.length || module.vars?.length || module.overrides?.length)
    throw new Error(
      "The synchronous function profile uses explicit arguments and instance state; GPU resources and module variables need another execution profile.",
    );
  const generated = generateModuleJs(module, { precision: "f32" });
  const { source, functions } = compiledFunctions(generated.fns);
  const audio = reachableFunctions(functions, entry);
  const setup = initializer
    ? reachableFunctions(functions, initializer)
    : new Set<string>();
  const all = new Set([...audio, ...setup]);
  if (generated.fallbacks.some((name) => all.has(name)))
    throw new Error(
      "Processing requires compiled CPU code without interpreter fallback.",
    );
  const allowed = new Set([
    ...SCALAR_FUNCTIONS,
    "pow",
    "round",
    "trunc",
    "log",
    "log2",
    "sign",
  ]);
  for (const declaration of generated.decls) {
    const binding = /\$\.(?:L|B)\["([^"]+)"\]/.exec(declaration)?.[1];
    if (binding && !allowed.has(binding))
      throw new Error(
        `CPU function profile does not support helper ${binding}.`,
      );
  }
  const { source: transformed, reusedInoutArrays } = adaptCpuFunctions(source);
  const table = (transformed.statements[0] as ts.VariableStatement)
    .declarationList.declarations[0]!.initializer as ts.ObjectLiteralExpression;
  const printer = ts.createPrinter();
  const declarations: string[] = [];
  for (const property of table.properties as ts.NodeArray<ts.PropertyAssignment>) {
    const name = (property.name as ts.StringLiteral).text;
    if (!all.has(name)) continue;
    if (audio.has(name))
      auditCpuFunction(
        name,
        printer.printNode(ts.EmitHint.Unspecified, property, transformed),
      );
    declarations.push(
      printer.printNode(ts.EmitHint.Unspecified, property, transformed),
    );
  }
  const maxArgs = Math.max(
    1,
    ...[...all].map((name) => functions.get(name)!.parameters.length),
  );
  const stepLimit = 2048;
  const code = `globalThis.__typeaudioRegisterFunction(${JSON.stringify(key)}, function($) {
let __remaining = 0;
const __budgetError = new Error("Function processing exceeded its call/loop step budget.");
function __audioStep() { if (--__remaining < 0) throw __budgetError; }
$.inout = {values: new Array(${maxArgs}).fill(0)};
${generated.decls.join("\n")}
const functions = {${declarations.join(",\n")}};
$.F = functions;
return {
  invoke(args) { __remaining = ${stepLimit}; return functions[${JSON.stringify(entry)}].apply(undefined, args); },
  initialize() { __remaining = 16384; return ${initializer ? `functions[${JSON.stringify(initializer)}]()` : "undefined"}; },
  state(args, index) { return $.inout.values[index]; }
};
});`;
  return {
    code,
    report: {
      backend: "compiled-cpu-f32" as const,
      functions: [...audio],
      reusedInoutArrays,
      stepLimit,
    },
  };
}
