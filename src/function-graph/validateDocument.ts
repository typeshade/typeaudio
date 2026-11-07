import type {
  FunctionGraphDocument,
  PortMetadata,
  ScalarType,
} from "./types.ts";
import { scalarValue } from "./scalarValue.ts";

const identifier = (s: unknown): s is string =>
  typeof s === "string" &&
  /^[A-Za-z_][\w-]{0,63}$/.test(s) &&
  !["__proto__", "prototype", "constructor"].includes(s);
const symbol = (s: unknown): s is string => identifier(s) && !s.includes("-");
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
function requireValue(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
function port(p: PortMetadata) {
  requireValue(
    record(p) &&
      identifier(p.id) &&
      ["audio", "control"].includes(p.role) &&
      ["sample", "block"].includes(p.rate),
    "Invalid function port metadata.",
  );
  requireValue(
    p.unit === undefined || (typeof p.unit === "string" && p.unit.length <= 40),
    "Invalid port unit.",
  );
  requireValue(
    p.role !== "audio" || p.rate === "sample",
    "Audio ports must use sample rate.",
  );
}

/** Snapshot untrusted JSON before compilation. Compilation does not mutate its caller. */
export function validateFunctionDocument(raw: unknown): FunctionGraphDocument {
  requireValue(record(raw), "Invalid function graph document.");
  const text = JSON.stringify(raw);
  requireValue(
    text.length <= 1_000_000,
    "Function graph exceeds the 1 MB source limit.",
  );
  const g = JSON.parse(text) as FunctionGraphDocument;
  requireValue(
    g.schema === "typeaudio.function-graph" && g.version === 1,
    "Unsupported function graph version.",
  );
  requireValue(
    record(g.modules) &&
      Object.keys(g.modules).length > 0 &&
      Object.keys(g.modules).length <= 32,
    "Provide 1–32 TypeShade modules.",
  );
  for (const [path, source] of Object.entries(g.modules))
    requireValue(
      /^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.ts$/.test(path) &&
        typeof source === "string" &&
        source.length <= 131072,
      "Use absolute virtual TypeShade paths and bounded source files.",
    );
  requireValue(
    Array.isArray(g.definitions) &&
      g.definitions.length > 0 &&
      g.definitions.length <= 32,
    "Provide 1–32 function definitions.",
  );
  const definitions = new Set<string>();
  for (const d of g.definitions) {
    requireValue(
      record(d) &&
        identifier(d.id) &&
        !definitions.has(d.id) &&
        Number.isSafeInteger(d.version) &&
        d.version > 0 &&
        symbol(d.export) &&
        Object.hasOwn(g.modules, d.module),
      "Invalid or duplicate function definition.",
    );
    definitions.add(d.id);
    requireValue(
      record(d.inputs) && Object.keys(d.inputs).length <= 16,
      `${d.id}: invalid input metadata.`,
    );
    const ports = new Set<string>();
    for (const [name, p] of Object.entries(d.inputs)) {
      requireValue(symbol(name), `${d.id}: invalid parameter name.`);
      port(p);
      requireValue(!ports.has(p.id), `${d.id}: duplicate input port ID.`);
      ports.add(p.id);
    }
    port(d.output);
    if (d.context) {
      requireValue(
        record(d.context) && Object.keys(d.context).length <= 2,
        `${d.id}: invalid context bindings.`,
      );
      for (const [name, value] of Object.entries(d.context))
        requireValue(
          symbol(name) && ["time", "sampleRate"].includes(value),
          `${d.id}: invalid context binding.`,
        );
    }
    if (d.state)
      requireValue(
        record(d.state) &&
          symbol(d.state.parameter) &&
          symbol(d.state.initializer) &&
          Number.isSafeInteger(d.state.version) &&
          d.state.version > 0,
        `${d.id}: invalid state binding.`,
      );
  }
  requireValue(
    Array.isArray(g.parameters) && g.parameters.length <= 64,
    "Provide at most 64 named controls.",
  );
  const parameters = new Set<string>();
  for (const p of g.parameters) {
    requireValue(
      record(p) &&
        identifier(p.id) &&
        !parameters.has(p.id) &&
        typeof p.name === "string" &&
        p.name.length > 0 &&
        p.name.length <= 80 &&
        ["f32", "i32", "u32", "bool"].includes(p.type),
      "Invalid or duplicate named control.",
    );
    parameters.add(p.id);
    scalarValue(p.value, p.type as ScalarType, p.id);
    requireValue(
      p.unit === undefined ||
        (typeof p.unit === "string" && p.unit.length <= 40),
      `${p.id}: invalid unit.`,
    );
    for (const bound of [p.min, p.max])
      requireValue(
        bound === undefined ||
          (p.type !== "bool" &&
            typeof bound === "number" &&
            Number.isFinite(bound)),
        `${p.id}: invalid range.`,
      );
    requireValue(
      (p.min === undefined || Number(p.value) >= p.min) &&
        (p.max === undefined || Number(p.value) <= p.max) &&
        (p.min === undefined || p.max === undefined || p.min <= p.max),
      `${p.id}: value outside its range.`,
    );
  }
  requireValue(
    Array.isArray(g.nodes) && g.nodes.length > 0 && g.nodes.length <= 64,
    "Provide 1–64 function instances.",
  );
  const nodes = new Set<string>();
  for (const n of g.nodes) {
    requireValue(
      record(n) &&
        identifier(n.id) &&
        !nodes.has(n.id) &&
        definitions.has(n.definition) &&
        record(n.inputs) &&
        Object.keys(n.inputs).length <= 16,
      "Invalid or duplicate function instance.",
    );
    nodes.add(n.id);
    for (const [id, b] of Object.entries(n.inputs)) {
      requireValue(
        identifier(id) && record(b),
        `${n.id}: invalid input binding.`,
      );
      requireValue(
        b.kind === "constant" ||
          (b.kind === "parameter" && parameters.has(b.parameter)) ||
          (b.kind === "connection" && identifier(b.node) && identifier(b.port)),
        `${n.id}.${id}: invalid binding.`,
      );
    }
  }
  requireValue(
    record(g.output) && nodes.has(g.output.node) && identifier(g.output.port),
    "Select the graph's output port.",
  );
  return g;
}
