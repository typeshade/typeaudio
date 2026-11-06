import type { SoundGraph } from "../types.ts";
import { orderedNodes } from "../orderGraph.ts";
import { checkCode } from "./validateCode.ts";
export function emitGraphSource(graph: SoundGraph) {
  const nodes = orderedNodes(graph),
    index = new Map(nodes.map((n, i) => [n.id, i]));
  const lines = [
    '"use typeshade";',
    "export function graphBlock(__out: array<f32>, __state: array<f32>, __clock: array<u32>, __p: array<f32>, __frames: u32): void {",
    "const sampleRate: f32 = 48000; const p0: f32 = __p[0]; const p1: f32 = __p[1]; const p2: f32 = __p[2]; const p3: f32 = __p[3];",
    "let __age: u32 = __clock[0]; for (let __i: u32 = 0; __i < __frames; __i++) { const time: f32 = f32(__age) / sampleRate;",
  ];
  const codeRanges: { start: number; end: number; name: string }[] = [];
  for (const [i, n] of nodes.entries()) {
    const state = i * 4,
      v = `__v${i}`,
      param = (k = 0) => `__p[${4 + i * 2 + k}]`,
      input = (port: string, fallback = "0") =>
        n.inputs[port] ? `__v${index.get(n.inputs[port]!)}` : fallback;
    lines.push(`let ${v}: f32 = 0;`);
    if (n.bypass) {
      lines.push(`${v} = ${input("input", input("a"))};`);
      continue;
    }
    switch (n.kind) {
      case "parameter":
        lines.push(`${v} = __p[u32(${param()})];`);
        break;
      case "oscillator":
        lines.push(
          `__state[${state}] = fract(__state[${state}] + clamp(${input("frequency", param())}, 0, 20000) / sampleRate);`,
          `${v} = sin(__state[${state}] * 6.28318530718);`,
          `if (${param(1)} == 1) { ${v} = __state[${state}] * 2 - 1; } else if (${param(1)} == 2) { ${v} = select(-1, 1, __state[${state}] < 0.5); } else if (${param(1)} == 3) { ${v} = 1 - 4 * abs(__state[${state}] - 0.5); }`,
        );
        break;
      case "noise":
        lines.push(
          `{ let __r${i}: u32 = __clock[${i + 1}]; if (__r${i} == 0) { __r${i} = u32(${param()}); } __r${i} = __r${i} ^ (__r${i} << 13); __r${i} = __r${i} ^ (__r${i} >> 17); __r${i} = __r${i} ^ (__r${i} << 5); __clock[${i + 1}] = __r${i}; ${v} = f32(__r${i}) / 2147483648 - 1; }`,
        );
        break;
      case "gain":
        lines.push(
          `${v} = ${input("input")} * clamp(${input("amount", param())}, 0, 2);`,
        );
        break;
      case "lowpass":
        lines.push(
          `__state[${state}] = __state[${state}] + (1 - exp(-6.28318530718 * clamp(${input("cutoff", param())}, 20, 16000) / sampleRate)) * (${input("input")} - __state[${state}]); ${v} = __state[${state}];`,
        );
        break;
      case "envelope":
        lines.push(
          `${v} = ${input("input")} * min(1, time / ${param()}) * exp(-max(0, time - ${param()}) / ${param(1)});`,
        );
        break;
      case "mix":
        lines.push(
          `${v} = ${input("a")} * (1 - ${param()}) + ${input("b")} * ${param()};`,
        );
        break;
      case "output":
        lines.push(`${v} = ${input("input")};`);
        break;
      case "code": {
        checkCode(n.code, n.name);
        lines.push(
          `{ const input: f32 = ${input("input")}; let out: f32 = 0; let state0: f32 = __state[${state}]; let state1: f32 = __state[${state + 1}]; let state2: f32 = __state[${state + 2}]; let state3: f32 = __state[${state + 3}];`,
        );
        const start = lines.length;
        lines.push(...n.code.split("\n"));
        codeRanges.push({ start, end: lines.length, name: n.name });
        lines.push(
          `${v} = out; __state[${state}] = state0; __state[${state + 1}] = state1; __state[${state + 2}] = state2; __state[${state + 3}] = state3; }`,
        );
        break;
      }
    }
  }
  lines.push(
    `__out[__i] = __v${index.get(nodes.find((n) => n.kind === "output")!.id)}; __age++; } __clock[0] = __age; }`,
  );

  return { source: lines.join("\n"), codeRanges, nodes: nodes.length };
}
