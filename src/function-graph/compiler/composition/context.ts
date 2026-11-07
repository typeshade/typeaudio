import ts from "typescript";
import type { FunctionGraphProgram } from "../../program.ts";
import { functionLanguage } from "../functionLanguage.ts";
import { stateReference } from "./stateReference.ts";
import { compositionStructure, importName } from "./structure.ts";
import { safeName, tag } from "./source.ts";

export function compositionContext(
  program: FunctionGraphProgram,
  previous?: ReturnType<typeof compositionStructure>,
) {
  const g = program.document,
    used = new Set(["sound", "f32", "i32", "u32", "bool", "inout"]);
  if (previous)
    for (const statement of previous.file.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name)
        used.add(statement.name.text);
      if (ts.isClassDeclaration(statement) && statement.name)
        used.add(statement.name.text);
    }
  const functions = new Map<string, string>(),
    states = new Map<string, { module: string; name: string; alias: string }>();
  let language: ReturnType<typeof functionLanguage> | undefined;
  for (const d of g.definitions) {
    const old = previous?.imports.get(d.id),
      name = old
        ? importName(old).name.text
        : safeName(d.export, `fn_${d.id}`, used);
    used.add(name);
    functions.set(d.id, name);
    if (d.state) {
      language ??= functionLanguage(g.modules);
      const reference = stateReference(d, g.modules, language),
        old = previous?.states.get(d.id);
      const alias = old
        ? importName(old).name.text
        : safeName(reference.name, `State_${d.id}`, used);
      used.add(alias);
      states.set(d.id, { ...reference, alias });
    }
  }
  const oldParameters = new Map<string, ts.ParameterDeclaration>();
  for (const p of previous?.entry.parameters ?? [])
    for (const kind of ["State", "Control", "Context"]) {
      const id = tag(p, `typeaudio${kind}`);
      if (id !== undefined) oldParameters.set(`${kind}:${id}`, p);
    }
  const parameters = new Map<string, { name: string; text: string }>();
  function parameter(kind: string, id: string, name: string, type: string) {
    const key = `${kind}:${id}`,
      old = oldParameters.get(key);
    const chosen =
      old && ts.isIdentifier(old.name)
        ? old.name.text
        : safeName(name, `value_${parameters.size}`, used);
    used.add(chosen);
    let text = `\n  /** @typeaudio${kind} ${id} */ ${chosen}: ${type}`;
    if (old?.type) {
      text = old.getFullText(previous!.file);
      const start = old.type.getStart(previous!.file) - old.pos,
        end = old.type.end - old.pos;
      text = text.slice(0, start) + type + text.slice(end);
    }
    parameters.set(key, { name: chosen, text });
  }
  const descriptors = new Map(
    program.artifacts.map((a) => [a.descriptor.id, a.descriptor]),
  );
  for (const n of g.nodes)
    if (descriptors.get(n.definition)!.state)
      parameter(
        "State",
        n.id,
        `${n.id}State`,
        `inout<${states.get(n.definition)!.alias}>`,
      );
  for (const c of g.parameters) parameter("Control", c.id, c.id, c.type);
  const contexts = new Set(
    program.artifacts.flatMap((a) => a.descriptor.context.map((c) => c.value)),
  );
  for (const c of contexts) parameter("Context", c, c, "f32");
  const variables = new Map<string, string>();
  for (const n of g.nodes) {
    const old = previous?.nodes.get(n.id)?.declarationList.declarations[0]
      ?.name;
    const name =
      old && ts.isIdentifier(old)
        ? old.text
        : safeName(n.id, `node_${variables.size}`, used);
    used.add(name);
    variables.set(n.id, name);
  }
  return {
    functions,
    states,
    parameters,
    variables,
    descriptors,
    oldParameters,
  };
}
