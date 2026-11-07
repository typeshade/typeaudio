import ts from "typescript";
import {
  sourceFile,
  entryFunction,
  tag,
  compositionFailure,
} from "./source.ts";

export function compositionStructure(source: string) {
  const file = sourceFile(source),
    entry = entryFunction(file);
  const imports = new Map<string, ts.ImportDeclaration>(),
    states = new Map<string, ts.ImportDeclaration>();
  for (const statement of file.statements)
    if (ts.isImportDeclaration(statement)) {
      const id = tag(statement, "typeaudioDefinition"),
        state = tag(statement, "typeaudioStateType");
      const map = id !== undefined ? imports : states,
        key = id ?? state;
      if (key === undefined) continue;
      if (map.has(key))
        compositionFailure(
          file,
          statement,
          "Duplicate composition import identity.",
        );
      map.set(key, statement);
    }
  const nodes = new Map<string, ts.VariableStatement>();
  let output: ts.ReturnStatement | undefined;
  for (const statement of entry.body!.statements) {
    if (ts.isReturnStatement(statement) && !output) {
      output = statement;
      continue;
    }
    if (
      output ||
      !ts.isVariableStatement(statement) ||
      !(statement.declarationList.flags & ts.NodeFlags.Const) ||
      statement.declarationList.declarations.length !== 1
    )
      compositionFailure(
        file,
        statement,
        "Composition supports const function calls followed by one return. Put loops, branches and processing expressions inside a TypeShade function module.",
      );
    const declaration = statement.declarationList.declarations[0]!;
    if (
      !ts.isIdentifier(declaration.name) ||
      !declaration.initializer ||
      !ts.isCallExpression(declaration.initializer)
    )
      compositionFailure(
        file,
        declaration,
        "Assign one named function call to each node variable.",
      );
    const id = tag(statement, "typeaudioNode") ?? declaration.name.text;
    if (nodes.has(id))
      compositionFailure(
        file,
        statement,
        `Duplicate instance identity: ${id}.`,
      );
    nodes.set(id, statement);
  }
  if (!output?.expression || !ts.isIdentifier(output.expression))
    compositionFailure(file, entry, "Return the variable of one audio node.");
  return { file, entry, imports, states, nodes, output };
}
export function importName(statement: ts.ImportDeclaration) {
  const bindings = statement.importClause?.namedBindings;
  if (
    !bindings ||
    !ts.isNamedImports(bindings) ||
    bindings.elements.length !== 1
  )
    compositionFailure(
      statement.getSourceFile(),
      statement,
      "Use one named import for each composition definition or state type.",
    );
  return bindings.elements[0]!;
}
export function importPath(statement: ts.ImportDeclaration) {
  if (!ts.isStringLiteral(statement.moduleSpecifier))
    compositionFailure(
      statement.getSourceFile(),
      statement,
      "Use a virtual module path.",
    );
  return new URL(
    statement.moduleSpecifier.text,
    `file://${statement.getSourceFile().fileName}`,
  ).pathname;
}
