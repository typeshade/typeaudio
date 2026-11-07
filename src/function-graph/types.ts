/** Portable authoring data. Processing bodies remain ordinary TypeShade modules. */
export type ScalarType = "f32" | "i32" | "u32" | "bool";
export type ScalarValue = number | boolean;
export interface PortMetadata {
  id: string;
  role: "audio" | "control";
  rate: "sample" | "block";
  unit?: string;
  default?: ScalarValue;
}
export interface FunctionDefinition {
  id: string;
  version: number;
  module: string;
  export: string;
  /** Keys are source parameter names; port IDs survive source renames/reordering. */
  inputs: Record<string, PortMetadata>;
  output: PortMetadata;
  context?: Record<string, "time" | "sampleRate">;
  state?: { parameter: string; initializer: string; version: number };
}
export type InputBinding =
  | { kind: "constant"; value: ScalarValue }
  | { kind: "parameter"; parameter: string }
  | { kind: "connection"; node: string; port: string };
export interface FunctionInstance {
  id: string;
  definition: string;
  inputs: Record<string, InputBinding>;
}
export interface FunctionParameter {
  id: string;
  name: string;
  type: ScalarType;
  unit?: string;
  value: ScalarValue;
  min?: number;
  max?: number;
}
export interface FunctionGraphDocument {
  schema: "typeaudio.function-graph";
  version: 1;
  /** Absolute virtual paths, resolved only within this source set. */
  modules: Record<string, string>;
  definitions: FunctionDefinition[];
  nodes: FunctionInstance[];
  parameters: FunctionParameter[];
  output: { node: string; port: string };
}
