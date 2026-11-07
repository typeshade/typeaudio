import type { FunctionLocation } from "../program.ts";
export interface FunctionDiagnostic extends FunctionLocation {
  message: string;
  definition: string;
}
export class FunctionCompileError extends Error {
  constructor(readonly diagnostics: FunctionDiagnostic[]) {
    super(
      diagnostics
        .map(
          (d) =>
            `${d.definition}: ${d.file}:${d.line}:${d.column}: ${d.message}`,
        )
        .join("\n"),
    );
    this.name = "FunctionCompileError";
  }
}
