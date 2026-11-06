export type NodeKind =
  | "parameter"
  | "oscillator"
  | "noise"
  | "code"
  | "gain"
  | "lowpass"
  | "envelope"
  | "mix"
  | "output";

export type Signal = "audio" | "control";

export interface GraphParameter {
  name: string;
  min: number;
  max: number;
  value: number;
}

export interface GraphNode {
  id: string;
  kind: NodeKind;
  name: string;
  x: number;
  y: number;
  values: number[];
  inputs: Record<string, string>;
  code: string;
  bypass: boolean;
}

export interface SoundGraph {
  version: 1;
  nodes: GraphNode[];
  parameters: GraphParameter[];
}

export interface NodeDefinition {
  label: string;
  output: Signal;
  inputs: Record<string, Signal>;
  controls: {
    name: string;
    min: number;
    max: number;
    value: number;
    step: number;
  }[];
  hint: string;
}
