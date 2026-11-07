import ts from "typescript";
import { FUNCTION_COMPOSITION_PATH } from "../../composition.ts";
import { FunctionCompileError } from "../diagnostics.ts";

export function compositionFailure(
  file: ts.SourceFile,
  node: ts.Node | number,
  message: string,
): never {
  const position = file.getLineAndCharacterOfPosition(
    typeof node === "number" ? node : node.getStart(file),
  );
  throw new FunctionCompileError([
    {
      definition: "composition",
      file: file.fileName,
      line: position.line + 1,
      column: position.character + 1,
      message,
    },
  ]);
}
export function sourceFile(source: string, path = FUNCTION_COMPOSITION_PATH) {
  if (source.length > 131072)
    throw new Error("Composition source exceeds 131072 characters.");
  const file = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const diagnostics = (
    file as ts.SourceFile & { parseDiagnostics: ts.DiagnosticWithLocation[] }
  ).parseDiagnostics;
  if (diagnostics.length)
    compositionFailure(
      file,
      diagnostics[0]!.start ?? 0,
      ts.flattenDiagnosticMessageText(diagnostics[0]!.messageText, "\n"),
    );
  return file;
}
export function tag(node: ts.Node, name: string): string | undefined {
  const tags = ts.getJSDocTags(node).filter((t) => t.tagName.text === name);
  if (tags.length > 1)
    compositionFailure(
      node.getSourceFile(),
      node,
      `Use one @${name} identity.`,
    );
  const value = tags[0]?.comment;
  return tags.length
    ? typeof value === "string"
      ? value.trim()
      : ""
    : undefined;
}
export function entryFunction(file: ts.SourceFile) {
  const entries = file.statements.filter(
    (n): n is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(n) &&
      (tag(n, "typeaudioComposition") !== undefined ||
        n.name?.text === "sound"),
  );
  if (
    entries.length !== 1 ||
    !entries[0]!.body ||
    !entries[0]!.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  )
    compositionFailure(
      file,
      0,
      "Provide one exported sound function marked @typeaudioComposition.",
    );
  return entries[0]!;
}
export function safeName(id: string, fallback: string, used: Set<string>) {
  let name = id.replace(/[^A-Za-z0-9_]/g, "_");
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true);
  function identifier(value: string) {
    scanner.setText(value);
    return (
      scanner.scan() === ts.SyntaxKind.Identifier &&
      scanner.scan() === ts.SyntaxKind.EndOfFileToken &&
      value !== "arguments" &&
      value !== "eval"
    );
  }
  if (!identifier(name)) {
    name = fallback.replace(/[^A-Za-z0-9_]/g, "_");
    if (!identifier(name)) name = `_${name}`;
  }
  const base = name;
  let count = 1;
  while (used.has(name)) name = `${base}_${count++}`;
  used.add(name);
  return name;
}
export function locations(file: ts.SourceFile) {
  const result: Record<string, { file: string; line: number; column: number }> =
    {};
  for (const statement of entryFunction(file).body!.statements)
    if (ts.isVariableStatement(statement)) {
      const declaration = statement.declarationList.declarations[0];
      if (!declaration || !ts.isIdentifier(declaration.name)) continue;
      const id = tag(statement, "typeaudioNode") ?? declaration.name.text;
      const p = file.getLineAndCharacterOfPosition(declaration.getStart(file));
      result[id] = {
        file: file.fileName,
        line: p.line + 1,
        column: p.character + 1,
      };
    }
  return result;
}
