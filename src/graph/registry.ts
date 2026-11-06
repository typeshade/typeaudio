import { createCodegenRuntime } from "typeshade/runtime/internal";
export type GraphKernel = (
  out: Float32Array,
  state: Float32Array,
  clock: Uint32Array,
  params: Float32Array,
  frames: number,
) => void;
const programs = new Map<string, GraphKernel>();
const scope = globalThis as unknown as {
  __typeaudioGraphRuntime: typeof createCodegenRuntime;
  __typeaudioRegisterGraph: (key: string, kernel: GraphKernel) => void;
};
scope.__typeaudioGraphRuntime = createCodegenRuntime;
scope.__typeaudioRegisterGraph = (key, kernel) => {
  if (programs.size >= 32) programs.delete(programs.keys().next().value!);
  programs.set(key, kernel);
};
export function graphKernel(key: string): GraphKernel {
  const kernel = programs.get(key);
  if (!kernel)
    throw new Error(
      "The graph has not compiled. Apply the graph before playback.",
    );
  return kernel;
}
