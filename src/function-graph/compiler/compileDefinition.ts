import ts from "typescript";
import { compile } from "typeshade";
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
  const text = modules[definition.module]!;
  const compiled = compile(text, {
    fileName: definition.module,
    readDocument: (path) =>
      Object.hasOwn(modules, path) ? modules[path] : undefined,
  });
  const errors = compiled.diagnostics.filter((d) => d.category === "error");
  if (errors.length)
    throw new FunctionCompileError(
      errors.map((d) => ({
        definition: definition.id,
        file: d.fileName,
        line: d.line ?? 1,
        column: d.character,
        message: d.message,
      })),
    );
  // Only select actual named exports; types and import semantics remain TypeShade's.
  const file = ts.createSourceFile(
    definition.module,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const exported = (name: string) =>
    file.statements.some(
      (n) =>
        ts.isFunctionDeclaration(n) &&
        n.name?.text === name &&
        n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword),
    );
  const entry = compiled.module.funcs.find(
    (f) => f.name === definition.export && f.span?.file === definition.module,
  );
  if (
    !entry ||
    !exported(definition.export) ||
    (definition.state && !exported(definition.state.initializer))
  )
    throw new FunctionCompileError([
      {
        definition: definition.id,
        file: definition.module,
        line: 1,
        column: 1,
        message:
          "Select named exported processing and initializer functions from this module.",
      },
    ]);
  const descriptor = reflectDefinition(definition, compiled.module, entry);
  const key = functionKey(modules, definition);
  try {
    return {
      key,
      descriptor,
      ...prepareCpuFunction(
        compiled.module,
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
