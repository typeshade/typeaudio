import type {
  FunctionGraphDocument,
  PortMetadata,
  ScalarType,
} from "./types.ts";

export interface FunctionLocation {
  file: string;
  line: number;
  column: number;
}
export interface FunctionPort extends PortMetadata {
  name: string;
  type: ScalarType;
  argument: number;
}
export interface FunctionDescriptor {
  id: string;
  version: number;
  export: string;
  location: FunctionLocation;
  inputs: FunctionPort[];
  output: PortMetadata & { type: ScalarType };
  argumentCount: number;
  context: { argument: number; value: "time" | "sampleRate" }[];
  state?: {
    argument: number;
    version: number;
    fields: { name: string; type: ScalarType }[];
  };
}
export interface FunctionArtifact {
  key: string;
  descriptor: FunctionDescriptor;
  /** Registration module; load before creating a processor. No eval in process(). */
  code: string;
  report: {
    backend: "compiled-cpu-f32";
    functions: string[];
    reusedInoutArrays: number;
    stepLimit: number;
  };
}
export interface FunctionGraphProgram {
  schema: "typeaudio.function-program";
  version: 1;
  document: FunctionGraphDocument;
  artifacts: FunctionArtifact[];
  /** Topological order, independent of the document's presentation order. */
  order: string[];
}
