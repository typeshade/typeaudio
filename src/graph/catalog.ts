import type { NodeKind } from "./types.ts";
import type { NodeDefinition } from "./types.ts";
const control = (
  name: string,
  min: number,
  max: number,
  value: number,
  step = 0.01,
) => ({ name, min, max, value, step });

export const DEFINITIONS: Record<NodeKind, NodeDefinition> = {
  parameter: {
    label: "Parameter",
    output: "control",
    inputs: {},
    controls: [control("Parameter index", 0, 3, 0, 1)],
    hint: "Expose one of p0–p3 as a control signal. Edit its name and range in Parameters.",
  },
  oscillator: {
    label: "Oscillator",
    output: "audio",
    inputs: { frequency: "control" },
    controls: [
      control("Frequency (Hz)", 20, 16000, 220, 1),
      control("Shape: sine / saw / square / triangle", 0, 3, 0, 1),
    ],
    hint: "A continuous oscillator. A frequency connection overrides its frequency field. Sharp shapes are not band-limited.",
  },
  noise: {
    label: "Noise",
    output: "audio",
    inputs: {},
    controls: [control("Seed", 1, 65535, 2026, 1)],
    hint: "Repeatable white noise. Retrigger restores the seed.",
  },
  code: {
    label: "Code",
    output: "audio",
    inputs: { input: "audio" },
    controls: [],
    hint: "Write scalar TypeShade statements. Read input, time, sampleRate and p0–p3; write out. state0–state3 persist between samples. Loops, imports and helper functions are unavailable here.",
  },
  gain: {
    label: "Gain",
    output: "audio",
    inputs: { input: "audio", amount: "control" },
    controls: [control("Amount", 0, 2, 0.5)],
    hint: "Scale an audio signal. A control connection overrides Amount.",
  },
  lowpass: {
    label: "Lowpass",
    output: "audio",
    inputs: { input: "audio", cutoff: "control" },
    controls: [control("Cutoff (Hz)", 20, 16000, 2400, 1)],
    hint: "A stateful one-pole lowpass. Parameter edits preserve its previous sample.",
  },
  envelope: {
    label: "Envelope",
    output: "audio",
    inputs: { input: "audio" },
    controls: [
      control("Attack (s)", 0.001, 1, 0.005, 0.001),
      control("Decay (s)", 0.01, 4, 0.3, 0.01),
    ],
    hint: "A linear attack followed by exponential decay, restarted by Retrigger.",
  },
  mix: {
    label: "Mix",
    output: "audio",
    inputs: { a: "audio", b: "audio" },
    controls: [control("Balance", 0, 1, 0.5)],
    hint: "Blend two audio signals. An unconnected input is silent.",
  },
  output: {
    label: "Output",
    output: "audio",
    inputs: { input: "audio" },
    controls: [],
    hint: "The graph output. The sound's output level and duration apply after the graph.",
  },
};
