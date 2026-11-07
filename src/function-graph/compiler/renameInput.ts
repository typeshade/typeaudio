import ts from "typescript";
import { validateFunctionDocument } from "../validateDocument.ts";
import { compileFunctionGraph } from "./compileFunctionGraph.ts";
import { functionLanguage } from "./functionLanguage.ts";
import { sourceFile, compositionFailure } from "./composition/source.ts";

/** Rename source symbols and audio metadata together; existing stable pin IDs never change. */
export function renameFunctionInput(
  raw: unknown,
  definitionId: string,
  portId: string,
  newName: string,
) {
  const graph = validateFunctionDocument(raw),
    definition = graph.definitions.find((d) => d.id === definitionId);
  compileFunctionGraph(graph);
  const sourceName =
    definition &&
    Object.keys(definition.inputs).find(
      (name) => definition.inputs[name]!.id === portId,
    );
  if (!definition || !sourceName)
    throw new Error("Select an existing function input to rename.");
  if (newName === sourceName) return graph;
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    newName,
  );
  if (
    !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(newName) ||
    scanner.scan() !== ts.SyntaxKind.Identifier ||
    ["__proto__", "prototype", "constructor"].includes(newName)
  )
    throw new Error(
      "Use a TypeShade parameter identifier of at most 64 characters.",
    );
  const file = sourceFile(graph.modules[definition.module]!, definition.module);
  const entry = file.statements.find(
    (s): s is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(s) && s.name?.text === definition.export,
  )!;
  const parameter = entry.parameters.find(
    (p) => ts.isIdentifier(p.name) && p.name.text === sourceName,
  )!;
  if (
    entry.parameters.some(
      (p) => ts.isIdentifier(p.name) && p.name.text === newName,
    )
  )
    compositionFailure(file, parameter, `${newName} is already a parameter.`);
  const at = file.getLineAndCharacterOfPosition(parameter.name.getStart(file));
  const edits = functionLanguage(graph.modules).rename(
    `file://${definition.module}`,
    { line: at.line, character: at.character },
    newName,
  );
  if (!Object.keys(edits).length)
    compositionFailure(
      file,
      parameter,
      "TypeShade could not rename this parameter.",
    );
  for (const [uri, changes] of Object.entries(edits)) {
    const path = new URL(uri).pathname,
      source = graph.modules[path];
    if (source === undefined)
      throw new Error(
        "Rename attempted to edit outside the project source set.",
      );
    const owner = sourceFile(source, path),
      replacements = changes
        .map((e) => ({
          start: owner.getPositionOfLineAndCharacter(
            e.range.start.line,
            e.range.start.character,
          ),
          end: owner.getPositionOfLineAndCharacter(
            e.range.end.line,
            e.range.end.character,
          ),
          text: e.newText,
        }))
        .sort((a, b) => b.start - a.start);
    let text = source;
    for (const e of replacements)
      text = text.slice(0, e.start) + e.text + text.slice(e.end);
    graph.modules[path] = text;
  }
  definition.inputs[newName] = definition.inputs[sourceName]!;
  delete definition.inputs[sourceName];
  compileFunctionGraph(graph);
  return graph;
}
