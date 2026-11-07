import { compile } from "typeshade";
import { FUNCTION_COMPOSITION_PATH } from "../../composition.ts";
import { FunctionCompileError } from "../diagnostics.ts";

export function checkCompositionLanguage(
  modules: Record<string, string>,
  source: string,
) {
  if (Object.hasOwn(modules, FUNCTION_COMPOSITION_PATH))
    throw new Error(
      `${FUNCTION_COMPOSITION_PATH} is reserved for composition authoring.`,
    );
  const result = compile(source, {
    fileName: FUNCTION_COMPOSITION_PATH,
    readDocument: (path) =>
      Object.hasOwn(modules, path) ? modules[path] : undefined,
  });
  const errors = result.diagnostics.filter((d) => d.category === "error");
  if (errors.length)
    throw new FunctionCompileError(
      errors.map((d) => ({
        definition: "composition",
        file: d.fileName,
        line: d.line ?? 1,
        column: d.character ?? 1,
        message: d.message,
      })),
    );
  return result.module;
}
