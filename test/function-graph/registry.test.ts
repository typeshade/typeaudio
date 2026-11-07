import { expect, it } from "vitest";
import { instantiateFunction } from "../../src/function-graph/runtime/registry.ts";

it("retains a reinstalled definition while a new layered sound replaces older registrations", () => {
  const register = (globalThis as any).__typeaudioRegisterFunction;
  const factory = () => ({ invoke: () => 0.25, initialize: () => undefined });
  for (let i = 0; i < 64; i++) register(`prepared-${i}`, factory);
  register("prepared-0", factory);
  register("new-layer", factory);
  expect(instantiateFunction("prepared-0").invoke([])).toBe(0.25);
  expect(instantiateFunction("new-layer").invoke([])).toBe(0.25);
  expect(() => instantiateFunction("prepared-1")).toThrow(/registration/);
});
