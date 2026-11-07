import ts from "typescript";
import type { FunctionGraphProgram } from "../../program.ts";
import type { FunctionComposition } from "../../composition.ts";
import type { FunctionInstance, InputBinding } from "../../types.ts";
import { compositionStructure } from "./structure.ts";
import { compositionContext } from "./context.ts";
import { sourceFile, locations } from "./source.ts";
import { applyFunctionComposition } from "./apply.ts";
import { compositionIdentity } from "./identity.ts";

type Edit = { start: number; end: number; text: string };
function comments(text: string) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    text,
  );
  let result = "",
    token: ts.SyntaxKind;
  while ((token = scanner.scan()) !== ts.SyntaxKind.EndOfFileToken)
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      const comment = scanner
        .getTokenText()
        .replace(/@typeaudio\w+(?:\s+[A-Za-z_][\w-]*)?/g, "");
      if (comment.replace(/[\s/*]/g, "")) result += `\n  ${comment}`;
    }
  return result;
}

/** Change only the managed imports, signature and call body; keep other module source intact. */
export function projectFunctionComposition(
  program: FunctionGraphProgram,
  previousSource?: string,
): FunctionComposition {
  if (previousSource) {
    try {
      const parsed = applyFunctionComposition(program, previousSource);
      if (compositionIdentity(parsed.program) === compositionIdentity(program))
        return parsed.composition;
    } catch {
      /* A visual/source-signature edit can require a new projection. Preserve the parsed source below. */
    }
  }
  const previous = previousSource
    ? compositionStructure(previousSource)
    : undefined;
  const c = compositionContext(program, previous),
    g = program.document;
  const imports = new Map<string, string>(),
    stateImports = new Map<string, string>();
  for (const d of g.definitions) {
    const alias = c.functions.get(d.id)!;
    imports.set(
      d.id,
      `import { ${d.export}${alias === d.export ? "" : ` as ${alias}`} } from ${JSON.stringify("." + d.module)};`,
    );
    const state = c.states.get(d.id);
    if (state)
      stateImports.set(
        d.id,
        `import { ${state.name}${state.name === state.alias ? "" : ` as ${state.alias}`} } from ${JSON.stringify("." + state.module)};`,
      );
  }
  function binding(b: InputBinding) {
    if (b.kind === "connection") return c.variables.get(b.node)!;
    if (b.kind === "parameter")
      return c.parameters.get(`Control:${b.parameter}`)!.name;
    return Object.is(b.value, -0) ? "-0" : String(b.value);
  }
  function statement(node: FunctionInstance) {
    const d = c.descriptors.get(node.definition)!,
      args: string[] = Array(d.argumentCount);
    for (const p of d.inputs)
      args[p.argument] = binding(
        node.inputs[p.id] ?? { kind: "constant", value: p.default! },
      );
    for (const context of d.context)
      args[context.argument] = c.parameters.get(
        `Context:${context.value}`,
      )!.name;
    if (d.state)
      args[d.state.argument] = c.parameters.get(`State:${node.id}`)!.name;
    const call = `${c.functions.get(node.definition)}(${args.join(", ")})`;
    const old = previous?.nodes.get(node.id);
    if (!old)
      return `\n  /** @typeaudioNode ${node.id} */\n  const ${c.variables.get(node.id)}: ${d.output.type} = ${call};`;
    const declaration = old.declarationList.declarations[0]!,
      expression = declaration.initializer as ts.CallExpression;
    // Retain comments inside the argument list even when the signature changes.
    const argumentComments = comments(
      previous!.file.text.slice(expression.expression.end, expression.end),
    );
    let text = old.getFullText(previous!.file);
    const edits: Edit[] = [
      {
        start: expression.getStart(previous!.file) - old.pos,
        end: expression.end - old.pos,
        text: call,
      },
    ];
    if (declaration.type)
      edits.push({
        start: declaration.type.getStart(previous!.file) - old.pos,
        end: declaration.type.end - old.pos,
        text: d.output.type,
      });
    for (const edit of edits.sort((a, b) => b.start - a.start))
      text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
    return argumentComments + text;
  }
  const byId = new Map(g.nodes.map((n) => [n.id, n])),
    done = new Set<string>(),
    ordered: FunctionInstance[] = [];
  function visit(node: FunctionInstance) {
    if (done.has(node.id)) return;
    done.add(node.id);
    for (const input of Object.values(node.inputs))
      if (input.kind === "connection") visit(byId.get(input.node)!);
    ordered.push(node);
  }
  for (const n of g.nodes) visit(n);
  const orphanComments = previous
    ? [...previous.nodes]
        .filter(([id]) => !byId.has(id))
        .map(([, n]) => comments(n.getFullText(previous.file)))
        .join("")
    : "";
  const paramComments = previous
    ? [...c.oldParameters]
        .filter(([key]) => !c.parameters.has(key))
        .map(([, p]) => comments(p.getFullText(previous.file)))
        .join("")
    : "";
  const parameters =
    paramComments +
    [...c.parameters.values()].map((p) => p.text).join(",") +
    "\n";
  const outputName = c.variables.get(g.output.node)!;
  let output = `\n  return ${outputName};`,
    ending = "\n";
  if (previous) {
    const original = previous.output,
      expression = original.expression!;
    output =
      previous.file.text.slice(
        original.pos,
        expression.getStart(previous.file),
      ) +
      outputName +
      previous.file.text.slice(expression.end, original.end);
    ending = previous.file.text.slice(
      original.end,
      previous.entry.body!.end - 1,
    );
  }
  const body =
    orphanComments + ordered.map(statement).join("") + output + ending;
  let source: string;
  if (!previous)
    source =
      `"use typeshade";\n\n` +
      [...imports]
        .map(([id, text]) => `/** @typeaudioDefinition ${id} */\n${text}\n`)
        .join("") +
      [...stateImports]
        .map(([id, text]) => `/** @typeaudioStateType ${id} */\n${text}\n`)
        .join("") +
      `\n/** @typeaudioComposition */\nexport function sound(${parameters}): f32 {${body}}\n`;
  else {
    const edits: Edit[] = [],
      additional: string[] = [];
    for (const [map, old, tag] of [
      [imports, previous.imports, "typeaudioDefinition"],
      [stateImports, previous.states, "typeaudioStateType"],
    ] as const) {
      for (const [id, text] of map) {
        const statement = old.get(id);
        if (statement)
          edits.push({
            start: statement.getStart(previous.file),
            end: statement.end,
            text,
          });
        else additional.push(`/** @${tag} ${id} */\n${text}\n`);
      }
      for (const [id, statement] of old)
        if (!map.has(id))
          edits.push({
            start: statement.pos,
            end: statement.end,
            text: comments(statement.getFullText(previous.file)),
          });
    }
    const entry = previous.entry;
    edits.push(
      {
        start: entry.parameters.pos,
        end: entry.parameters.end,
        text: parameters,
      },
      {
        start: entry.body!.getStart(previous.file) + 1,
        end: entry.body!.end - 1,
        text: body,
      },
    );
    if (additional.length)
      edits.push({
        start: entry.pos,
        end: entry.pos,
        text: `\n${additional.join("")}`,
      });
    source = previous.file.text;
    for (const edit of edits.sort((a, b) => b.start - a.start))
      source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  }
  const result = applyFunctionComposition(program, source);
  if (compositionIdentity(result.program) !== compositionIdentity(program))
    throw new Error(
      "Composition projection changed the audio graph. Keep the last applied source.",
    );
  return { source, nodes: locations(sourceFile(source)) };
}
