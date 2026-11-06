import ts from "typescript";
import { FUNCTIONS } from "./scalarFunctions.ts";
export function checkCode(code: string, name: string) {
  const source = ts.createSourceFile(
    "node.ts",
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let count = 0;
  const fail = (node: ts.Node, message: string): never => {
    const line =
      source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    throw new Error(`${name}, line ${line}: ${message}`);
  };
  function inspect(node: ts.Node) {
    if (++count > 350)
      fail(node, "Keep a Code node below 350 syntax elements.");
    if (
      ts.isStatement(node) &&
      !ts.isVariableStatement(node) &&
      !ts.isExpressionStatement(node) &&
      !ts.isIfStatement(node) &&
      !ts.isBlock(node) &&
      !ts.isEmptyStatement(node)
    )
      fail(
        node,
        "Use scalar variables, assignments and if statements. Loops, functions and imports are unavailable.",
      );
    if (
      ts.isCallExpression(node) &&
      (!ts.isIdentifier(node.expression) ||
        !FUNCTIONS.has(node.expression.text))
    )
      fail(node, "Use the documented scalar math functions.");
    if (
      ts.isNewExpression(node) ||
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node) ||
      ts.isArrayLiteralExpression(node) ||
      ts.isObjectLiteralExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node) ||
      ts.isStringLiteral(node) ||
      ts.isTemplateExpression(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isAwaitExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isAsExpression(node)
    )
      fail(
        node,
        "Only scalar TypeShade expressions are supported in a Code node.",
      );
    if (ts.isIdentifier(node) && /^__/.test(node.text))
      fail(node, "Names beginning with __ belong to the graph runtime.");
    if (
      ts.isVariableDeclaration(node) &&
      (!ts.isIdentifier(node.name) ||
        [
          "out",
          "input",
          "time",
          "sampleRate",
          "p0",
          "p1",
          "p2",
          "p3",
          "state0",
          "state1",
          "state2",
          "state3",
        ].includes(node.name.text))
    )
      fail(
        node,
        "Use a new local variable name; the node inputs and state already exist.",
      );
    ts.forEachChild(node, inspect);
  }
  inspect(source);
}
