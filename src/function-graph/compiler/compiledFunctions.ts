import ts from "typescript";

/** Read the pinned generator's function table; this does not parse the user's language. */
export function compiledFunctions(functions: readonly string[]) {
  const source = ts.createSourceFile(
    "functions.js",
    `const functions = {${functions.join(",")}};`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const table = (source.statements[0] as ts.VariableStatement).declarationList
    .declarations[0]!.initializer as ts.ObjectLiteralExpression;
  const result = new Map<string, ts.FunctionExpression>();
  for (const property of table.properties) {
    if (
      !ts.isPropertyAssignment(property) ||
      !ts.isStringLiteral(property.name) ||
      !ts.isFunctionExpression(property.initializer)
    )
      throw new Error("Unrecognized TypeShade function table.");
    result.set(property.name.text, property.initializer);
  }
  return { source, functions: result };
}

export function calledFunction(node: ts.CallExpression): string | undefined {
  const e = node.expression;
  return ts.isElementAccessExpression(e) &&
    ts.isPropertyAccessExpression(e.expression) &&
    ts.isIdentifier(e.expression.expression) &&
    e.expression.expression.text === "$" &&
    e.expression.name.text === "F" &&
    ts.isStringLiteral(e.argumentExpression)
    ? e.argumentExpression.text
    : undefined;
}
