import ts from "typescript";
import type { FunctionDefinition } from "../../types.ts";
import { sourceFile, compositionFailure } from "./source.ts";
import type { functionLanguage } from "../functionLanguage.ts";

export function stateReference(
  definition: FunctionDefinition,
  modules: Record<string, string>,
  language: ReturnType<typeof functionLanguage>,
) {
  const file = sourceFile(modules[definition.module]!, definition.module);
  const entry = file.statements.find(
    (s): s is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(s) && s.name?.text === definition.export,
  )!;
  const parameter = entry.parameters.find(
    (p) =>
      ts.isIdentifier(p.name) && p.name.text === definition.state!.parameter,
  )!;
  const type = parameter.type;
  if (!type || !ts.isTypeReferenceNode(type) || !type.typeArguments?.[0])
    compositionFailure(
      file,
      parameter,
      "Composition needs an explicit inout<State> type.",
    );
  const at = file.getLineAndCharacterOfPosition(
    type.typeArguments[0]!.getStart(file),
  );
  const targets = language.getDefinition(`file://${definition.module}`, {
    line: at.line,
    character: at.character,
  });
  for (const target of targets) {
    const path = new URL(target.uri).pathname,
      source = modules[path];
    if (!source) continue;
    const owner = sourceFile(source, path),
      offset = owner.getPositionOfLineAndCharacter(
        target.range.start.line,
        target.range.start.character,
      );
    const state = owner.statements.find(
      (s): s is ts.ClassDeclaration =>
        ts.isClassDeclaration(s) &&
        !!s.name &&
        s.name.getStart(owner) <= offset &&
        s.name.end >= offset,
    );
    if (!state) continue;
    if (!state.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
      compositionFailure(
        owner,
        state,
        `Export ${state.name!.text} to expose its type in composition code. Node playback remains available.`,
      );
    return { module: path, name: state.name!.text };
  }
  return compositionFailure(
    file,
    parameter,
    "Expose a named exported state class to use this function in composition code.",
  );
}
