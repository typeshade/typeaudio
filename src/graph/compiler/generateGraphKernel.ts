import ts from "typescript";
// Pinned TypeShade backend; compiler upgrades must review this adapter.
import { generateModuleJs } from "../../../node_modules/typeshade/src/core/cpu-codegen.ts";
import { HELPERS } from "./scalarFunctions.ts";
export function generateGraphKernel(
  module: Parameters<typeof generateModuleJs>[0],
  key: string,
) {
  const generated = generateModuleJs(module, { precision: "f32" });
  if (generated.fallbacks.length || generated.fns.length !== 1)
    throw new Error("This graph cannot run as a compiled audio kernel.");
  for (const declaration of generated.decls) {
    const name = /\$\.(?:L|B)\["([^"]+)"\]/.exec(declaration)?.[1];
    if (name && name !== "arrayLength" && !HELPERS.has(name))
      throw new Error(`Unsupported audio helper: ${name}.`);
  }
  const parsed = ts.createSourceFile(
    "graph.js",
    `const functions = {${generated.fns.join(",")}};`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const transformed = ts.transform(parsed, [
    (context) => (root) => {
      const visit: ts.Visitor = (node) => {
        if (
          ts.isExpressionStatement(node) &&
          ts.isBinaryExpression(node.expression) &&
          node.expression.left.getText(parsed) === "$.inout.values"
        )
          return ts.factory.createEmptyStatement();
        return ts.visitEachChild(node, visit, context);
      };
      return ts.visitNode(root, visit) as ts.SourceFile;
    },
  ]);
  const body = ts.createPrinter().printFile(transformed.transformed[0]!);
  transformed.dispose();
  const ast = ts.createSourceFile(
    "graph.js",
    body,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const inspect = (node: ts.Node) => {
    if (
      ts.isNewExpression(node) ||
      ts.isArrayLiteralExpression(node) ||
      (ts.isObjectLiteralExpression(node) &&
        node !==
          (ast.statements[0] as ts.VariableStatement).declarationList
            .declarations[0]!.initializer) ||
      (ts.isCallExpression(node) &&
        node.expression.getText(ast).startsWith("$.F"))
    )
      throw new Error(
        "The audio kernel must use preallocated scalar state without nested calls.",
      );
    ts.forEachChild(node, inspect);
  };
  inspect(ast);

  return `const $ = globalThis.__typeaudioGraphRuntime();\n${generated.decls.join("\n")}\n${body}\n$.F = functions; globalThis.__typeaudioRegisterGraph(${JSON.stringify(key)}, functions.graphBlock);`;
}
