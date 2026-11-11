import ts from 'typescript';
import { calledFunction } from './compiledFunctions.ts';

/** Refuse allocations and unverified runtime helpers in the reachable audio path. */
export function auditCpuFunction(name: string, text: string) {
  const parsed = ts.createSourceFile(
    'processing.js',
    `const f={${text}};`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const f = (
    (parsed.statements[0] as ts.VariableStatement).declarationList.declarations[0]!
      .initializer as ts.ObjectLiteralExpression
  ).properties[0] as ts.PropertyAssignment;
  const scan = (n: ts.Node) => {
    if (ts.isForOfStatement(n) || ts.isForInStatement(n))
      throw new Error(`${name}: unrecognized loop lowering; review the bounded-execution adapter.`);
    if (
      ts.isNewExpression(n) ||
      ts.isArrayLiteralExpression(n) ||
      ts.isObjectLiteralExpression(n) ||
      ts.isArrowFunction(n) ||
      ts.isFunctionExpression(n)
    )
      throw new Error(
        `${name}: processing allocates an aggregate; prepare it as instance state instead.`,
      );
    if (ts.isCallExpression(n)) {
      const callee = n.expression.getText(parsed);
      if (
        !calledFunction(n) &&
        !/^\$(?:fr|h\d+)$/.test(callee) &&
        ![
          '__audioStep',
          '$.u32Sat',
          '$.i32Sat',
          '$.intDiv',
          '$.intRem',
          // The 32-bit integer product that u32 and i32 multiplication lowers to: a pure,
          // deterministic builtin that allocates nothing (the kinds' hash noise needs it).
          'Math.imul',
        ].includes(callee)
      )
        throw new Error(`${name}: unverified CPU helper ${callee}.`);
    }
    ts.forEachChild(n, scan);
  };
  scan((f.initializer as ts.FunctionExpression).body);
}
