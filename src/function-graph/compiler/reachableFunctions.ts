import ts from "typescript";
import { calledFunction } from "./compiledFunctions.ts";

export function reachableFunctions(
  functions: Map<string, ts.FunctionExpression>,
  entry: string,
) {
  const done = new Set<string>(),
    visiting = new Set<string>();
  function visit(name: string) {
    if (visiting.has(name))
      throw new Error(`Recursive processing call: ${name}.`);
    if (done.has(name)) return;
    if (visiting.size >= 32 || done.size >= 64)
      throw new Error(
        "Function call graph exceeds this profile's depth or function limit.",
      );
    const f = functions.get(name);
    if (!f) throw new Error(`Missing compiled function: ${name}.`);
    visiting.add(name);
    const scan = (n: ts.Node) => {
      if (ts.isCallExpression(n)) {
        const target = calledFunction(n);
        if (target) visit(target);
      }
      ts.forEachChild(n, scan);
    };
    scan(f.body);
    visiting.delete(name);
    done.add(name);
  }
  visit(entry);
  return done;
}
