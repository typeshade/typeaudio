import ts from "typescript";

/** Adapt the pinned inout ABI and bound generated calls/loops before audio execution. */
export function adaptCpuFunctions(source: ts.SourceFile) {
  let reusedInoutArrays = 0;
  const step = ts.factory.createExpressionStatement(
    ts.factory.createCallExpression(
      ts.factory.createIdentifier("__audioStep"),
      undefined,
      [],
    ),
  );
  const transform = ts.transform(source, [
    (context) => (root) => {
      const visit: ts.Visitor = (node) => {
        // The pinned ABI writes only argument identifiers here. Reuse one scratch
        // table without changing evaluation order or caller writeback semantics.
        if (
          ts.isBinaryExpression(node) &&
          node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          node.left.getText(source) === "$.inout.values" &&
          ts.isArrayLiteralExpression(node.right)
        ) {
          if (!node.right.elements.every(ts.isIdentifier))
            throw new Error(
              "Unrecognized inout writeback; review the compiler adapter.",
            );
          reusedInoutArrays++;
          const writes: ts.Expression[] = node.right.elements.map((v, i) =>
            ts.factory.createBinaryExpression(
              ts.factory.createElementAccessExpression(node.left, i),
              ts.SyntaxKind.EqualsToken,
              v,
            ),
          );
          writes.push(node.left);
          return ts.factory.createParenthesizedExpression(
            writes.reduce((a, b) =>
              ts.factory.createBinaryExpression(a, ts.SyntaxKind.CommaToken, b),
            ),
          );
        }
        const n = ts.visitEachChild(node, visit, context);
        const block = (body: ts.Statement) =>
          ts.factory.createBlock(
            [step, ...(ts.isBlock(body) ? body.statements : [body])],
            true,
          );
        if (ts.isFunctionExpression(n))
          return ts.factory.updateFunctionExpression(
            n,
            n.modifiers,
            n.asteriskToken,
            n.name,
            n.typeParameters,
            n.parameters,
            n.type,
            block(n.body),
          );
        if (ts.isForStatement(n))
          return ts.factory.updateForStatement(
            n,
            n.initializer,
            n.condition,
            n.incrementor,
            block(n.statement),
          );
        if (ts.isWhileStatement(n))
          return ts.factory.updateWhileStatement(
            n,
            n.expression,
            block(n.statement),
          );
        if (ts.isDoStatement(n))
          return ts.factory.updateDoStatement(
            n,
            block(n.statement),
            n.expression,
          );
        return n;
      };
      return ts.visitNode(root, visit) as ts.SourceFile;
    },
  ]);
  const transformed = transform.transformed[0]!;
  const text = ts.createPrinter().printFile(transformed);
  transform.dispose();
  return {
    source: ts.createSourceFile(
      "adapted.js",
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    ),
    reusedInoutArrays,
  };
}
