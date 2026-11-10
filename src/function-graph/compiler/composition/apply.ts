import ts from "typescript";
import type {
  FunctionGraphProgram,
  FunctionDescriptor,
} from "../../program.ts";
import type {
  FunctionInstance,
  InputBinding,
  ScalarValue,
} from "../../types.ts";
import type { FunctionComposition } from "../../composition.ts";
import { validateFunctionDocument } from "../../validateDocument.ts";
import { validateFunctionConnections } from "../../validateConnections.ts";
import { compositionStructure, importName, importPath } from "./structure.ts";
import { compositionFailure, locations, tag } from "./source.ts";
import { checkCompositionLanguage } from "./checkLanguage.ts";

/** Map supported, type-checked calls. Never execute project source as host JavaScript. */
export function applyFunctionComposition(
  program: FunctionGraphProgram,
  source: string,
): { program: FunctionGraphProgram; composition: FunctionComposition } {
  const s = compositionStructure(source),
    { document } = program;
  const compiled = checkCompositionLanguage(document.modules, source);
  const entry = compiled.funcs.find(
    (f) => f.name === s.entry.name!.text && f.span?.file === s.file.fileName,
  );
  const fail = (node: ts.Node, message: string): never =>
    compositionFailure(s.file, node, message);
  if (!entry || entry.kernel || entry.stage)
    fail(s.entry, "Use an ordinary composition function.");
  const definitions = new Map(
    program.artifacts.map((a) => [a.descriptor.id, a.descriptor]),
  );
  const calls = new Map<string, FunctionDescriptor>();
  for (const [id, statement] of s.imports) {
    const specifier = importName(statement),
      d = document.definitions.find((d) => d.id === id);
    if (
      !d ||
      (specifier.propertyName ?? specifier.name).text !== d.export ||
      importPath(statement) !== d.module
    )
      fail(
        statement,
        `Definition ${id} must import its declared module and export.`,
      );
    if (calls.has(specifier.name.text))
      fail(statement, "Each definition needs a unique local alias.");
    calls.set(specifier.name.text, definitions.get(id)!);
  }
  const parameters = new Map<string, ts.ParameterDeclaration>(),
    controls = new Map<string, string>(),
    contexts = new Map<string, string>();
  for (const [index, p] of s.entry.parameters.entries()) {
    if (
      !ts.isIdentifier(p.name) ||
      p.initializer ||
      p.dotDotDotToken ||
      p.questionToken
    )
      fail(
        p,
        "Declare explicit named composition parameters without defaults or rest arguments.",
      );
    const name = (p.name as ts.Identifier).text;
    if (parameters.has(name)) fail(p, "Duplicate composition parameter.");
    parameters.set(name, p);
    const control = tag(p, "typeaudioControl"),
      context = tag(p, "typeaudioContext");
    if (control !== undefined) {
      const c = document.parameters.find((c) => c.id === control),
        actual = entry!.params[index];
      if (
        !c ||
        actual?.type.kind !== "scalar" ||
        actual.type.scalar !== c.type ||
        actual.mode
      )
        fail(
          p,
          `Control ${control} must retain its declared scalar type. Add controls in Properties first.`,
        );
      if ([...controls.values()].includes(control))
        fail(p, "Declare each named control once.");
      controls.set(name, control);
    } else if (context !== undefined) {
      const actual = entry!.params[index];
      if (
        !["time", "sampleRate"].includes(context) ||
        actual?.type.kind !== "scalar" ||
        actual.type.scalar !== "f32" ||
        actual.mode
      )
        fail(p, "Time and sampleRate context require f32 parameters.");
      if ([...contexts.values()].includes(context))
        fail(p, "Declare each context once.");
      contexts.set(name, context);
    }
  }
  const variables = new Map<
    string,
    { id: string; descriptor: FunctionDescriptor }
  >();
  for (const [id, statement] of s.nodes) {
    const d = statement.declarationList.declarations[0]!,
      call = d.initializer as ts.CallExpression;
    const definition = ts.isIdentifier(call.expression)
      ? calls.get(call.expression.text)
      : undefined;
    if (!definition || call.typeArguments?.length)
      fail(
        call,
        "Call a catalog definition through its named import. Add helper arithmetic inside a function module.",
      );
    if (variables.has((d.name as ts.Identifier).text))
      fail(d, "Duplicate node variable.");
    variables.set((d.name as ts.Identifier).text, {
      id,
      descriptor: definition!,
    });
  }
  function binding(expression: ts.Expression): InputBinding {
    if (ts.isIdentifier(expression)) {
      const control = controls.get(expression.text),
        node = variables.get(expression.text);
      if (control) return { kind: "parameter", parameter: control };
      if (node)
        return {
          kind: "connection",
          node: node.id,
          port: node.descriptor.output.id,
        };
    }
    let value: ScalarValue | undefined;
    if (ts.isNumericLiteral(expression)) value = Number(expression.text);
    else if (
      expression.kind === ts.SyntaxKind.TrueKeyword ||
      expression.kind === ts.SyntaxKind.FalseKeyword
    )
      value = expression.kind === ts.SyntaxKind.TrueKeyword;
    else if (
      ts.isPrefixUnaryExpression(expression) &&
      ts.isNumericLiteral(expression.operand) &&
      [ts.SyntaxKind.MinusToken, ts.SyntaxKind.PlusToken].includes(
        expression.operator,
      )
    )
      value =
        Number(expression.operand.text) *
        (expression.operator === ts.SyntaxKind.MinusToken ? -1 : 1);
    if (value !== undefined) return { kind: "constant", value };
    return fail(
      expression,
      "Use a scalar literal, named control or node variable here. Put processing expressions inside a function module.",
    );
  }
  const stateOwners = new Map<string, string>(),
    nodes: FunctionInstance[] = [];
  for (const [id, statement] of s.nodes) {
    const declaration = statement.declarationList.declarations[0]!,
      call = declaration.initializer as ts.CallExpression;
    const d = variables.get(
      (declaration.name as ts.Identifier).text,
    )!.descriptor;
    if (call.arguments.length !== d.argumentCount)
      fail(
        call,
        `${d.export} requires ${d.argumentCount} arguments, including its declared state and context.`,
      );
    const inputs: Record<string, InputBinding> = {};
    for (const pin of d.inputs)
      inputs[pin.id] = binding(call.arguments[pin.argument]!);
    for (const context of d.context) {
      const arg = call.arguments[context.argument]!;
      if (!ts.isIdentifier(arg) || contexts.get(arg.text) !== context.value)
        fail(arg, `Bind the declared ${context.value} context parameter.`);
    }
    if (d.state) {
      const arg = call.arguments[d.state.argument]!;
      if (
        !ts.isIdentifier(arg) ||
        !parameters.has(arg.text) ||
        controls.has(arg.text) ||
        contexts.has(arg.text)
      )
        fail(arg, "Pass a dedicated inout state parameter for this instance.");
      const name = (arg as ts.Identifier).text,
        parameter = parameters.get(name)!;
      const compiledParameter =
        entry!.params[s.entry.parameters.indexOf(parameter)]!;
      const declaredId = tag(parameter, "typeaudioState");
      if (
        compiledParameter.mode !== "inout" ||
        compiledParameter.type.kind !== "struct"
      )
        fail(parameter, "Instance state must use inout<State>.");
      if (
        stateOwners.has(name) ||
        (declaredId !== undefined && declaredId !== id)
      )
        fail(
          arg,
          "Each instance needs its own state parameter and matching identity. Sharing state across nodes is not supported.",
        );
      stateOwners.set(name, id);
    }
    nodes.push({ id, definition: d.id, inputs });
  }
  for (const [name, parameter] of parameters)
    if (!controls.has(name) && !contexts.has(name) && !stateOwners.has(name))
      fail(
        parameter,
        "This parameter is not bound to a named control, context or instance state.",
      );
  const output = variables.get((s.output.expression as ts.Identifier).text);
  if (!output) fail(s.output, "Return an existing audio node variable.");
  const next = validateFunctionDocument({
    ...document,
    nodes,
    output: { node: output!.id, port: output!.descriptor.output.id },
  });
  let order: string[];
  try {
    order = validateFunctionConnections(next, [...definitions.values()]);
  } catch (error) {
    return fail(
      s.entry,
      error instanceof Error ? error.message : String(error),
    );
  }
  return {
    program: { ...program, document: next, order },
    composition: { source, nodes: locations(s.file) },
  };
}
